import { Client, SFTPWrapper, ConnectConfig } from 'ssh2';
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

    return new Promise((resolve, reject) => {
      const stream = session.sftp.createReadStream(filePath, { encoding: 'utf-8' });
      let data = '';
      stream.on('data', (chunk: string | Buffer) => {
        data += chunk;
      });
      stream.on('end', () => resolve(data));
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

  public async upload(
    sessionId: string,
    hostConfig: HostConfig,
    localPath: string,
    remotePath: string,
    onProgress?: (transferred: number, total: number) => void
  ): Promise<void> {
    const session = await this.getOrOpenSession(sessionId, hostConfig);
    const stats = fs.statSync(localPath);
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

    return new Promise((resolve, reject) => {
      session.sftp.fastGet(
        remotePath,
        localPath,
        {
          step: (transferred, _chunk, totalBytes) => {
            if (onProgress) {
              onProgress(transferred, totalBytes);
            }
          },
        },
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  public async delete(
    sessionId: string,
    hostConfig: HostConfig,
    remotePath: string,
    isDir: boolean
  ): Promise<void> {
    const session = await this.getOrOpenSession(sessionId, hostConfig);

    return new Promise((resolve, reject) => {
      if (isDir) {
        session.sftp.rmdir(remotePath, (err) => {
          if (err) return reject(err);
          resolve();
        });
      } else {
        session.sftp.unlink(remotePath, (err) => {
          if (err) return reject(err);
          resolve();
        });
      }
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
}
