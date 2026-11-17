export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000 > 1e11 ? timestamp : timestamp * 1000);
  return date.toLocaleString();
}

export function formatPermissions(mode: number): string {
  const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  const user = perms[(mode >> 6) & 7];
  const group = perms[(mode >> 3) & 7];
  const other = perms[mode & 7];
  return `${user}${group}${other}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  return formatBytes(bytesPerSec) + '/s';
}

export function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return `${days}天 ${hours}小时`;
  }
  if (hours > 0) {
    return `${hours}小时 ${mins}分`;
  }
  return `${mins}分钟`;
}

