import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Folder,
  File,
  ArrowUp,
  Home,
  RefreshCw,
  FolderPlus,
  Upload,
  Trash2,
  ExternalLink,
  Download,
} from 'lucide-react';
import { SFTPFileItem } from '@shared/types';
import { formatBytes, formatDate } from '../../utils/format';
import { InputDialog, ConfirmDialog } from '../Common/DialogModal';

interface LocalFilePaneProps {
  currentPath: string;
  refreshTrigger?: number;
  onPathChange: (newPath: string) => void;
  onUploadToRemote: (localPaths: string[]) => void;
  onDownloadFromRemote: (remoteItem: { name: string; remotePath: string; isDir: boolean }, targetLocalDir: string) => void;
  onNotify?: (type: 'success' | 'error', text: string) => void;
}

export const LocalFilePane: React.FC<LocalFilePaneProps> = ({
  currentPath,
  refreshTrigger = 0,
  onPathChange,
  onUploadToRemote,
  onDownloadFromRemote,
  onNotify,
}) => {
  const [files, setFiles] = useState<SFTPFileItem[]>([]);
  const [pathInput, setPathInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialDirs, setSpecialDirs] = useState<{ desktop: string; downloads: string; home: string }>({
    desktop: '',
    downloads: '',
    home: '',
  });

  // Custom Dialog states (replaces unsupported window.prompt / confirm)
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<SFTPFileItem | null>(null);

  // Drag over state (from remote pane or desktop)
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  // Load special directories on mount
  useEffect(() => {
    window.cosmossh.localFs.getSpecialDirs().then((dirs) => {
      setSpecialDirs(dirs);
      if (!currentPath && dirs.desktop) {
        onPathChange(dirs.desktop);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (currentPath) {
      setPathInput(currentPath);
      loadDirectory(currentPath);
    }
  }, [currentPath, refreshTrigger]);

  const joinLocalPath = (baseDir: string, name: string) => {
    const isWin = baseDir.includes('\\') || /^[a-zA-Z]:/.test(baseDir);
    const separator = isWin ? '\\' : '/';
    return baseDir.endsWith(separator) ? `${baseDir}${name}` : `${baseDir}${separator}${name}`;
  };

  const loadDirectory = async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.cosmossh.localFs.list(dirPath);
      setFiles(res.files);
      if (res.path !== currentPath) {
        onPathChange(res.path);
        setPathInput(res.path);
      }
    } catch (err: any) {
      setError(err.message || '无法读取本地目录');
    } finally {
      setLoading(false);
    }
  };

  const handleGoUp = () => {
    if (!currentPath) return;
    const isWin = currentPath.includes('\\') || /^[a-zA-Z]:/.test(currentPath);
    const separator = isWin ? '\\' : '/';
    const parts = currentPath.split(/[\/\\]/).filter(Boolean);
    if (parts.length <= 1) {
      if (!isWin) onPathChange('/');
      return;
    }
    parts.pop();
    let parentPath = parts.join(separator);
    if (!isWin) {
      parentPath = '/' + parentPath;
    } else if (/^[a-zA-Z]:$/.test(parentPath)) {
      parentPath = parentPath + '\\';
    }
    onPathChange(parentPath);
  };

  const handleOpenFileOrDir = async (item: SFTPFileItem) => {
    const fullPath = joinLocalPath(currentPath, item.name);

    if (item.type === 'd') {
      onPathChange(fullPath);
    } else {
      try {
        const errMsg = await window.cosmossh.localFs.openPath(fullPath);
        if (errMsg && onNotify) {
          onNotify('error', `无法打开文件: ${errMsg}`);
        }
      } catch (e: any) {
        onNotify?.('error', '无法打开文件: ' + e.message);
      }
    }
  };

  const handleConfirmMkdir = async (name: string) => {
    setMkdirOpen(false);
    const newDirPath = joinLocalPath(currentPath, name);
    try {
      await window.cosmossh.localFs.mkdir(newDirPath);
      loadDirectory(currentPath);
      onNotify?.('success', `已创建本地文件夹 "${name}"`);
    } catch (e: any) {
      onNotify?.('error', '创建文件夹失败: ' + e.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    const targetItem = deletingItem;
    setDeletingItem(null);
    const targetPath = joinLocalPath(currentPath, targetItem.name);
    try {
      await window.cosmossh.localFs.delete(targetPath);
      loadDirectory(currentPath);
      onNotify?.('success', `已删除本地项目 "${targetItem.name}"`);
    } catch (e: any) {
      onNotify?.('error', '删除失败: ' + e.message);
    }
  };

  const handleOpenInExplorer = () => {
    if (currentPath) {
      window.cosmossh.localFs.openPath(currentPath);
    }
  };

  // Drag & Drop Handlers (Receiving drops from Remote Pane or OS)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    // Only show download overlay if dragging a remote item
    if (e.dataTransfer.types.includes('application/cosmossh-remote-item')) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    const remoteDataStr = e.dataTransfer.getData('application/cosmossh-remote-item');
    if (remoteDataStr) {
      try {
        const remoteItem = JSON.parse(remoteDataStr);
        onDownloadFromRemote(remoteItem, currentPath);
        return;
      } catch (err) {
        console.error('Failed to parse remote drag data:', err);
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      loadDirectory(currentPath);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-full bg-cosmo-950 border-r border-cosmo-800 overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop Zone Visual Overlay (When dragging from Remote to Local) */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-cosmo-950/90 backdrop-blur-md border-2 border-dashed border-emerald-400 rounded-none z-50 flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <div className="w-16 h-16 rounded-2xl bg-cosmo-900 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-lg mb-3">
            <Download className="w-8 h-8 animate-bounce text-emerald-400" />
          </div>
          <h3 className="text-base font-bold text-slate-100">松开鼠标立即下载到此本地目录</h3>
          <p className="text-xs text-emerald-400 font-mono mt-1.5 px-3 py-1 bg-cosmo-900/80 rounded-lg border border-cosmo-800 truncate max-w-sm">
            {currentPath}
          </p>
          <p className="text-[11px] text-slate-400 mt-2">
            支持文件与文件夹递归下载，完成后自动刷新
          </p>
        </div>
      )}

      {/* Pane Top Bar: Title & Quick Directory Shortcuts */}
      <div className="h-12 px-3 border-b border-cosmo-800 flex items-center justify-between shrink-0 bg-cosmo-900/50">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-200">本地电脑 (WinSCP 左栏)</span>
        </div>

        {/* Quick Jump Shortcuts: Desktop, Downloads, Home */}
        <div className="flex items-center gap-1">
          {specialDirs.desktop && (
            <button
              onClick={() => onPathChange(specialDirs.desktop)}
              className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-emerald-400 hover:bg-cosmo-800 transition-colors flex items-center gap-1 cursor-pointer"
              title={`跳转到桌面: ${specialDirs.desktop}`}
            >
              <Monitor className="w-3 h-3" /> 桌面
            </button>
          )}
          {specialDirs.downloads && (
            <button
              onClick={() => onPathChange(specialDirs.downloads)}
              className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-emerald-400 hover:bg-cosmo-800 transition-colors flex items-center gap-1 cursor-pointer"
              title={`跳转到下载: ${specialDirs.downloads}`}
            >
              <Download className="w-3 h-3" /> 下载
            </button>
          )}
          {specialDirs.home && (
            <button
              onClick={() => onPathChange(specialDirs.home)}
              className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-emerald-400 hover:bg-cosmo-800 transition-colors flex items-center gap-1 cursor-pointer"
              title={`跳转到用户目录: ${specialDirs.home}`}
            >
              <Home className="w-3 h-3" /> 家目录
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb / Path Input & Actions */}
      <div className="p-2.5 bg-cosmo-900 border-b border-cosmo-800 flex items-center gap-2 shrink-0">
        <button
          onClick={handleGoUp}
          className="p-1.5 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-300 transition-colors shrink-0 cursor-pointer"
          title="上一级目录"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pathInput.trim()) {
              onPathChange(pathInput.trim());
            }
          }}
          className="flex-1 flex items-center min-w-0"
        >
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            className="w-full bg-cosmo-950 border border-cosmo-700 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-400 truncate"
            placeholder="本地路径..."
          />
        </form>

        <button
          onClick={() => loadDirectory(currentPath)}
          className="p-1.5 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-300 transition-colors shrink-0 cursor-pointer"
          title="刷新本地文件"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={() => setMkdirOpen(true)}
          className="p-1.5 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-300 transition-colors shrink-0 cursor-pointer"
          title="新建本地文件夹"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleOpenInExplorer}
          className="p-1.5 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-300 transition-colors shrink-0 cursor-pointer"
          title="在系统资源管理器中打开"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* File List Table */}
      <div className="flex-1 overflow-y-auto p-2">
        {error ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 bg-cosmo-900/30 rounded-xl border border-dashed border-rose-500/30">
            <p className="text-xs font-semibold text-rose-400 mb-1">无法读取本地目录</p>
            <p className="text-[11px] text-slate-500 mb-3">{error}</p>
            <button
              onClick={() => specialDirs.desktop && onPathChange(specialDirs.desktop)}
              className="px-3 py-1 rounded-lg text-xs bg-cosmo-800 hover:bg-cosmo-700 text-slate-200 cursor-pointer"
            >
              返回桌面
            </button>
          </div>
        ) : (
          <div className="bg-cosmo-900 rounded-xl border border-cosmo-800 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cosmo-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-cosmo-850/60">
                  <th className="py-2 px-3">名称 (拖拽至右侧上传)</th>
                  <th className="py-2 px-3 w-20">大小</th>
                  <th className="py-2 px-3 w-28">修改时间</th>
                  <th className="py-2 px-3 w-20 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cosmo-800/60 text-xs text-slate-300 font-mono">
                {files.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 font-sans text-xs">
                      空目录
                    </td>
                  </tr>
                )}
                {files.map((item) => {
                  const isDir = item.type === 'd';
                  const fullPath = joinLocalPath(currentPath, item.name);

                  return (
                    <tr
                      key={item.name}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/cosmossh-local-item',
                          JSON.stringify({
                            source: 'local',
                            name: item.name,
                            fullPath,
                            isDir,
                          })
                        );
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onDragOver={(e) => {
                        if (isDir && e.dataTransfer.types.includes('application/cosmossh-remote-item')) {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'copy';
                        }
                      }}
                      onDrop={(e) => {
                        if (isDir) {
                          const remoteDataStr = e.dataTransfer.getData('application/cosmossh-remote-item');
                          if (remoteDataStr) {
                            e.preventDefault();
                            e.stopPropagation();
                            dragCounter.current = 0;
                            setIsDraggingOver(false);
                            try {
                              const remoteItem = JSON.parse(remoteDataStr);
                              onDownloadFromRemote(remoteItem, fullPath);
                            } catch (err) {
                              console.error('Failed to parse remote drag data:', err);
                            }
                          }
                        }
                      }}
                      onDoubleClick={() => handleOpenFileOrDir(item)}
                      className="hover:bg-cosmo-800/50 cursor-pointer transition-colors group select-none hover:text-slate-100"
                      title={
                        isDir
                          ? '双击进入文件夹，按住可拖拽至右侧服务器上传'
                          : '双击在系统中打开，按住拖拽至右侧服务器上传'
                      }
                    >
                      <td className="py-2 px-3 flex items-center gap-2">
                        {isDir ? (
                          <Folder className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <File className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className={`truncate max-w-[180px] ${isDir ? 'font-semibold text-slate-100' : 'text-slate-300'}`}>
                          {item.name}
                        </span>
                      </td>

                      <td className="py-2 px-3 text-slate-400 text-[11px]">
                        {isDir ? '-' : formatBytes(item.size)}
                      </td>

                      <td className="py-2 px-3 text-slate-400 text-[10px]">
                        {formatDate(item.modifyTime)}
                      </td>

                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUploadToRemote([fullPath]);
                            }}
                            className="p-1 rounded hover:bg-cosmo-700 text-slate-300 hover:text-cosmo-cyan cursor-pointer"
                            title="上传到远程服务器"
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingItem(item);
                            }}
                            className="p-1 rounded hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                            title="删除本地文件"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custom Input Dialog: Create Local Folder */}
      <InputDialog
        isOpen={mkdirOpen}
        title="新建本地文件夹"
        description={`将在 ${currentPath} 中创建新目录`}
        placeholder="输入文件夹名称..."
        confirmText="创建"
        onConfirm={handleConfirmMkdir}
        onCancel={() => setMkdirOpen(false)}
      />

      {/* Custom Confirm Dialog: Delete Local File/Dir */}
      <ConfirmDialog
        isOpen={Boolean(deletingItem)}
        title="删除本地项目"
        message={
          deletingItem
            ? `确定要删除本地${deletingItem.type === 'd' ? '文件夹' : '文件'} "${deletingItem.name}" 吗？此操作无法撤销。`
            : ''
        }
        confirmText="确认删除"
        danger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  );
};
