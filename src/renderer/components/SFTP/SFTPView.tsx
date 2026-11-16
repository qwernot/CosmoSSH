import React, { useState, useEffect, useRef } from 'react';
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
  Monitor,
  Columns,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { HostConfig, SFTPFileItem, TransferQueueItem } from '@shared/types';
import { formatBytes, formatDate, formatPermissions } from '../../utils/format';
import { FileEditorModal } from './FileEditorModal';
import { TransferQueue } from './TransferQueue';
import { LocalFilePane } from './LocalFilePane';

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

  // WinSCP Dual-Pane Mode
  const [isDualPane, setIsDualPane] = useState<boolean>(true);
  const [localPath, setLocalPath] = useState<string>('');
  const [specialDirs, setSpecialDirs] = useState<{ desktop: string; downloads: string; home: string }>({
    desktop: '',
    downloads: '',
    home: '',
  });

  // Drag & Drop State (Desktop Drag-in & Local Pane Drag-in)
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

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
    // Load local special dirs for quick download buttons
    window.cosmossh.localFs.getSpecialDirs().then((dirs) => {
      setSpecialDirs(dirs);
      if (dirs.desktop && !localPath) {
        setLocalPath(dirs.desktop);
      }
    }).catch(console.error);
  }, []);

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

  const uploadLocalFiles = async (filePaths: string[], targetDirPath: string = currentPath) => {
    if (!selectedHost || !filePaths || filePaths.length === 0) return;

    for (const localFilePath of filePaths) {
      const filename = localFilePath.split(/[\/\\]/).pop() || 'upload';
      const remotePath = targetDirPath === '/' ? `/${filename}` : `${targetDirPath}/${filename}`;
      const transferId = `trans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const newItem: TransferQueueItem = {
        id: transferId,
        type: 'upload',
        localPath: localFilePath,
        remotePath,
        filename,
        totalSize: 100,
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
        const res = await window.cosmossh.sftp.upload(transferId, sessionId, selectedHost, localFilePath, remotePath);
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

  const handleUpload = async () => {
    if (!selectedHost) return;
    const filePaths = await window.cosmossh.dialog.selectUploadFiles();
    if (filePaths && filePaths.length > 0) {
      await uploadLocalFiles(filePaths, currentPath);
    }
  };

  // Drag & Drop Handlers (Drag from Desktop/File Manager or LocalFilePane into Remote SFTP Pane)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDraggingOver(true);
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

    // 1. Check if dropped from LocalFilePane (WinSCP mode)
    const localDataStr = e.dataTransfer.getData('application/cosmossh-local-item');
    if (localDataStr) {
      try {
        const localItem = JSON.parse(localDataStr);
        if (localItem.fullPath) {
          await uploadLocalFiles([localItem.fullPath], currentPath);
          return;
        }
      } catch (err) {
        console.error('Failed to parse local drag item:', err);
      }
    }

    // 2. Check if dropped from external OS desktop
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const fileList = Array.from(e.dataTransfer.files);
    const localPaths: string[] = [];

    for (const file of fileList) {
      const p = window.cosmossh.getPathForFile(file);
      if (p) {
        localPaths.push(p);
      }
    }

    if (localPaths.length > 0) {
      await uploadLocalFiles(localPaths, currentPath);
    }
  };

  // Core download logic (supports targetLocalPath directly or prompts user)
  const handleDownload = async (item: SFTPFileItem, customLocalPath?: string) => {
    if (!selectedHost) return;
    const remotePath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;

    let localSavePath = customLocalPath;
    if (!localSavePath) {
      const selected = await window.cosmossh.dialog.selectDownloadLocation(item.name);
      if (!selected) return;
      localSavePath = selected;
    }

    const finalLocalPath = localSavePath || '';
    if (!finalLocalPath) return;

    const transferId = `trans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newItem: TransferQueueItem = {
      id: transferId,
      type: 'download',
      localPath: finalLocalPath,
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
      const res = await window.cosmossh.sftp.download(transferId, sessionId, selectedHost, remotePath, finalLocalPath);
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

  // Quick 1-click Download to Desktop
  const handleQuickDownloadToDesktop = (item: SFTPFileItem) => {
    if (!specialDirs.desktop) {
      handleDownload(item);
      return;
    }
    const isWin = specialDirs.desktop.includes('\\') || /^[a-zA-Z]:/.test(specialDirs.desktop);
    const separator = isWin ? '\\' : '/';
    const targetPath = specialDirs.desktop.endsWith(separator)
      ? `${specialDirs.desktop}${item.name}`
      : `${specialDirs.desktop}${separator}${item.name}`;
    handleDownload(item, targetPath);
  };

  // Quick 1-click Download to Downloads folder
  const handleQuickDownloadToDownloads = (item: SFTPFileItem) => {
    if (!specialDirs.downloads) {
      handleDownload(item);
      return;
    }
    const isWin = specialDirs.downloads.includes('\\') || /^[a-zA-Z]:/.test(specialDirs.downloads);
    const separator = isWin ? '\\' : '/';
    const targetPath = specialDirs.downloads.endsWith(separator)
      ? `${specialDirs.downloads}${item.name}`
      : `${specialDirs.downloads}${separator}${item.name}`;
    handleDownload(item, targetPath);
  };

  // Callback when item dropped from Remote Pane into LocalFilePane
  const handleDownloadFromRemote = (
    remoteItem: { name: string; remotePath: string; isDir: boolean },
    targetLocalDir: string
  ) => {
    const isWin = targetLocalDir.includes('\\') || /^[a-zA-Z]:/.test(targetLocalDir);
    const separator = isWin ? '\\' : '/';
    const targetLocalPath = targetLocalDir.endsWith(separator)
      ? `${targetLocalDir}${remoteItem.name}`
      : `${targetLocalDir}${separator}${remoteItem.name}`;

    const item: SFTPFileItem = {
      name: remoteItem.name,
      type: remoteItem.isDir ? 'd' : '-',
      size: 0,
      modifyTime: Math.floor(Date.now() / 1000),
      accessTime: Math.floor(Date.now() / 1000),
      permissions: 0o644,
    };
    handleDownload(item, targetLocalPath);
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
      {/* Top Bar: Host Selector & WinSCP Dual-Pane Mode Switcher */}
      <header className="h-14 px-5 border-b border-cosmo-800 flex items-center justify-between shrink-0 bg-cosmo-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <FolderSync className="w-5 h-5 text-cosmo-cyan" />
          <h2 className="text-sm font-bold text-slate-100">SFTP 文件传输</h2>

          {/* Host Selector */}
          <div className="ml-3 flex items-center gap-2">
            <span className="text-xs text-slate-400">目标服务器:</span>
            <select
              value={selectedHostId}
              onChange={(e) => {
                setSelectedHostId(e.target.value);
                setCurrentPath('/');
              }}
              className="bg-cosmo-950 border border-cosmo-700 rounded-xl px-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-cosmo-cyan"
            >
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.host})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedHost && (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{selectedHost.username}@{selectedHost.host}:{selectedHost.port}</span>
            </div>
          )}

          {/* Dual-Pane / Single-Pane Toggle */}
          <button
            onClick={() => setIsDualPane(!isDualPane)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border shadow-sm ${
              isDualPane
                ? 'bg-cosmo-cyan/15 text-cosmo-cyan border-cosmo-cyan/40 shadow-glow-cyan/10'
                : 'bg-cosmo-800 text-slate-300 border-cosmo-700 hover:bg-cosmo-750'
            }`}
            title="切换 WinSCP 双栏传输模式 / 单栏远程模式"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{isDualPane ? 'WinSCP 双栏模式 (开启)' : '单栏模式'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: WinSCP Dual-Pane (Left: Local, Right: Remote) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Local PC File System */}
        {isDualPane && (
          <div className="w-1/2 min-w-[340px] flex flex-col h-full">
            <LocalFilePane
              currentPath={localPath}
              onPathChange={setLocalPath}
              onUploadToRemote={uploadLocalFiles}
              onDownloadFromRemote={handleDownloadFromRemote}
            />
          </div>
        )}

        {/* Right Pane: Remote SFTP Server */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-cosmo-950">
          {/* Remote Navigation Path & Action Bar */}
          <div className="p-2.5 bg-cosmo-900 border-b border-cosmo-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Breadcrumb / Path Input */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[260px]">
              <button
                onClick={handleGoUp}
                disabled={currentPath === '/'}
                className="p-1.5 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-300 disabled:opacity-40 transition-colors shrink-0"
                title="返回上一级"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleNavigate('/')}
                className="p-1.5 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-300 transition-colors shrink-0"
                title="根目录 /"
              >
                <Home className="w-3.5 h-3.5" />
              </button>

              {/* Path Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNavigate(pathInput);
                }}
                className="flex-1 flex items-center min-w-0"
              >
                <input
                  type="text"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  className="w-full bg-cosmo-950 border border-cosmo-700 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cosmo-cyan truncate"
                  placeholder="/var/log..."
                />
              </form>

              <button
                onClick={() => loadDirectory(currentPath)}
                className="p-1.5 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-slate-300 transition-colors shrink-0"
                title="刷新远程文件"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleUpload}
                className="px-2.5 py-1 rounded-lg bg-cosmo-800 hover:bg-cosmo-700 text-cosmo-cyan text-xs font-semibold flex items-center gap-1 border border-cosmo-cyan/30 shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" /> 上传
              </button>
              <button
                onClick={handleMkdir}
                className="px-2 py-1 rounded-lg bg-cosmo-850 hover:bg-cosmo-750 text-slate-300 text-xs font-medium flex items-center gap-1 border border-cosmo-700"
              >
                <FolderPlus className="w-3.5 h-3.5" /> 新建文件夹
              </button>
              <button
                onClick={handleNewFile}
                className="px-2 py-1 rounded-lg bg-cosmo-850 hover:bg-cosmo-750 text-slate-300 text-xs font-medium flex items-center gap-1 border border-cosmo-700"
              >
                <FilePlus className="w-3.5 h-3.5" /> 新建文件
              </button>
            </div>
          </div>

          {/* File List Table */}
          <div 
            className="flex-1 overflow-y-auto p-2 relative"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag & Drop Visual Overlay */}
            {isDraggingOver && (
              <div className="absolute inset-2 bg-cosmo-950/90 backdrop-blur-md border-2 border-dashed border-cosmo-cyan rounded-xl flex flex-col items-center justify-center z-40 pointer-events-none shadow-glow-cyan/20 animate-in fade-in duration-150">
                <div className="w-16 h-16 rounded-2xl bg-cosmo-900 border border-cosmo-cyan/40 flex items-center justify-center text-cosmo-cyan shadow-glow-cyan/30 shadow-lg mb-3">
                  <Upload className="w-8 h-8 animate-bounce text-cosmo-cyan" />
                </div>
                <h3 className="text-base font-bold text-slate-100">松开鼠标立即上传至此远程目录</h3>
                <p className="text-xs text-cosmo-cyan font-mono mt-1.5 px-3 py-1 bg-cosmo-900/80 rounded-lg border border-cosmo-800 truncate max-w-sm">
                  {currentPath}
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  ✨ 支持从左侧本地电脑直接拖拽，或从桌面直接拖拽上传
                </p>
              </div>
            )}

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
              <div className="bg-cosmo-900 rounded-xl border border-cosmo-800 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-cosmo-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-cosmo-850/60">
                      <th className="py-2 px-3">文件名 (按住可拖拽至左侧下载)</th>
                      <th className="py-2 px-3 w-20">大小</th>
                      <th className="py-2 px-3 w-24">权限</th>
                      <th className="py-2 px-3 w-28">修改时间</th>
                      <th className="py-2 px-3 w-32 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cosmo-800/60 text-xs text-slate-300 font-mono">
                    {files.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-500 font-sans text-xs">
                          空目录（可从左侧或桌面拖拽文件到此处上传）
                        </td>
                      </tr>
                    )}
                    {files.map((item) => {
                      const isDir = item.type === 'd';
                      return (
                        <tr
                          key={item.name}
                          draggable={true}
                          onDragStart={(e) => {
                            const remotePath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
                            // 1. Set payload for dropping onto LocalFilePane (WinSCP mode)
                            e.dataTransfer.setData(
                              'application/cosmossh-remote-item',
                              JSON.stringify({
                                name: item.name,
                                remotePath,
                                isDir,
                              })
                            );
                            e.dataTransfer.effectAllowed = 'copy';

                            // 2. Also invoke native drag-out for OS desktop if non-dir
                            if (!isDir && selectedHost) {
                              window.cosmossh.sftp.startDrag({
                                sessionId,
                                hostConfig: selectedHost,
                                remotePath,
                                filename: item.name,
                              });
                            }
                          }}
                          onDragOver={(e) => {
                            if (isDir) {
                              e.preventDefault();
                              e.stopPropagation();
                              e.dataTransfer.dropEffect = 'copy';
                            }
                          }}
                          onDrop={async (e) => {
                            if (isDir) {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDraggingOver(false);
                              dragCounter.current = 0;
                              const targetDir = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;

                              // Drop from local pane
                              const localDataStr = e.dataTransfer.getData('application/cosmossh-local-item');
                              if (localDataStr) {
                                try {
                                  const localItem = JSON.parse(localDataStr);
                                  if (localItem.fullPath) {
                                    await uploadLocalFiles([localItem.fullPath], targetDir);
                                    return;
                                  }
                                } catch (err) {}
                              }

                              // Drop from desktop
                              const fileList = Array.from(e.dataTransfer.files);
                              const localPaths = fileList.map((f) => window.cosmossh.getPathForFile(f)).filter(Boolean);
                              if (localPaths.length > 0) {
                                await uploadLocalFiles(localPaths, targetDir);
                              }
                            }
                          }}
                          onDoubleClick={() => handleOpenFileOrDir(item)}
                          className={`hover:bg-cosmo-800/50 cursor-pointer transition-colors group select-none ${
                            !isDir ? 'hover:text-slate-100 cursor-grab active:cursor-grabbing' : ''
                          }`}
                          title={
                            !isDir
                              ? '按住拖动可直接拉到左侧本地目录下载，或点击右侧按钮快速下载至桌面'
                              : '双击进入目录，支持将左侧文件拖拽至此文件夹上传'
                          }
                        >
                          <td className="py-2 px-3 flex items-center gap-2">
                            {isDir ? (
                              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <File className="w-4 h-4 text-cosmo-cyan shrink-0" />
                            )}
                            <span className={`truncate max-w-[200px] ${isDir ? 'font-semibold text-slate-100' : 'text-slate-300'}`}>
                              {item.name}
                            </span>
                          </td>

                          <td className="py-2 px-3 text-slate-400 text-[11px]">
                            {isDir ? '-' : formatBytes(item.size)}
                          </td>

                          <td className="py-2 px-3 text-slate-400 text-[10px]">
                            {item.modeStr || formatPermissions(item.permissions)}
                          </td>

                          <td className="py-2 px-3 text-slate-400 text-[10px]">
                            {formatDate(item.modifyTime)}
                          </td>

                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-30 group-hover:opacity-100 transition-opacity">
                              {!isDir && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuickDownloadToDesktop(item);
                                    }}
                                    className="p-1 rounded hover:bg-cosmo-700 text-slate-300 hover:text-emerald-400"
                                    title="📥 一键快速下载到桌面"
                                  >
                                    <Monitor className="w-3.5 h-3.5" />
                                  </button>
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
                                </>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(item);
                                }}
                                className="p-1 rounded hover:bg-cosmo-700 text-slate-300 hover:text-emerald-400"
                                title="选择目录下载"
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
        </div>
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
