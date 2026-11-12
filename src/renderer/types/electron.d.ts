import { CosmoSSHAPI } from '../../preload';

declare global {
  interface Window {
    cosmossh: CosmoSSHAPI;
  }
}
