import React, { useState, useEffect } from 'react';
import { 
  FolderSync, 
  Folder, 
  File, 
  ArrowUp, 
  Home, 
  RefreshCw, 
  Upload, 
  FolderPlus, 
  FilePlus, 
  Download, 
  Edit3, 
  Trash2, 
  FileCode, 
  Key, 
  Server,
  ArrowRight,
  Shield,
  Clock,
  HardDrive
} from 'lucide-react';
import { HostConfig, SFTPFileItem, TransferQueueItem } from '@shared/types';
import { formatBytes, formatDate, formatPermissions } from '../../utils/format';
import { FileEditorModal } from './FileEditorModal';
import { TransferQueue } from './TransferQueue';

interface SFTPViewProps {
  hosts: HostConfig[];
  initialHost?: HostConfig | null;
}

export const SFTPView: React.FC<SFTPViewProps> = ({ hosts, initialHost }) => {
  const [selectedHostId, setSelectedHostId] = useState<string>(initialHost?.id || hosts[0]?.id || '');
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [pathInput, setPathInput] = useState<string>('/');
  const [files, setFiles] = useState<SFTPFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor Modal
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);

  // Transfer Queue
  const [transfers, setTransfers] = useState<TransferQueueItem[]>([]);
  const [isQueueOpen, setIsQueueOpen] = useState(true);

  const selectedHost = hosts.find((h) => h.id === selectedHostId) || initialHost;

  useEffect(() => {
    if (initialHost) {
      setSelectedHostId(initialHost.id);
    }
  }, [initialHost]);

  useEffect(() => {
    if (selectedHost) {
      loadDirectory(currentPath);
    }
  }, [selectedHostId]);

  const sessionId = selectedHost ? `sftp_${selectedHost.id}` : '';

  const loadDirectory = async (targetPath: string) => {
    if (!selectedHost) return;
    setLoading(true);
    setError(null);

    try {
      const res = await window.cosmossh.sftp.list(sessionId, selectedHost, targetPath);
      if (res.success && res.data) {
        setCurrentPath(res.data.path);
        setPathInput(res.data.path);
        setFiles(res.data.files);
      } else {
        setError(res.error || '无法读取目录');
      }
    } catch (err: any) {
      setError(err.message || '连接 SFTP 异常');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (newPath: string) => {
    loadDirectory(newPath);
  };

  const handleGoUp = () => {
    if (currentPath === '/' || currentPath === '') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = '/' + parts.join('/');
    loadDirectory(upPath);
  };

  const handleOpenFileOrDir = async (item: SFTPFileItem) => {
    const fullPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;

    if (item.type === 'd') {
      handleNavigate(fullPath);
    } else {
      // Open text editor for file
      setEditorLoading(true);
      try {
        const res = await window.cosmossh.sftp.readFile(sessionId, selectedHost!, fullPath);
        if (res.success && res.content !== undefined) {
          setEditingFile({ path: fullPath, content: res.content });
        } else {
          alert('无法打开文件：' + (res.error || '可能是二进制文件或权限不足'));
        }
      } catch (err: any) {
        alert('读取文件失败: ' + err.message);
      } finally {
        setEditorLoading(false);
      }
    }
  };

  const handleSaveEditedFile = async (newContent: string) => {
    if (!editingFile || !selectedHost) return;
    const res = await window.cosmossh.sftp.writeFile(sessionId, selectedHost, editingFile.path, newContent);
    if (!res.success) {
      throw new Error(res.error || '保存失败');
    }
    loadDirectory(currentPath);
  };

  const handleUpload = async () => {
    if (!selectedHost) return;
    const filePaths = await window.cosmossh.dialog.selectUploadFiles();
    if (!filePaths || filePaths.length === 0) return;

    for (const localPath of filePaths) {
      const filename = localPath.split(/[\/\\]/).pop() || 'upload';
      const remotePath = currentPath === '/' ? `/${filename}` : `${currentPath}/${filename}`;
      const transferId = `trans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const newItem: TransferQueueItem = {
        id: transferId,
        type: 'upload',
        localPath,
        remotePath,
        filename,
        totalSize: 100, // will update
        transferredSize: 0,
        status: 'transferring',
      };

      setTransfers((prev) => [newItem, ...prev]);

      const cleanup = window.cosmossh.sftp.onProgress(transferId, ({ transferred, total }) => {
        setTransfers((prev) =>
          prev.map((t) => (t.id === transferId ? { ...t, transferredSize: transferred, totalSize: total } : t))
        );
      });

      try {
        const res = await window.cosmossh.sftp.upload(transferId, sessionId, selectedHost, localPath, remotePath);
        cleanup();
        if (res.success) {
          setTransfers((prev) =>
            prev.map((t) => (t.id === transferId ? { ...t, status: 'completed' } : t))
          );
          loadDirectory(currentPath);
        } else {
          setTransfers((prev) =>
            prev.map((t) => (t.id === transferId ? { ...t, status: 'failed', error: res.error } : t))
          );
        }
      } catch (err: any) {
        cleanup();
        setTransfers((prev) =>
          prev.map((t) => (t.id === transferId ? { ...t, status: 'failed', error: err.message } : t))
        );
      }
    }
  };

  const handleDownload = async (item: SFTPFileItem) => {
    if (!selectedHost) return;
    const remotePath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
    const localPath = await window.cosmossh.dialog.selectDownloadLocation(item.name);
    if (!localPath) return;

    const transferId = `trans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newItem: TransferQueueItem = {
      id: transferId,
      type: 'download',
      localPath,
      remotePath,
      filename: item.name,
      totalSize: item.size || 100,
      transferredSize: 0,
      status: 'transferring',
    };

    setTransfers((prev) => [newItem, ...prev]);

    const cleanup = window.cosmossh.sftp.onProgress(transferId, ({ transferred, total }) => {
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? { ...t, transferredSize: transferred, totalSize: total } : t))
      );
    });

    try {
      const res = await window.cosmossh.sftp.download(transferId, sessionId, selectedHost, remotePath, localPath);
      cleanup();
      if (res.success) {
        setTransfers((prev) =>
          prev.map((t) => (t.id === transferId ? { ...t, status: 'completed' } : t))
        );
      } else {
        setTransfers((prev) =>
          prev.map((t) => (t.id === transferId ? { ...t, status: 'failed', error: res.error } : t))
        );
      }
    } catch (err: any) {
      cleanup();
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? { ...t, status: 'failed', error: err.message } : t))
      );
    }
  };

  const handleDelete = async (item: SFTPFileItem) => {
    if (!selectedHost) return;
    const isDir = item.type === 'd';
    if (!confirm(`确定要删除 ${isDir ? '目录' : '文件'} "${item.name}" 吗？此操作无法撤销。`)) return;

    const fullPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
    try {
      const res = await window.cosmossh.sftp.delete(sessionId, selectedHost, fullPath, isDir);
      if (res.success) {
        loadDirectory(currentPath);
      } else {
        alert('删除失败: ' + res.error);
      }
    } catch (err: any) {
      alert('删除失败: ' + err.message);
    }
  };

  const handleMkdir = async () => {
    if (!selectedHost) return;
    const folderName = prompt('请输入新目录名称:');
    if (!folderName || !folderName.trim()) return;

    const fullPath = currentPath === '/' ? `/${folderName.trim()}` : `${currentPath}/${folderName.trim()}`;
    try {
      const res = await window.cosmossh.sftp.mkdir(sessionId, selectedHost, fullPath);
      if (res.success) {
        loadDirectory(currentPath);
      } else {
        alert('创建目录失败: ' + res.error);
      }
    } catch (err: any) {
      alert('创建目录失败: ' + err.message);
    }
  };

  const handleNewFile = async () => {
    if (!selectedHost) return;
    const fileName = prompt('请输入新文件名称 (例: test.txt 或 config.json):');
    if (!fileName || !fileName.trim()) return;

    const fullPath = currentPath === '/' ? `/${fileName.trim()}` : `${currentPath}/${fileName.trim()}`;
    try {
      const res = await window.cosmossh.sftp.writeFile(sessionId, selectedHost, fullPath, '');
      if (res.success) {
        loadDirectory(currentPath);
        // Open in editor directly
        setEditingFile({ path: fullPath, content: '' });
      } else {
        alert('创建文件失败: ' + res.error);
      }
    } catch (err: any) {
      alert('创建文件失败: ' + err.message);
    }
  };

  const handleRename = async (item: SFTPFileItem) => {
    if (!selectedHost) return;
    const newName = prompt('请输入新名称:', item.name);
    if (!newName || newName.trim() === item.name) return;

    const oldPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
    const newPath = currentPath === '/' ? `/${newName.trim()}` : `${currentPath}/${newName.trim()}`;

    try {
      const res = await window.cosmossh.sftp.rename(sessionId, selectedHost, oldPath, newPath);
      if (res.success) {
        loadDirectory(currentPath);
      } else {
        alert('重命名失败: ' + res.error);
      }
    } catch (err: any) {
      alert('重命名失败: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-cosmo-950 overflow-hidden">
      {/* Top Bar: Host Selector & Connection Status */}
      <header className="h-16 px-6 border-b border-cosmo-800 flex items-center justify-between shrink-0 bg-cosmo-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <FolderSync className="w-5 h-5 text-cosmo-cyan" />
          <h2 className="text-base font-bold text-slate-100">SFTP 远程文件传输</h2>

          {/* Host Selector */}
          <div className="ml-4 flex items-center gap-2">
            <span className="text-xs text-slate-400">目标服务器:</span>
            <select
              value={selectedHostId}
              onChange={(e) => {
                setSelectedHostId(e.target.value);
                setCurrentPath('/');
              }}
              className="bg-cosmo-950 border border-cosmo-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cosmo-cyan"
            >
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.host})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedHost && (
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{selectedHost.username}@{selectedHost.host}:{selectedHost.port}</span>
          </div>
        )}
      </header>

      {/* Navigation Path & Action Bar */}
      <div className="p-4 bg-cosmo-900 border-b border-cosmo-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Breadcrumb / Path Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[300px]">
          <button
            onClick={handleGoUp}
            disabled={currentPath === '/'}
            className="p-1.5 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-300 disabled:opacity-40 transition-colors"
            title="返回上一级"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleNavigate('/')}
            className="p-1.5 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-300 transition-colors"
            title="根目录 /"
          >
            <Home className="w-4 h-4" />
          </button>

          {/* Path Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleNavigate(pathInput);
            }}
            className="flex-1 flex items-center"
          >
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cosmo-cyan"
              placeholder="/var/log..."
            />
          </form>

          <button
            onClick={() => loadDirectory(currentPath)}
            className="p-1.5 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-300 transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpload}
            className="px-3 py-1.5 rounded-xl bg-cosmo-800 hover:bg-cosmo-700 text-cosmo-cyan text-xs font-semibold flex items-center gap-1.5 border border-cosmo-cyan/30 shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" /> 上传文件
          </button>
          <button
            onClick={handleMkdir}
            className="px-3 py-1.5 rounded-xl bg-cosmo-850 hover:bg-cosmo-750 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-cosmo-700"
          >
            <FolderPlus className="w-3.5 h-3.5" /> 新建文件夹
          </button>
          <button
            onClick={handleNewFile}
            className="px-3 py-1.5 rounded-xl bg-cosmo-850 hover:bg-cosmo-750 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-cosmo-700"
          >
            <FilePlus className="w-3.5 h-3.5" /> 新建文件
          </button>
        </div>
      </div>

      {/* File List Table */}
      <div className="flex-1 overflow-y-auto p-4">
        {error ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-cosmo-900/30 rounded-2xl border border-dashed border-rose-500/30">
            <p className="text-sm font-semibold text-rose-400 mb-2">连接或读取目录失败</p>
            <p className="text-xs text-slate-500 mb-4">{error}</p>
            <button
              onClick={() => loadDirectory(currentPath)}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-cosmo-800 hover:bg-cosmo-700 text-slate-200"
            >
              重试
            </button>
          </div>
        ) : (
          <div className="bg-cosmo-900 rounded-2xl border border-cosmo-800 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cosmo-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-cosmo-850/60">
                  <th className="py-3 px-4">文件名</th>
                  <th className="py-3 px-4 w-28">大小</th>
                  <th className="py-3 px-4 w-32">权限</th>
                  <th className="py-3 px-4 w-44">修改时间</th>
                  <th className="py-3 px-4 w-32 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cosmo-800/60 text-xs text-slate-300 font-mono">
                {files.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                      空目录
                    </td>
                  </tr>
                )}
                {files.map((item) => {
                  const isDir = item.type === 'd';
                  return (
                    <tr
                      key={item.name}
                      onDoubleClick={() => handleOpenFileOrDir(item)}
                      className="hover:bg-cosmo-800/50 cursor-pointer transition-colors group select-none"
                    >
                      <td className="py-2.5 px-4 flex items-center gap-2.5">
                        {isDir ? (
                          <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <File className="w-4 h-4 text-cosmo-cyan shrink-0" />
                        )}
                        <span className={`truncate max-w-md ${isDir ? 'font-semibold text-slate-100' : 'text-slate-300'}`}>
                          {item.name}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-slate-400">
                        {isDir ? '-' : formatBytes(item.size)}
                      </td>

                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                        {item.modeStr || formatPermissions(item.permissions)}
                      </td>

                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                        {formatDate(item.modifyTime)}
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                          {!isDir && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenFileOrDir(item);
                              }}
                              className="p-1 rounded hover:bg-cosmo-700 text-slate-300 hover:text-cosmo-cyan"
                              title="在线查看与编辑"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(item);
                            }}
                            className="p-1 rounded hover:bg-cosmo-700 text-slate-300 hover:text-emerald-400"
                            title="下载到本地"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRename(item);
                            }}
                            className="p-1 rounded hover:bg-cosmo-700 text-slate-300 hover:text-amber-400"
                            title="重命名"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item);
                            }}
                            className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
                            title="删除"
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

      {/* Remote File Editor Modal */}
      {editingFile && (
        <FileEditorModal
          isOpen={true}
          filePath={editingFile.path}
          initialContent={editingFile.content}
          onClose={() => setEditingFile(null)}
          onSave={handleSaveEditedFile}
        />
      )}

      {/* Transfer Queue Monitor */}
      <TransferQueue
        transfers={transfers}
        isOpen={isQueueOpen}
        onToggleOpen={() => setIsQueueOpen(!isQueueOpen)}
        onClearCompleted={() => setTransfers((prev) => prev.filter((t) => t.status !== 'completed'))}
      />
    </div>
  );
};
