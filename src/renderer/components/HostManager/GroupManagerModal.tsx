import React, { useState } from 'react';
import { X, Plus, Trash2, Edit3, Check, Layers, AlertCircle } from 'lucide-react';
import { HostGroup, HostConfig } from '@shared/types';

interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: HostGroup[];
  hosts: HostConfig[];
  onSaveGroups: (groups: HostGroup[]) => void;
  onDeleteGroup?: (groupId: string) => void;
}

const PRESET_COLORS = [
  '#4facfe', // Electric Blue
  '#00f2fe', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#6366f1', // Indigo
];

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  isOpen,
  onClose,
  groups,
  hosts,
  onSaveGroups,
  onDeleteGroup,
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(PRESET_COLORS[0]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  if (!isOpen) return null;

  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;

    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      alert('已存在同名分组，请使用其他名称');
      return;
    }

    const newGroup: HostGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      color: newGroupColor,
    };

    onSaveGroups([...groups, newGroup]);
    setNewGroupName('');
    setNewGroupColor(PRESET_COLORS[(groups.length + 1) % PRESET_COLORS.length]);
  };

  const startEdit = (group: HostGroup) => {
    setEditingGroupId(group.id);
    setEditName(group.name);
    setEditColor(group.color || PRESET_COLORS[0]);
  };

  const saveEdit = (groupId: string) => {
    const name = editName.trim();
    if (!name) return;

    const updated = groups.map((g) =>
      g.id === groupId ? { ...g, name, color: editColor } : g
    );
    onSaveGroups(updated);
    setEditingGroupId(null);
  };

  const handleDelete = (groupId: string, groupName: string) => {
    if (groups.length <= 1) {
      alert('至少需要保留一个分组，无法全部删除');
      return;
    }

    const assignedHosts = hosts.filter((h) => h.groupId === groupId);
    const confirmMsg =
      assignedHosts.length > 0
        ? `确定要删除分组“${groupName}”吗？\n当前属于该分组的 ${assignedHosts.length} 台服务器将自动转移至其他分组。`
        : `确定要删除分组“${groupName}”吗？`;

    if (!window.confirm(confirmMsg)) return;

    if (onDeleteGroup) {
      onDeleteGroup(groupId);
    } else {
      const remaining = groups.filter((g) => g.id !== groupId);
      onSaveGroups(remaining);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-cosmo-900 border border-cosmo-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-cosmo-800 flex items-center justify-between bg-cosmo-850/60">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-cosmo-cyan" />
            <h2 className="text-base font-bold text-slate-100">自定义服务器分组管理</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-cosmo-700/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Add New Group Form */}
          <form onSubmit={handleAddGroup} className="bg-cosmo-950 p-4 rounded-xl border border-cosmo-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-cosmo-cyan" /> 创建新分组
            </h4>

            <div className="flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="输入分组名称（例如：数据库集群、测试节点...）"
                className="flex-1 bg-cosmo-900 border border-cosmo-700 rounded-xl px-3.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan"
                required
              />
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cosmo-accent to-cosmo-cyan text-cosmo-950 hover:brightness-110 shadow-glow-cyan/20 shadow flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> 添加分组
              </button>
            </div>

            {/* Color Palette Selector */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400">选择标识色:</span>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewGroupColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                      newGroupColor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-cosmo-950' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </form>

          {/* Group List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400">已有分组列表 ({groups.length})</h4>

            <div className="space-y-2">
              {groups.map((group) => {
                const count = hosts.filter((h) => h.groupId === group.id).length;
                const isEditing = editingGroupId === group.id;

                if (isEditing) {
                  return (
                    <div
                      key={group.id}
                      className="p-3 bg-cosmo-800/80 border border-cosmo-cyan/40 rounded-xl space-y-2.5 animate-fadeIn"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 bg-cosmo-950 border border-cosmo-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-cosmo-cyan"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(group.id)}
                          className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 cursor-pointer"
                          title="保存修改"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingGroupId(null)}
                          className="p-1.5 rounded-lg bg-cosmo-700 text-slate-300 hover:bg-cosmo-600 cursor-pointer"
                          title="取消"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">颜色:</span>
                        <div className="flex items-center gap-1.5">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditColor(c)}
                              className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                                editColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-60 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={group.id}
                    className="p-3 bg-cosmo-950 border border-cosmo-800 hover:border-cosmo-700 rounded-xl flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: group.color || '#4facfe' }}
                      />
                      <span className="text-xs font-semibold text-slate-200">{group.name}</span>
                      <span className="text-[11px] font-mono text-slate-500 bg-cosmo-900 px-2 py-0.5 rounded-md border border-cosmo-800">
                        {count} 台主机
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(group)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cosmo-cyan hover:bg-cosmo-800 transition-colors cursor-pointer"
                        title="编辑名称与颜色"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(group.id, group.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="删除此分组"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-cosmo-800 flex justify-end bg-cosmo-850/40">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-cosmo-800 hover:bg-cosmo-700 text-slate-200 transition-colors border border-cosmo-700 cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
