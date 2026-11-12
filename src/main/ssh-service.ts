import { Client, ClientChannel, ConnectConfig } from 'ssh2';
import { HostConfig } from '../shared/types';

interface SSHSession {
  client: Client;
  channel?: ClientChannel;
  hostConfig: HostConfig;
}

export class SSHService {
  private sessions = new Map<string, SSHSession>();

  public connect(
    sessionId: string,
    hostConfig: HostConfig,
    rows: number,
    cols: number,
    onData: (data: string) => void,
    onClose: (hadError: boolean) => void,
    onError: (err: Error) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Disconnect existing if any
      this.disconnect(sessionId);

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
        if (!hostConfig.privateKey) {
          return reject(new Error('Private key is required'));
        }
        config.privateKey = hostConfig.privateKey;
        if (hostConfig.passphrase) {
          config.passphrase = hostConfig.passphrase;
        }
      }

      let isResolved = false;

      client.on('ready', () => {
        client.shell(
          {
            term: 'xterm-256color',
            rows: rows || 24,
            cols: cols || 80,
          },
          (err, stream) => {
            if (err) {
              if (!isResolved) {
                isResolved = true;
                reject(err);
              }
              onError(err);
              return;
            }

            const session = this.sessions.get(sessionId);
            if (session) {
              session.channel = stream;
            }

            stream.on('data', (data: Buffer) => {
              onData(data.toString('utf-8'));
            });

            stream.stderr?.on('data', (data: Buffer) => {
              onData(data.toString('utf-8'));
            });

            stream.on('close', () => {
              this.sessions.delete(sessionId);
              onClose(false);
            });

            if (!isResolved) {
              isResolved = true;
              resolve();
            }
          }
        );
      });

      client.on('error', (err) => {
        if (!isResolved) {
          isResolved = true;
          reject(err);
        }
        onError(err);
      });

      (client as any).on('close', (hadError?: boolean) => {
        this.sessions.delete(sessionId);
        onClose(Boolean(hadError));
      });

      this.sessions.set(sessionId, { client, hostConfig });

      try {
        client.connect(config);
      } catch (err: any) {
        this.sessions.delete(sessionId);
        reject(err);
      }
    });
  }

  public write(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session && session.channel) {
      session.channel.write(data);
      return true;
    }
    return false;
  }

  public resize(sessionId: string, rows: number, cols: number): boolean {
    const session = this.sessions.get(sessionId);
    if (session && session.channel) {
      session.channel.setWindow(rows, cols, 0, 0);
      return true;
    }
    return false;
  }

  public disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        if (session.channel) {
          session.channel.close();
        }
        session.client.end();
      } catch (e) {
        // ignore error on close
      }
      this.sessions.delete(sessionId);
    }
  }

  public getClient(sessionId: string): Client | undefined {
    return this.sessions.get(sessionId)?.client;
  }
}
