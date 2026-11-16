import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { SFTPFileItem } from '../shared/types';

export class LocalFSService {
  public getSpecialDirs(): { desktop: string; downloads: string; home: string } {
    return {
      desktop: app.getPath('desktop'),
      downloads: app.getPath('downloads'),
      home: app.getPath('home'),
    };
  }

  public async listDirectory(targetPath?: string): Promise<{ path: string; files: SFTPFileItem[] }> {
    const defaultPath = app.getPath('desktop');
    const resolvedPath = targetPath && fs.existsSync(targetPath) ? path.resolve(targetPath) : defaultPath;

    const entries = await fs.promises.readdir(resolvedPath, { withFileTypes: true });
    const files: SFTPFileItem[] = [];

    for (const entry of entries) {
      try {
        const fullPath = path.join(resolvedPath, entry.name);
        const stats = await fs.promises.stat(fullPath);

        let type: 'd' | '-' | 'l' = '-';
        if (entry.isDirectory()) {
          type = 'd';
        } else if (entry.isSymbolicLink()) {
          type = 'l';
        }

        files.push({
          name: entry.name,
          type,
          size: stats.size,
          modifyTime: Math.floor(stats.mtimeMs / 1000),
          accessTime: Math.floor(stats.atimeMs / 1000),
          permissions: stats.mode & 0o777,
          modeStr: entry.isDirectory() ? 'drwxr-xr-x' : '-rw-r--r--',
        });
      } catch (e) {
        // Skip inaccessible/locked files
      }
    }

    // Sort: directories first, then alphabetical
    files.sort((a, b) => {
      if (a.type === 'd' && b.type !== 'd') return -1;
      if (a.type !== 'd' && b.type === 'd') return 1;
      return a.name.localeCompare(b.name);
    });

    return { path: resolvedPath, files };
  }

  public async mkdir(dirPath: string): Promise<boolean> {
    await fs.promises.mkdir(dirPath, { recursive: true });
    return true;
  }

  public async delete(targetPath: string): Promise<boolean> {
    const stats = await fs.promises.stat(targetPath);
    if (stats.isDirectory()) {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(targetPath);
    }
    return true;
  }
}
