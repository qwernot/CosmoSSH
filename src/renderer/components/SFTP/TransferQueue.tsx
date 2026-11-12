import React from 'react';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  FolderSync,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { TransferQueueItem } from '@shared/types';
import { formatBytes } from '../../utils/format';

interface TransferQueueProps {
  transfers: TransferQueueItem[];
  onClearCompleted: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const TransferQueue: React.FC<TransferQueueProps> = ({
  transfers,
  onClearCompleted,
  isOpen,
  onToggleOpen,
}) => {
  if (transfers.length === 0) return null;

  const activeCount = transfers.filter((t) => t.status === 'transferring' || t.status === 'pending').length;

  return (
    <div className="fixed bottom-4 right-6 z-40 w-96 bg-cosmo-900 border border-cosmo-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div
        onClick={onToggleOpen}
        className="px-4 py-2.5 bg-cosmo-850 flex items-center justify-between cursor-pointer hover:bg-cosmo-800 transition-colors border-b border-cosmo-800"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <FolderSync className="w-4 h-4 text-cosmo-cyan animate-spin" />
          <span>文件传输队列 ({transfers.length})</span>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-cosmo-cyan/20 text-cosmo-cyan text-[10px]">
              {activeCount} 个正在进行
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* List */}
      {isOpen && (
        <div className="max-h-60 overflow-y-auto p-3 space-y-2 bg-cosmo-950">
          {transfers.map((item) => {
            const percent = item.totalSize > 0 ? Math.min(100, Math.round((item.transferredSize / item.totalSize) * 100)) : 0;
            return (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-cosmo-900 border border-cosmo-800 text-xs flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate max-w-[200px]">
                    {item.type === 'upload' ? (
                      <ArrowUpCircle className="w-4 h-4 text-cosmo-cyan shrink-0" />
                    ) : (
                      <ArrowDownCircle className="w-4 h-4 text-cosmo-accent shrink-0" />
                    )}
                    <span className="font-medium text-slate-200 truncate">{item.filename}</span>
                  </div>

                  <div>
                    {item.status === 'completed' && (
                      <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 已完成
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="text-rose-400 flex items-center gap-1 text-[11px]" title={item.error}>
                        <AlertCircle className="w-3.5 h-3.5" /> 失败
                      </span>
                    )}
                    {item.status === 'transferring' && (
                      <span className="text-cosmo-cyan font-mono text-[11px]">{percent}%</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-cosmo-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      item.status === 'completed'
                        ? 'bg-emerald-400'
                        : item.status === 'failed'
                        ? 'bg-rose-500'
                        : 'bg-cosmo-cyan'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>
                    {formatBytes(item.transferredSize)} / {formatBytes(item.totalSize)}
                  </span>
                  <span>{item.type === 'upload' ? '上传' : '下载'}</span>
                </div>
              </div>
            );
          })}

          <div className="pt-1 flex justify-end">
            <button
              onClick={onClearCompleted}
              className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline"
            >
              清除已完成记录
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
