import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Download, 
  ExternalLink, 
  FolderOpen, 
  CheckCircle2, 
  AlertCircle,
  FileCode,
  HardDrive
} from 'lucide-react';
import { UpdateInfo, UpdateReleaseAsset } from '@shared/types';
import { formatBytes } from '../../utils/format';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ received: number; total: number; percent: number }>({
    received: 0,
    total: 0,
    percent: 0,
  });
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const cleanup = window.cosmossh.updater.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
    });

    return () => {
      cleanup();
    };
  }, [isOpen]);

  if (!isOpen || !updateInfo) return null;

  const isLinux = navigator.userAgent.toLowerCase().includes('linux');
  const isWindows = navigator.userAgent.toLowerCase().includes('win');

  const recommendedAsset: UpdateReleaseAsset | undefined =
    (isLinux && updateInfo.assets.find((a) => a.name.endsWith('.deb'))) ||
    (isWindows &&
      (updateInfo.assets.find((a) => a.name.endsWith('.zip')) ||
        updateInfo.assets.find((a) => a.name.endsWith('.7z')))) ||
    updateInfo.assets[0];

  const handleStartInAppDownload = async (asset: UpdateReleaseAsset) => {
    setDownloading(true);
    setDownloadError(null);
    setDownloadedFilePath(null);
    setDownloadProgress({ received: 0, total: asset.size || 0, percent: 0 });

    try {
      const res = await window.cosmossh.updater.downloadUpdate(asset.browser_download_url, asset.name);
      if (res.success && res.filePath) {
        setDownloadedFilePath(res.filePath);
      } else {
        setDownloadError(res.error || '下载失败');
      }
    } catch (err: any) {
      setDownloadError(err.message || '网络连接异常');
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenFolder = () => {
    if (downloadedFilePath) {
      window.cosmossh.updater.showInFolder(downloadedFilePath);
    }
  };

  const handleOpenGitHub = () => {
    window.cosmossh.shell.openExternal(updateInfo.releaseUrl || 'https://github.com/qwernot/CosmoSSH/releases');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="w-full max-w-xl bg-cosmo-900 border border-cosmo-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Header */}
        <div className="p-5 border-b border-cosmo-800 flex items-center justify-between bg-cosmo-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cosmo-accent to-cosmo-cyan flex items-center justify-center text-cosmo-950 shadow-glow-cyan/20">
              <Sparkles className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                发现新版本可用
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cosmo-cyan/15 text-cosmo-cyan border border-cosmo-cyan/30">
                  v{updateInfo.latestVersion}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                当前版本: v{updateInfo.currentVersion} ➔ 最新版本: v{updateInfo.latestVersion}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-cosmo-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Release Notes */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-cosmo-cyan" /> 更新说明 / Release Notes
            </h4>
            <div className="bg-cosmo-950 border border-cosmo-800 rounded-xl p-4 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {updateInfo.releaseNotes || '常规更新与性能优化。'}
            </div>
          </div>

          {/* Download Options */}
          {recommendedAsset && (
            <div className="bg-cosmo-850 border border-cosmo-750 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-cosmo-cyan" />
                  <span className="text-xs font-semibold text-slate-200">
                    适配安装包: {recommendedAsset.name}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {formatBytes(recommendedAsset.size)}
                </span>
              </div>

              {/* Progress Bar (if downloading) */}
              {downloading && (
                <div className="space-y-1.5 pt-1">
                  <div className="w-full h-2 rounded-full bg-cosmo-950 overflow-hidden border border-cosmo-800">
                    <div 
                      className="h-full bg-gradient-to-r from-cosmo-accent to-cosmo-cyan transition-all duration-200 rounded-full"
                      style={{ width: `${downloadProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>正在下载中...</span>
                    <span>
                      {formatBytes(downloadProgress.received)} / {formatBytes(downloadProgress.total)} ({downloadProgress.percent}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Download Completed Notification */}
              {downloadedFilePath && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> 安装包已成功下载至 Downloads 目录
                  </span>
                  <button
                    onClick={handleOpenFolder}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 flex items-center gap-1 text-[11px] font-semibold border border-emerald-500/40"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> 打开文件夹
                  </button>
                </div>
              )}

              {downloadError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>下载失败: {downloadError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-cosmo-800 bg-cosmo-950/60 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleOpenGitHub}
            className="px-4 py-2 rounded-xl bg-cosmo-800 hover:bg-cosmo-700 text-xs font-semibold text-slate-200 flex items-center gap-2 border border-cosmo-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-cosmo-cyan" /> 前往 GitHub Releases 仓库页面
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-cosmo-800 transition-colors"
            >
              稍后更新
            </button>
            {recommendedAsset && !downloadedFilePath && (
              <button
                disabled={downloading}
                onClick={() => handleStartInAppDownload(recommendedAsset!)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cosmo-accent to-cosmo-cyan text-cosmo-950 hover:brightness-110 shadow-glow-cyan/20 shadow flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" /> 
                {downloading ? '下载中...' : '在软件内直接下载'}
              </button>
            )}
            {downloadedFilePath && (
              <button
                onClick={handleOpenFolder}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-400 text-cosmo-950 hover:brightness-110 shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" /> 查看下载文件
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
