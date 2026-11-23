import { CosmoSSHAPI } from '../../preload';

declare global {
  interface Window {
    cosmossh: CosmoSSHAPI;
  }
  const __APP_VERSION__: string;
}
