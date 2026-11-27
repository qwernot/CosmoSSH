import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Type, 
  Terminal, 
  Download, 
  Upload, 
  Sparkles, 
  Shield, 
  Save,
  CheckCircle2,
  Globe,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { AppSettings, AppDataPayload, UpdateInfo } from '@shared/types';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  appData: AppDataPayload;
  onImportData: (data: AppDataPayload) => void;
  onOpenUpdater?: (info?: UpdateInfo) => void;
  updateInfo?: UpdateInfo | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  appData,
  onImportData,
  onOpenUpdater,
  updateInfo,
}) => {
  const [fontSize, setFontSize] = useState(settings.fontSize || 14);
  const [fontFamily, setFontFamily] = useState(settings.fontFamily || "'JetBrains Mono', monospace");
  const [cursorBlink, setCursorBlink] = useState(settings.cursorBlink ?? true);
  const [scrollback, setScrollback] = useState(settings.scrollback || 5000);
  const [savedNotice, setSavedNotice] = useState(false);
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync local form state whenever settings load asynchronously or from cloud pull
  useEffect(() => {
    setFontSize(settings.fontSize || 14);
    setFontFamily(settings.fontFamily || "'JetBrains Mono', monospace");
    setCursorBlink(settings.cursorBlink ?? true);
    setScrollback(settings.scrollback || 5000);
  }, [settings.fontSize, settings.fontFamily, settings.cursorBlink, settings.scrollback]);

  // Update check state
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [checkUpdateResult, setCheckUpdateResult] = useState<string | null>(null);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setCheckUpdateResult(null);
    try {
      const res = await window.cosmossh.updater.checkUpdate();
      if (res.error) {
        setCheckUpdateResult(`检查更新失败: ${res.error}`);
      } else if (res.hasUpdate) {
        setCheckUpdateResult(`发现新版本 v${res.latestVersion}！`);
        if (onOpenUpdater) {
          onOpenUpdater(res);
        }
      } else {
        setCheckUpdateResult(`当前已是最新版本 (v${__APP_VERSION__})`);
      }
    } catch (e: any) {
      setCheckUpdateResult(`检查更新失败: ${e.message}`);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleSave = () => {
    onSaveSettings({
      ...settings,
      fontSize: Number(fontSize),
      fontFamily,
      cursorBlink,
      scrollback: Number(scrollback),
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cosmossh-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.hosts)) {
          onImportData(parsed);
          setImportNotice({ type: 'success', text: `成功导入 ${parsed.hosts.length} 台服务器资产！` });
        } else {
          setImportNotice({ type: 'error', text: '导入失败：文件格式不符合预期' });
        }
      } catch (err: any) {
        setImportNotice({ type: 'error', text: '解析 JSON 失败: ' + err.message });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-cosmo-950 overflow-hidden">
      {/* Header */}
      <header className="h-16 px-6 border-b border-cosmo-800 flex items-center justify-between shrink-0 bg-cosmo-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-5 h-5 text-cosmo-cyan" />
          <h2 className="text-base font-bold text-slate-100">偏好设置与数据管理</h2>
        </div>

        {savedNotice && (
          <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-4 h-4" /> 设置已保存
          </span>
        )}
      </header>

      {/* Settings Form Container */}
      <div className="flex-1 overflow-y-auto p-6 w-full space-y-6">
        {/* Terminal Preferences */}
        <div className="bg-cosmo-900 border border-cosmo-800 rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cosmo-cyan" /> 终端显示外观
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                字体大小 ({fontSize}px)
              </label>
              <input
                type="range"
                min={11}
                max={22}
                step={1}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-cosmo-cyan"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                缓冲区行数 (Scrollback)
              </label>
              <input
                type="number"
                value={scrollback}
                onChange={(e) => setScrollback(Number(e.target.value))}
                className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cosmo-cyan"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              等宽字体名称
            </label>
            <input
              type="text"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              placeholder="'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
              className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cosmo-cyan"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="cursorBlink"
              checked={cursorBlink}
              onChange={(e) => setCursorBlink(e.target.checked)}
              className="w-4 h-4 rounded text-cosmo-cyan accent-cosmo-cyan"
            />
            <label htmlFor="cursorBlink" className="text-xs text-slate-300 font-medium">
              光标呼吸闪烁 (Cursor Blink)
            </label>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cosmo-accent to-cosmo-cyan text-cosmo-950 hover:brightness-110 shadow-glow-cyan/20 shadow flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" /> 保存终端设置
            </button>
          </div>
        </div>

        {/* Data Backup & Export */}
        <div className="bg-cosmo-900 border border-cosmo-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cosmo-purple" /> 本地数据备份与迁移
          </h3>
          <p className="text-xs text-slate-400">
            您可以将本地存储的所有服务器配置、分组、快捷命令导出为 JSON 备份文件，或在其他设备上直接导入。
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleExportJSON}
              className="px-4 py-2 rounded-xl bg-cosmo-800 hover:bg-cosmo-700 text-xs font-semibold text-slate-200 flex items-center gap-2 border border-cosmo-700"
            >
              <Download className="w-4 h-4 text-cosmo-cyan" /> 导出 JSON 配置文件
            </button>

            <label className="px-4 py-2 rounded-xl bg-cosmo-800 hover:bg-cosmo-700 text-xs font-semibold text-slate-200 flex items-center gap-2 border border-cosmo-700 cursor-pointer">
              <Upload className="w-4 h-4 text-cosmo-accent" /> 导入 JSON 配置文件
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>
          </div>
          {importNotice && (
            <p className={`text-xs font-medium ${importNotice.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {importNotice.text}
            </p>
          )}
        </div>

        {/* Version Updates & Upgrade */}
        <div className="bg-cosmo-900 border border-cosmo-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-cosmo-cyan ${checkingUpdate ? 'animate-spin' : ''}`} /> 软件更新与升级通道
            </h3>
            <span className="text-[11px] font-mono text-cosmo-400">逢十进一规范: v{__APP_VERSION__}</span>
          </div>
          <p className="text-xs text-slate-400">
            CosmoSSH 支持在软件内一键直接下载最新安装包升级，或直接前往 GitHub Releases 官方仓库页面下载。
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              disabled={checkingUpdate}
              onClick={handleCheckUpdate}
              className="px-4 py-2 rounded-xl bg-cosmo-800 hover:bg-cosmo-700 text-xs font-semibold text-slate-200 flex items-center gap-2 border border-cosmo-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cosmo-cyan ${checkingUpdate ? 'animate-spin' : ''}`} />
              {checkingUpdate ? '正在检查最新版本...' : '🔍 检查更新'}
            </button>

            <button
              onClick={() => window.cosmossh.shell.openExternal('https://github.com/qwernot/CosmoSSH/releases')}
              className="px-4 py-2 rounded-xl bg-cosmo-850 hover:bg-cosmo-750 text-xs font-medium text-slate-300 flex items-center gap-2 border border-cosmo-750 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" /> 前往官方 Releases 仓库更新
            </button>

            {checkUpdateResult && (
              <span className="text-xs font-mono text-cosmo-cyan bg-cosmo-950 px-3 py-1.5 rounded-lg border border-cosmo-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {checkUpdateResult}
              </span>
            )}
          </div>
        </div>

        {/* Windows Defender SmartScreen Risk Mitigation FAQ */}
        <div className="bg-cosmo-900 border border-cosmo-800 rounded-2xl p-6 space-y-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" /> Windows 提示「已保护你的电脑 / 发现风险」常见说明
          </h3>
          <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
            <p>
              💡 <strong className="text-slate-200">为什么 Windows 会提示？</strong>
              开源免费软件通常未购买每年高达数百美元的微软商业 EV 数字签名证书。Windows Defender SmartScreen 会对从网络下载的新发布的未签名可执行文件弹出该提示。这是正常现象。
            </p>
            <div className="bg-cosmo-950 p-3 rounded-xl border border-cosmo-800 space-y-1 font-mono text-[11px] text-slate-300">
              <p className="text-emerald-400 font-bold">✅ 解决方法（只需一次）：</p>
              <p>方法一：在弹出的「Windows 已保护你的电脑」窗口中，点击 <span className="text-cosmo-cyan font-semibold">“更多信息 (More info)”</span> ➔ 点击出现的 <span className="text-cosmo-cyan font-semibold">“仍要运行 (Run anyway)”</span> 即可正常打开。</p>
              <p>方法二：右键点击解压出的 <span className="text-slate-200">CosmoSSH.exe</span> ➔ 选择 <span className="text-cosmo-cyan font-semibold">“属性”</span> ➔ 勾选最下方的 <span className="text-cosmo-cyan font-semibold">“解除锁定 (Unblock)”</span> ➔ 点击确定即可彻底消除提示。</p>
            </div>
          </div>
        </div>

        {/* Author Homepage (666228.xyz) */}
        <div className="bg-cosmo-900 border border-cosmo-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Globe className="w-4 h-4 text-cosmo-cyan" /> 作者主页与官方动态
          </h3>
          <p className="text-xs text-slate-400">
            欢迎访问作者主页，获取 CosmoSSH 的最新版本发布、更新日志及开源运维工具集。
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => window.cosmossh.shell.openExternal('https://666228.xyz')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cosmo-accent/20 to-cosmo-cyan/20 hover:from-cosmo-accent/30 hover:to-cosmo-cyan/30 text-xs font-semibold text-cosmo-cyan flex items-center gap-2 border border-cosmo-cyan/40 shadow-glow-cyan/10 transition-all hover:brightness-110 cursor-pointer"
            >
              <Globe className="w-4 h-4" /> 作者主页: 666228.xyz
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
          </div>
        </div>

        {/* About App */}
        <div className="bg-cosmo-900 border border-cosmo-800 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cosmo-purple via-cosmo-accent to-cosmo-cyan flex items-center justify-center text-white shadow-glow-cyan/30 shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                CosmoSSH 终端
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cosmo-cyan/10 text-cosmo-cyan border border-cosmo-cyan/30">
                  v{__APP_VERSION__}
                </span>
              </h4>
              <p className="text-xs text-slate-400">
                专为极客与运维工程师打造的轻量级 SSH & SFTP 终端客户端
              </p>
              <p className="text-[11px] text-cosmo-500 font-mono mt-0.5">Version {__APP_VERSION__} (Linux deb / Windows Portable)</p>
            </div>
          </div>

          <button
            onClick={() => window.cosmossh.shell.openExternal('https://666228.xyz')}
            className="px-3.5 py-1.5 rounded-xl bg-cosmo-800 hover:bg-cosmo-700 text-xs font-medium text-slate-300 hover:text-cosmo-cyan flex items-center gap-1.5 border border-cosmo-700 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" /> 666228.xyz
          </button>
        </div>
      </div>
    </div>
  );
};
