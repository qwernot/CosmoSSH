import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Edit3 } from 'lucide-react';

interface InputDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const InputDialog: React.FC<InputDialogProps> = ({
  isOpen,
  title,
  description,
  placeholder,
  defaultValue = '',
  confirmText = '确定',
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-cosmo-900 border border-cosmo-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="px-5 py-4 border-b border-cosmo-800 flex items-center justify-between bg-cosmo-950/60">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-cosmo-cyan" />
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-cosmo-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {description && <p className="text-xs text-slate-400">{description}</p>}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan"
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-cosmo-800 hover:bg-cosmo-750 text-slate-300 border border-cosmo-700 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cosmo-accent to-cosmo-cyan text-cosmo-950 hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer"
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确定',
  danger = true,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-cosmo-900 border border-cosmo-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="px-5 py-4 border-b border-cosmo-800 flex items-center justify-between bg-cosmo-950/60">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${danger ? 'text-rose-400' : 'text-amber-400'}`} />
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-cosmo-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{message}</p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-cosmo-800 hover:bg-cosmo-750 text-slate-300 border border-cosmo-700 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                danger
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-gradient-to-r from-cosmo-accent to-cosmo-cyan text-cosmo-950 hover:brightness-110'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
