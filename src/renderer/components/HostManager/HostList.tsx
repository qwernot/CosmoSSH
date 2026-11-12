import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Terminal, 
  FolderSync, 
  MoreVertical, 
  Edit3, 
  Copy, 
  Trash2, 
  Server, 
  ShieldCheck, 
  Key, 
  Lock, 
  Tag, 
  ExternalLink, 
  Activity, 
  RefreshCw,
  Layers,
  FolderPlus
} from 'lucide-react';
import { HostConfig, HostGroup } from '@shared/types';
import { HostModal } from './HostModal';
import { GroupManagerModal } from './GroupManagerModal';

interface HostListProps {
  hosts: HostConfig[];
  groups: HostGroup[];
  onSaveHost: (host: HostConfig) => void;
  onDeleteHost: (id: string) => void;
  onSaveGroups: (groups: HostGroup[]) => void;
  onDeleteGroup?: (groupId: string) => void;
  onConnectSSH: (host: HostConfig) => void;
  onOpenSFTP: (host: HostConfig) => void;
}

export const HostList: React.FC<HostListProps> = ({
  hosts,
  groups,
  onSaveHost,
  onDeleteHost,
  onSaveGroups,
  onDeleteGroup,
  onConnectSSH,
  onOpenSFTP,
}) => {
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostConfig | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [latencies, setLatencies] = useState<Record<string, { latency?: number; loading?: boolean; error?: string }>>({});
  const [pingingAll, setPingingAll] = useState(false);

  const pingSingleHost = async (host: HostConfig) => {
    setLatencies((prev) => ({
      ...prev,
      [host.id]: { loading: true },
    }));

    try {
      const res = await window.cosmossh.network.pingHost(host.host, host.port || 22);
      if (res && res.success && res.latency !== undefined) {
        setLatencies((prev) => ({
          ...prev,
          [host.id]: { latency: res.latency, loading: false },
        }));
      } else {
        setLatencies((prev) => ({
          ...prev,
          [host.id]: { error: res?.error || '超时', loading: false },
        }));
      }
    } catch (e: any) {
      setLatencies((prev) => ({
        ...prev,
        [host.id]: { error: '不可达', loading: false },
      }));
    }
  };

  const pingAllHosts = async () => {
    if (pingingAll || hosts.length === 0) return;
    setPingingAll(true);
    await Promise.all(hosts.map((h) => pingSingleHost(h)));
    setPingingAll(false);
  };

  useEffect(() => {
    if (hosts.length > 0) {
      pingAllHosts();
    }
  }, [hosts.length]);

  const filteredHosts = hosts.filter((h) => {
    const matchesSearch =
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.host.toLowerCase().includes(search.toLowerCase()) ||
      h.username.toLowerCase().includes(search.toLowerCase()) ||
      h.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesGroup = selectedGroup === 'all' || h.groupId === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const handleEdit = (host: HostConfig) => {
    setEditingHost(host);
    setIsModalOpen(true);
    setMenuOpenId(null);
  };

  const handleDuplicate = (host: HostConfig) => {
    const duplicated: HostConfig = {
      ...host,
      id: `host_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${host.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSaveHost(duplicated);
    setMenuOpenId(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`确定要删除服务器 "${name}" 吗？此操作无法撤销。`)) {
      onDeleteHost(id);
    }
    setMenuOpenId(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-cosmo-950 overflow-hidden" onClick={() => setMenuOpenId(null)}>
      {/* Top Header Bar */}
      <header className="h-16 px-6 border-b border-cosmo-800/80 flex items-center justify-between shrink-0 bg-cosmo-900/60 backdrop-blur">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-cosmo-cyan" /> 主机资产列表
          </h2>
          <p className="text-xs text-cosmo-500">共计 {hosts.length} 台服务器资产</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-cosmo-800 hover:bg-cosmo-750 text-slate-200 border border-cosmo-700/80 flex items-center gap-1.5 transition-all cursor-pointer"
            title="自定义分组管理（添加/重命名/修改颜色/删除分组）"
          >
            <Layers className="w-3.5 h-3.5 text-cosmo-accent" />
            <span>分组管理</span>
          </button>

          <button
            onClick={pingAllHosts}
            disabled={pingingAll}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-cosmo-800 hover:bg-cosmo-750 text-slate-200 border border-cosmo-700/80 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="测试所有服务器的连接延迟"
          >
            <Activity className={`w-3.5 h-3.5 text-cosmo-cyan ${pingingAll ? 'animate-pulse' : ''}`} />
            <span>{pingingAll ? '测速中...' : '测速刷新'}</span>
          </button>

          <button
            onClick={() => {
              setEditingHost(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cosmo-accent to-cosmo-cyan text-cosmo-950 hover:brightness-110 shadow-glow-cyan/20 shadow flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> 新增服务器
          </button>
        </div>
      </header>

      {/* Filter & Search Bar */}
      <div className="p-6 pb-2 space-y-4 shrink-0">
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索服务器名称、IP、端口、用户名或标签..."
              className="w-full bg-cosmo-900 border border-cosmo-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan transition-all"
            />
          </div>

          {/* Group Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <button
              onClick={() => setSelectedGroup('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedGroup === 'all'
                  ? 'bg-cosmo-800 text-cosmo-cyan border border-cosmo-cyan/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-cosmo-900'
              }`}
            >
              全部 ({hosts.length})
            </button>
            {groups.map((g) => {
              const count = hosts.filter((h) => h.groupId === g.id).length;
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroup(g.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                    selectedGroup === g.id
                      ? 'bg-cosmo-800 text-cosmo-cyan border border-cosmo-cyan/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-cosmo-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color || '#4facfe' }} />
                  {g.name} ({count})
                </button>
              );
            })}
            <button
              onClick={() => setIsGroupModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-cosmo-cyan hover:bg-cosmo-850 transition-all flex items-center gap-1 cursor-pointer shrink-0 border border-dashed border-cosmo-800 hover:border-cosmo-cyan/40"
              title="添加或管理自定义分组"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>新建/管理</span>
            </button>
          </div>
        </div>
      </div>

      {/* Host Cards Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        {filteredHosts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-cosmo-800 rounded-2xl p-8 text-center bg-cosmo-900/20">
            <Server className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-sm font-semibold text-slate-300 mb-1">
              {search ? '未找到符合条件的服务器' : '还没有添加任何服务器'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {search ? '尝试更换搜索关键词或筛选分组' : '点击上方“新增服务器”开始配置您的第一台远程主机'}
            </p>
            {!search && (
              <button
                onClick={() => {
                  setEditingHost(null);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-cosmo-800 hover:bg-cosmo-700 text-cosmo-cyan border border-cosmo-cyan/30 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> 立即添加
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHosts.map((host) => {
              const group = groups.find((g) => g.id === host.groupId);
              const latInfo = latencies[host.id];
              return (
                <div
                  key={host.id}
                  className="bg-cosmo-900 border border-cosmo-800 hover:border-cosmo-700/80 rounded-2xl p-5 transition-all duration-200 hover:shadow-xl hover:shadow-black/40 flex flex-col justify-between group relative"
                >
                  {/* Top Bar */}
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
                          style={{
                            backgroundColor: host.color || '#4facfe',
                            boxShadow: `0 4px 14px -2px ${host.color || '#4facfe'}40`,
                          }}
                        >
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-100 text-sm group-hover:text-cosmo-cyan transition-colors">
                            {host.name}
                          </h3>
                          <p className="text-xs font-mono text-slate-400">
                            {host.username}@{host.host}:{host.port}
                          </p>
                        </div>
                      </div>

                      {/* Options Menu Button */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === host.id ? null : host.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cosmo-800 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {menuOpenId === host.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-8 z-30 w-36 bg-cosmo-850 border border-cosmo-700 rounded-xl shadow-2xl py-1 text-xs"
                          >
                            <button
                              onClick={() => handleEdit(host)}
                              className="w-full px-3 py-2 text-left text-slate-300 hover:bg-cosmo-750 flex items-center gap-2 hover:text-white"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-cosmo-cyan" /> 编辑配置
                            </button>
                            <button
                              onClick={() => handleDuplicate(host)}
                              className="w-full px-3 py-2 text-left text-slate-300 hover:bg-cosmo-750 flex items-center gap-2 hover:text-white"
                            >
                              <Copy className="w-3.5 h-3.5 text-cosmo-accent" /> 复制配置
                            </button>
                            <div className="my-1 border-t border-cosmo-700/60" />
                            <button
                              onClick={() => handleDelete(host.id, host.name)}
                              className="w-full px-3 py-2 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> 删除主机
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {/* Latency Pill */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          pingSingleHost(host);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-cosmo-950 text-[11px] border border-cosmo-800 hover:border-cosmo-700 flex items-center gap-1.5 transition-colors cursor-pointer group/ping"
                        title="点击重新测速此服务器"
                      >
                        {latInfo?.loading ? (
                          <>
                            <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
                            <span className="text-slate-400 font-mono">测速中...</span>
                          </>
                        ) : latInfo?.latency !== undefined ? (
                          <>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                latInfo.latency < 80
                                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                                  : latInfo.latency < 200
                                  ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                                  : 'bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                              }`}
                            />
                            <span
                              className={`font-mono font-medium ${
                                latInfo.latency < 80
                                  ? 'text-emerald-400'
                                  : latInfo.latency < 200
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {latInfo.latency} ms
                            </span>
                          </>
                        ) : latInfo?.error ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span className="text-rose-400 font-mono text-[10px]">{latInfo.error}</span>
                          </>
                        ) : (
                          <>
                            <Activity className="w-3 h-3 text-slate-500 group-hover/ping:text-cosmo-cyan transition-colors" />
                            <span className="text-slate-500 group-hover/ping:text-slate-300 font-mono">测速</span>
                          </>
                        )}
                      </button>

                      {group && (
                        <span className="px-2 py-0.5 rounded-lg bg-cosmo-950 text-slate-300 text-[11px] border border-cosmo-800 flex items-center gap-1 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: group.color }} />
                          {group.name}
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-lg bg-cosmo-950 text-slate-400 text-[11px] border border-cosmo-800 flex items-center gap-1 font-mono">
                        {host.authType === 'password' ? (
                          <>
                            <Lock className="w-3 h-3 text-amber-400" /> 密码认证
                          </>
                        ) : (
                          <>
                            <Key className="w-3 h-3 text-emerald-400" /> 私钥认证
                          </>
                        )}
                      </span>

                      {host.tags.map((t: string) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-lg bg-cosmo-cyan/10 text-cosmo-cyan text-[11px] border border-cosmo-cyan/20"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    {host.notes && (
                      <p className="text-xs text-slate-500 line-clamp-1 italic mb-3">
                        “{host.notes}”
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-cosmo-800/80 flex items-center gap-2">
                    <button
                      onClick={() => onConnectSSH(host)}
                      className="flex-1 py-2 px-3 rounded-xl bg-cosmo-800 hover:bg-cosmo-700 text-cosmo-cyan hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-cosmo-cyan/20 hover:border-cosmo-cyan/50 shadow-sm"
                    >
                      <Terminal className="w-3.5 h-3.5" /> 终端连接
                    </button>
                    <button
                      onClick={() => onOpenSFTP(host)}
                      className="py-2 px-3 rounded-xl bg-cosmo-850 hover:bg-cosmo-750 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all border border-cosmo-700/60"
                      title="打开 SFTP 文件管理器"
                    >
                      <FolderSync className="w-3.5 h-3.5 text-cosmo-accent" /> SFTP
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <HostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onSaveHost}
        editingHost={editingHost}
        groups={groups}
        onSaveGroups={onSaveGroups}
      />

      <GroupManagerModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        groups={groups}
        hosts={hosts}
        onSaveGroups={onSaveGroups}
        onDeleteGroup={onDeleteGroup}
      />
    </div>
  );
};
