import { Client, SFTPWrapper, ConnectConfig, Stats } from 'ssh2';
import path from 'path';
import fs from 'fs';
import { HostConfig, SFTPFileItem } from '../shared/types';
import { SSHService } from './ssh-service';

interface SFTPSession {
  client: Client;
  sftp: SFTPWrapper;
  isDedicatedClient: boolean;
  currentPath: string;
}

const MAX_EDITABLE_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

export class SFTPService {
  private sessions = new Map<string, SFTPSession>();

  constructor(private sshService: SSHService) {}

  public async getOrOpenSession(
    sessionId: string,
    hostConfig: HostConfig
  ): Promise<SFTPSession> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    // Check if there is an active SSH terminal client we can reuse
    const terminalClient = this.sshService.getClient(sessionId);
    if (terminalClient) {
      return new Promise((resolve, reject) => {
        terminalClient.sftp((err, sftp) => {
          if (err) return reject(err);
          const session: SFTPSession = {
            client: terminalClient,
            sftp,
            isDedicatedClient: false,
            currentPath: '.',
          };
          this.sessions.set(sessionId, session);
          resolve(session);
        });
      });
    }

    // Otherwise create dedicated client
    const client = new Client();
    const config: ConnectConfig = {
      host: hostConfig.host,
      port: hostConfig.port || 22,
      username: hostConfig.username,
      readyTimeout: 20000,
      keepaliveInterval: 15000,
      keepaliveCountMax: 3,
    };

    if (hostConfig.authType === 'password') {
      config.password = hostConfig.password;
    } else if (hostConfig.authType === 'privateKey') {
      config.privateKey = hostConfig.privateKey;
      if (hostConfig.passphrase) {
        config.passphrase = hostConfig.passphrase;
      }
    }

