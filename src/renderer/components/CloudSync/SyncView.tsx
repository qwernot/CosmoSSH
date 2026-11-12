import React, { useState } from 'react';
import { 
  Cloud, 
  UploadCloud, 
  DownloadCloud, 
  ShieldCheck, 
  Key, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  HelpCircle, 
  ExternalLink,
  Server,
  Layers
} from 'lucide-react';
import { CloudSyncConfig, AppDataPayload } from '@shared/types';
import { encryptData, decryptData } from '../../utils/crypto';

interface SyncViewProps {
  syncConfig: CloudSyncConfig;
  onSaveSyncConfig: (config: CloudSyncConfig) => void;
  appData: AppDataPayload;
  onUpdateAppData: (data: Partial<AppDataPayload>) => void;
}

export const SyncView: React.FC<SyncViewProps> = ({
  syncConfig,
  onSaveSyncConfig,
  appData,
  onUpdateAppData,
}) => {
  const [workerUrl, setWorkerUrl] = useState(syncConfig.workerUrl || '');
  const [token, setToken] = useState(syncConfig.token || '');
  const [masterPassword, setMasterPassword] = useState('');
  const [autoSync, setAutoSync] = useState(syncConfig.autoSync || false);

  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleSaveSettings = () => {
    onSaveSyncConfig({
      workerUrl: workerUrl.trim(),
      token: token.trim(),
      autoSync,
      lastSyncedAt: syncConfig.lastSyncedAt,
    });
    setStatusMessage({ type: 'success', text: '同步连接配置已保存' });
  };

  const handleTestConnection = async () => {
    if (!workerUrl.trim()) {
      setStatusMessage({ type: 'error', text: '请先填写 Cloudflare Worker URL' });
      return;
    }

    setTesting(true);
    setStatusMessage(null);

    try {
      const cleanUrl = workerUrl.trim().replace(/\/+$/, '');
      const resp = await fetch(`${cleanUrl}/health`);
      if (resp.ok) {
        const json = await resp.json();
        setStatusMessage({
          type: 'success',
          text: `连接成功！已连接至 ${json.service || 'Cloudflare Sync Worker'}`,
        });
      } else {
        setStatusMessage({ type: 'error', text: `连接异常，服务端返回状态码: ${resp.status}` });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `连接失败: ${e.message}。请检查 Worker URL 是否正确可访问。` });
    } finally {
      setTesting(false);
    }
  };

  const handlePushToCloud = async () => {
    if (!workerUrl.trim() || !token.trim()) {
      setStatusMessage({ type: 'error', text: '请填写完整的 Worker URL 和 Sync Token' });
      return;
    }
    if (!masterPassword) {
      setStatusMessage({ type: 'error', text: '请提供端到端加解密主密码 (Master Password)' });
      return;
    }

    setSyncing(true);
    setStatusMessage({ type: 'info', text: '正在进行本地 AES-256-GCM 加密...' });

    try {
      // Encrypt full data
      const encryptedBlob = await encryptData(
        {
          hosts: appData.hosts,
          groups: appData.groups,
          snippets: appData.snippets,
          settings: appData.settings,
        },
        masterPassword
      );

      const cleanUrl = workerUrl.trim().replace(/\/+$/, '');
      const resp = await fetch(`${cleanUrl}/api/sync`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({
          data: encryptedBlob,
          updatedAt: Date.now(),
        }),
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${resp.status}`);
      }

      const now = Date.now();
      onSaveSyncConfig({
        workerUrl: workerUrl.trim(),
        token: token.trim(),
        autoSync,
        lastSyncedAt: now,
      });

      setStatusMessage({
        type: 'success',
        text: `已成功将 ${appData.hosts.length} 台主机资产端到端加密备份至 Cloudflare！`,
      });
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `推送失败: ${e.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const handlePullFromCloud = async () => {
    if (!workerUrl.trim() || !token.trim()) {
      setStatusMessage({ type: 'error', text: '请填写完整的 Worker URL 和 Sync Token' });
      return;
    }
    if (!masterPassword) {
      setStatusMessage({ type: 'error', text: '请提供端到端加解密主密码 (Master Password) 以便解密云端数据' });
      return;
    }

    setSyncing(true);
    setStatusMessage({ type: 'info', text: '正在从 Cloudflare 拉取密文...' });

    try {
      const cleanUrl = workerUrl.trim().replace(/\/+$/, '');
      const resp = await fetch(`${cleanUrl}/api/sync`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${resp.status}`);
      }

      const json = await resp.json();
      if (!json.exists || !json.data) {
        setStatusMessage({ type: 'info', text: '云端暂无同步数据，您可以先上传一次备份。' });
        return;
      }

      // Decrypt
      setStatusMessage({ type: 'info', text: '密文拉取成功，正在使用主密码解密...' });
      const decrypted = await decryptData(json.data, masterPassword);

      if (!decrypted || !decrypted.hosts) {
        throw new Error('解密的数据格式不符合预期');
      }

      // Update local data
      onUpdateAppData({
        hosts: decrypted.hosts || [],
        groups: decrypted.groups || appData.groups,
        snippets: decrypted.snippets || appData.snippets,
      });

      const now = Date.now();
      onSaveSyncConfig({
        workerUrl: workerUrl.trim(),
        token: token.trim(),
        autoSync,
        lastSyncedAt: now,
      });

      setStatusMessage({
        type: 'success',
        text: `成功从 Cloudflare 恢复并解密了 ${decrypted.hosts.length} 台主机资产！`,
      });
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: `拉取解密失败: ${e.message}。请核实主密码是否与上传时的密码完全一致。`,
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-cosmo-950 overflow-hidden">
      {/* Header */}
      <header className="h-16 px-6 border-b border-cosmo-800 flex items-center justify-between shrink-0 bg-cosmo-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <Cloud className="w-5 h-5 text-cosmo-cyan" />
          <h2 className="text-base font-bold text-slate-100">Cloudflare 端到端加密（E2EE）云同步</h2>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-6 w-full space-y-6">
        {/* Security Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-cosmo-purple/20 via-cosmo-cyan/10 to-cosmo-accent/20 border border-cosmo-cyan/30 flex items-start gap-3.5">
          <ShieldCheck className="w-6 h-6 text-cosmo-cyan shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-slate-100 text-sm">零知识加密安全保障 (Zero-Knowledge E2EE)</h4>
            <p className="text-slate-300 leading-relaxed">
              您的所有服务器主机信息、SSH 登录密码和私钥均在客户端本地通过 **AES-256-GCM**（结合 PBKDF2 100,000 次密钥哈希）进行加密后再传输。Cloudflare 仅充当密文存储介质，任何第三方甚至 Cloudflare 自身均完全无法解密查看您的服务器密码。
            </p>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : statusMessage.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-cosmo-800 border-cosmo-700 text-cosmo-cyan'
            }`}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            {statusMessage.type === 'info' && <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Configuration Card */}
        <div className="bg-cosmo-900 border border-cosmo-800 rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Lock className="w-4 h-4 text-cosmo-cyan" /> 同步服务端设置
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cloudflare Worker URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={workerUrl}
                  onChange={(e) => setWorkerUrl(e.target.value)}
                  placeholder="https://cosmossh-sync.flat-mouse-41ef.workers.dev"
                  className="flex-1 bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2 rounded-xl bg-cosmo-800 hover:bg-cosmo-700 text-xs font-semibold text-slate-200 transition-colors border border-cosmo-700 disabled:opacity-50"
                >
                  {testing ? '测试中...' : '测试连通性'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Sync Token (自定义访问令牌)
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="例如：my-secret-vault-token-888"
                className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                用于验证当前客户端对该 Worker 的访问权限。
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                端到端加密主密码 (Master Password) <span className="text-rose-400">*</span>
              </label>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="请输入解密密码（不同设备同步时必须输入完全相同的密码）"
                className="w-full bg-cosmo-950 border border-amber-500/40 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <p className="text-[11px] text-amber-400/80 mt-1">
                重要：主密码仅保存在内存中，不会上传至任何服务器。若主密码丢失，云端密文将无法解密。
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-cosmo-800">
            <span className="text-xs text-slate-400">
              {syncConfig.lastSyncedAt
                ? `上次同步时间: ${new Date(syncConfig.lastSyncedAt).toLocaleString()}`
                : '尚未进行过同步'}
            </span>
            <button
              type="button"
              onClick={handleSaveSettings}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-cosmo-800 hover:bg-cosmo-750 text-slate-200 transition-colors border border-cosmo-700"
            >
              保存配置
            </button>
          </div>
        </div>

        {/* Sync Operations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-cosmo-900 border border-cosmo-800 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-cosmo-cyan/10 text-cosmo-cyan border border-cosmo-cyan/20">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">推送到云端 (Push)</h4>
                  <p className="text-xs text-slate-500">加密本地数据并覆盖云端备份</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                将当前本地的 {appData.hosts.length} 台服务器资产加密生成密文后安全上传。
              </p>
            </div>

            <button
              onClick={handlePushToCloud}
              disabled={syncing}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cosmo-accent to-cosmo-cyan text-cosmo-950 hover:brightness-110 shadow-glow-cyan/20 shadow flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" /> 立即上传备份
            </button>
          </div>

          <div className="bg-cosmo-900 border border-cosmo-800 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-cosmo-purple/20 text-cosmo-purple border border-cosmo-purple/40">
                  <DownloadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">从云端拉取 (Pull)</h4>
                  <p className="text-xs text-slate-500">拉取密文并使用主密码解密覆盖</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                在另一台电脑安装 CosmoSSH 后，输入相同凭证与主密码即可瞬间恢复所有服务器列表。
              </p>
            </div>

            <button
              onClick={handlePullFromCloud}
              disabled={syncing}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-cosmo-800 hover:bg-cosmo-700 text-cosmo-cyan border border-cosmo-cyan/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <DownloadCloud className="w-4 h-4" /> 立即拉取并解密
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
