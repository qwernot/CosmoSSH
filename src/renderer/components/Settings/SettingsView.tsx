import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Type, 
  Terminal, 
  Download, 
  Upload, 
  Sparkles, 
  Shield, 
  Save,
  CheckCircle2
} from 'lucide-react';
import { AppSettings, AppDataPayload } from '@shared/types';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  appData: AppDataPayload;
  onImportData: (data: AppDataPayload) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  appData,
  onImportData,
}) => {
  const [fontSize, setFontSize] = useState(settings.fontSize || 14);
  const [fontFamily, setFontFamily] = useState(settings.fontFamily || "'JetBrains Mono', monospace");
  const [cursorBlink, setCursorBlink] = useState(settings.cursorBlink ?? true);
  const [scrollback, setScrollback] = useState(settings.scrollback || 5000);
  const [savedNotice, setSavedNotice] = useState(false);

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
          alert(`成功导入 ${parsed.hosts.length} 台服务器资产！`);
        } else {
          alert('导入失败：文件格式不符合预期');
        }
      } catch (err: any) {
        alert('解析 JSON 失败: ' + err.message);
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
        </div>

        {/* About App */}
        <div className="bg-cosmo-900 border border-cosmo-800 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cosmo-purple via-cosmo-accent to-cosmo-cyan flex items-center justify-center text-white shadow-glow-cyan/30 shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">CosmoSSH 终端</h4>
              <p className="text-xs text-slate-400">
                专为极客与运维工程师打造的轻量级 SSH & SFTP 终端客户端
              </p>
              <p className="text-[11px] text-cosmo-500 font-mono mt-0.5">Version 1.0.0 (Linux deb / Windows)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