    return new Promise((resolve, reject) => {
      client.on('ready', () => {
        client.sftp((err, sftp) => {
          if (err) {
            client.end();
            return reject(err);
          }
          const session: SFTPSession = {
            client,
            sftp,
            isDedicatedClient: true,
            currentPath: '.',
          };
          this.sessions.set(sessionId, session);
          resolve(session);
        });
      });

      client.on('error', (err) => {
        this.sessions.delete(sessionId);
        reject(err);
      });

      client.on('close', () => {
        this.sessions.delete(sessionId);
      });

      try {
        client.connect(config);
      } catch (e) {
        reject(e);
      }
    });
  }

  private statRemote(sftp: SFTPWrapper, remotePath: string): Promise<Stats> {
    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) return reject(err);
        resolve(stats);
      });
    });
  }

  public async listDirectory(
    sessionId: string,
    hostConfig: HostConfig,
    dirPath: string
  ): Promise<{ path: string; files: SFTPFileItem[] }> {
    const session = await this.getOrOpenSession(sessionId, hostConfig);

    return new Promise((resolve, reject) => {
      // Resolve path
      session.sftp.realpath(dirPath || '.', (realErr, resolvedPath) => {
        const targetPath = realErr ? (dirPath || '/') : resolvedPath;

        session.sftp.readdir(targetPath, (err, list) => {
          if (err) return reject(err);

          session.currentPath = targetPath;

          const files: SFTPFileItem[] = list.map((item) => {
            let type: 'd' | '-' | 'l' = '-';
            const mode = item.attrs.mode;
            if ((mode & 0o170000) === 0o040000) {
              type = 'd';
            } else if ((mode & 0o170000) === 0o120000) {
              type = 'l';
            }

            return {
              name: item.filename,
              type,
              size: item.attrs.size,
              modifyTime: item.attrs.mtime,
              accessTime: item.attrs.atime,
              permissions: mode & 0o777,
              modeStr: item.longname?.split(' ')[0] || '',
            };
          });

          // Sort: directories first, then alphabetical
          files.sort((a, b) => {
            if (a.type === 'd' && b.type !== 'd') return -1;
            if (a.type !== 'd' && b.type === 'd') return 1;
            return a.name.localeCompare(b.name);
          });

          resolve({ path: targetPath, files });
        });
      });
    });
  }

  public async readFile(
    sessionId: string,
    hostConfig: HostConfig,
    filePath: string
  ): Promise<string> {
    const session = await this.getOrOpenSession(sessionId, hostConfig);

    // Guard against opening huge files in the in-app text editor
    try {
      const stats = await this.statRemote(session.sftp, filePath);
      if (stats.size > MAX_EDITABLE_FILE_BYTES) {
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        throw new Error(`文件体积为 ${sizeMB} MB，超过在线编辑上限 (2 MB)，请直接下载到本地查看`);
      }
    } catch (err: any) {
      if (err?.message?.includes('超过在线编辑上限')) {
        throw err;
      }
    }

    return new Promise((resolve, reject) => {
      const stream = session.sftp.createReadStream(filePath);
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      let checkedBinary = false;

      stream.on('data', (chunk: Buffer | string) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buf.length;
        if (totalBytes > MAX_EDITABLE_FILE_BYTES) {
          stream.destroy();
          reject(new Error('文件体积超过在线编辑上限 (2 MB)，请直接下载到本地查看'));
          return;
        }
        if (!checkedBinary && buf.length > 0) {
          checkedBinary = true;
          const sample = buf.subarray(0, Math.min(buf.length, 4096));
          if (sample.includes(0)) {
            stream.destroy();
            reject(new Error('检测到二进制文件，暂不支持在线文本编辑，请下载到本地打开'));
            return;
          }
        }
        chunks.push(buf);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', (err: any) => reject(err));
    });
  }

  public async writeFile(
    sessionId: string,
    hostConfig: HostConfig,
    filePath: string,
    content: string
  ): Promise<void> {
    const session = await this.getOrOpenSession(sessionId, hostConfig);

    return new Promise((resolve, reject) => {
      const stream = session.sftp.createWriteStream(filePath, { encoding: 'utf-8' });
      stream.on('finish', () => resolve());
      stream.on('error', (err: any) => reject(err));
      stream.end(content);
    });
  }

  private async ensureRemoteDir(sftp: SFTPWrapper, remoteDir: string): Promise<void> {
    return new Promise((resolve) => {
      sftp.mkdir(remoteDir, () => resolve());
    });
  }

  public async upload(
    sessionId: string,
    hostConfig: HostConfig,
    localPath: string,
    remotePath: string,
    onProgress?: (transferred: number, total: number) => void
  ): Promise<void> {
    const session = await this.getOrOpenSession(sessionId, hostConfig);
    const stats = fs.statSync(localPath);

    if (stats.isDirectory()) {
      await this.ensureRemoteDir(session.sftp, remotePath);
      const entries = fs.readdirSync(localPath);
      for (const entry of entries) {
        const subLocal = path.join(localPath, entry);
        const subRemote = remotePath.endsWith('/') ? `${remotePath}${entry}` : `${remotePath}/${entry}`;
        await this.upload(sessionId, hostConfig, subLocal, subRemote, onProgress);
      }
      return;
    }

    const total = stats.size;
    return new Promise((resolve, reject) => {
      session.sftp.fastPut(
        localPath,
        remotePath,
        {
          step: (transferred, _chunk, totalBytes) => {
            if (onProgress) {
              onProgress(transferred, totalBytes || total);
            }
          },
        },
        (err) => {
          if (err) return reject(err);
          if (onProgress) onProgress(total, total);
          resolve();
        }
      );
    });
  }

  private async downloadRecursive(
    sftp: SFTPWrapper,
    remotePath: string,
    localPath: string,
    onProgress?: (transferred: number, total: number) => void
  ): Promise<void> {
    const stats = await this.statRemote(sftp, remotePath);

    if (stats.isDirectory()) {
      fs.mkdirSync(localPath, { recursive: true });
      const entries = await new Promise<any[]>((resolve, reject) => {
        sftp.readdir(remotePath, (err, list) => {
          if (err) return reject(err);
          resolve(list);
        });
      });

      for (const entry of entries) {
        if (entry.filename === '.' || entry.filename === '..') continue;
        const subRemote = remotePath.endsWith('/') ? `${remotePath}${entry.filename}` : `${remotePath}/${entry.filename}`;
        const subLocal = path.join(localPath, entry.filename);
        await this.downloadRecursive(sftp, subRemote, subLocal, onProgress);
      }
      return;
    }

    const total = stats.size;
    return new Promise((resolve, reject) => {
      sftp.fastGet(
        remotePath,
        localPath,
        {
          step: (transferred, _chunk, totalBytes) => {
            if (onProgress) {
              onProgress(transferred, totalBytes || total);
            }
          },
        },
        (err) => {
          if (err) return reject(err);
          if (onProgress) onProgress(total, total);
          resolve();
        }
      );
    });
  }

  public async download(
    sessionId: string,
    hostConfig: HostConfig,
    remotePath: string,
    localPath: string,
    onProgress?: (transferred: number, total: number) => void
  ): Promise<void> {
    const session = await this.getOrOpenSession(sessionId, hostConfig);
    await this.downloadRecursive(session.sftp, remotePath, localPath, onProgress);
  }

  private async deleteDirRecursive(sftp: SFTPWrapper, remoteDir: string): Promise<void> {
    const entries = await new Promise<any[]>((resolve, reject) => {
      sftp.readdir(remoteDir, (err, list) => {
        if (err) return reject(err);
        resolve(list);
      });
    });

    for (const entry of entries) {
      if (entry.filename === '.' || entry.filename === '..') continue;
      const childPath = remoteDir.endsWith('/') ? `${remoteDir}${entry.filename}` : `${remoteDir}/${entry.filename}`;
      const isChildDir = (entry.attrs.mode & 0o170000) === 0o040000;
      if (isChildDir) {
        await this.deleteDirRecursive(sftp, childPath);
      } else {
        await new Promise<void>((resolve, reject) => {
          sftp.unlink(childPath, (err) => (err ? reject(err) : resolve()));
        });
      }
    }

    await new Promise<void>((resolve, reject) => {
      sftp.rmdir(remoteDir, (err) => (err ? reject(err) : resolve()));
    });
  }

  public async delete(
    sessionId: string,
    hostConfig: HostConfig,
    remotePath: string,
    isDir: boolean
  ): Promise<void> {
    const session = await this.getOrOpenSession(sessionId, hostConfig);

    if (isDir) {
      await this.deleteDirRecursive(session.sftp, remotePath);
      return;
    }

    return new Promise((resolve, reject) => {
      session.sftp.unlink(remotePath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async rename(
    sessionId: string,
    hostConfig: HostConfig,
    oldPath: string,
    newPath: string
  ): Promise<void> {
    const session = await this.getOrOpenSession(sessionId, hostConfig);

    return new Promise((resolve, reject) => {
      session.sftp.rename(oldPath, newPath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async mkdir(
    sessionId: string,
    hostConfig: HostConfig,
    dirPath: string
  ): Promise<void> {
    const session = await this.getOrOpenSession(sessionId, hostConfig);

    return new Promise((resolve, reject) => {
      session.sftp.mkdir(dirPath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async chmod(
    sessionId: string,
    hostConfig: HostConfig,
    remotePath: string,
    mode: number
  ): Promise<void> {
    const session = await this.getOrOpenSession(sessionId, hostConfig);

    return new Promise((resolve, reject) => {
      session.sftp.chmod(remotePath, mode, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.isDedicatedClient) {
        try {
          session.client.end();
        } catch (e) {
          // ignore
        }
      }
      this.sessions.delete(sessionId);
    }
  }

  public disconnectAll(): void {
    for (const sessionId of Array.from(this.sessions.keys())) {
      this.disconnect(sessionId);
    }
  }
}
