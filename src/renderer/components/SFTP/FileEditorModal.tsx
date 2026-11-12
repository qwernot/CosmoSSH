import React, { useState, useEffect } from 'react';
import { X, Save, FileCode, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface FileEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
}

export const FileEditorModal: React.FC<FileEditorModalProps> = ({
  isOpen,
  onClose,
  filePath,
  initialContent,
  onSave,
}) => {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(initialContent);
    setSaveSuccess(false);
    setError(null);
  }, [initialContent, isOpen]);

  // Handle Ctrl+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && isOpen) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, content]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await onSave(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const fileName = filePath.split('/').pop() || filePath;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <div className="bg-cosmo-900 border border-cosmo-700 rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 px-5 border-b border-cosmo-800 flex items-center justify-between bg-cosmo-850/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cosmo-800 text-cosmo-cyan border border-cosmo-cyan/30">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                {fileName}
                {saveSuccess && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-normal font-sans">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 已保存至远程服务器
                  </span>
                )}
                {error && (
                  <span className="text-xs text-rose-400 flex items-center gap-1 font-normal font-sans">
                    <AlertCircle className="w-3.5 h-3.5" /> {error}
                  </span>
                )}
              </h3>
              <p className="text-[11px] font-mono text-slate-400">{filePath}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">Ctrl + S 快速保存</span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cosmo-accent to-cosmo-cyan text-cosmo-950 hover:brightness-110 shadow-glow-cyan/20 shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? '正在保存...' : '保存文件'}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-cosmo-750 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Textarea Editor */}
        <div className="flex-1 p-4 bg-cosmo-950 overflow-hidden flex flex-col">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="w-full h-full bg-cosmo-950 text-slate-200 font-mono text-xs p-4 rounded-xl border border-cosmo-800 focus:outline-none focus:border-cosmo-cyan/60 resize-none leading-relaxed"
            placeholder="正在加载文件内容..."
          />
        </div>
      </div>
    </div>
  );
};
