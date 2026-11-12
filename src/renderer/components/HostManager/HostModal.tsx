import React, { useState, useEffect } from 'react';
import { X, Key, Lock, Eye, EyeOff, FileText, Upload, Tag, Folder, Plus } from 'lucide-react';
import { HostConfig, HostGroup, AuthType } from '@shared/types';

interface HostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (host: HostConfig) => void;
  editingHost?: HostConfig | null;
  groups: HostGroup[];
  onSaveGroups?: (groups: HostGroup[]) => void;
}

export const HostModal: React.FC<HostModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingHost,
  groups,
  onSaveGroups,
}) => {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<AuthType>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [groupId, setGroupId] = useState(groups[0]?.id || 'default');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState('#4facfe');
  const [showQuickAddGroup, setShowQuickAddGroup] = useState(false);
  const [quickGroupName, setQuickGroupName] = useState('');

  useEffect(() => {
    if (editingHost) {
      setName(editingHost.name);
      setHost(editingHost.host);
      setPort(editingHost.port || 22);
      setUsername(editingHost.username || 'root');
      setAuthType(editingHost.authType || 'password');
      setPassword(editingHost.password || '');
      setPrivateKey(editingHost.privateKey || '');
      setPassphrase(editingHost.passphrase || '');
      setGroupId(editingHost.groupId || groups[0]?.id || 'default');
      setTags(editingHost.tags || []);
      setNotes(editingHost.notes || '');
      setColor(editingHost.color || '#4facfe');
    } else {
      setName('');
      setHost('');
      setPort(22);
      setUsername('root');
      setAuthType('password');
      setPassword('');
      setPrivateKey('');
      setPassphrase('');
      setGroupId(groups[0]?.id || 'default');
      setTags([]);
      setNotes('');
      setColor('#4facfe');
    }
  }, [editingHost, isOpen, groups]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleImportKey = async () => {
    try {
      const result = await window.cosmossh.dialog.openKeyFile();
      if (result && result.content) {
        setPrivateKey(result.content);
      }
    } catch (e) {
      console.error('Failed to import key:', e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim() || !username.trim()) {
      alert('请完整填写服务器名称、IP/域名及用户名');
      return;
    }

    const newHost: HostConfig = {
      id: editingHost ? editingHost.id : `host_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      host: host.trim(),
      port: Number(port) || 22,
      username: username.trim(),
      authType,
      password: authType === 'password' ? password : undefined,
      privateKey: authType === 'privateKey' ? privateKey : undefined,
      passphrase: authType === 'privateKey' ? passphrase : undefined,
      groupId,
      tags,
      notes,
      color,
      createdAt: editingHost ? editingHost.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    onSave(newHost);
    onClose();
  };

  const colorOptions = ['#4facfe', '#00f2fe', '#7928ca', '#10b981', '#f59e0b', '#f43f5e'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-cosmo-900 border border-cosmo-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-cosmo-800 flex items-center justify-between bg-cosmo-850/60">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <h2 className="text-base font-bold text-slate-100">
              {editingHost ? '编辑服务器配置' : '添加新服务器'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-cosmo-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Server Name & Color */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                服务器别名 <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：香港生产服务器 01"
                className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">标识颜色</label>
              <div className="flex items-center gap-1.5 h-10">
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-all ${
                      color === c ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                主机 IP 或域名 <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="1.2.3.4 或 vps.example.com"
                className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">端口</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                placeholder="22"
                className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan font-mono"
                required
              />
            </div>
          </div>

          {/* Username & Group */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                登录用户名 <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="root"
                className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan font-mono"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">所属分组</label>
                {onSaveGroups && (
                  <button
                    type="button"
                    onClick={() => setShowQuickAddGroup(!showQuickAddGroup)}
                    className="text-[11px] text-cosmo-cyan hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                  >
                    <Plus className="w-3 h-3" /> 新建分组
                  </button>
                )}
              </div>

              {!showQuickAddGroup ? (
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-cosmo-cyan"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={quickGroupName}
                    onChange={(e) => setQuickGroupName(e.target.value)}
                    placeholder="新分组名称"
                    className="flex-1 bg-cosmo-950 border border-cosmo-cyan/60 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = quickGroupName.trim();
                      if (!trimmed) return;
                      const newG: HostGroup = {
                        id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        name: trimmed,
                        color: colorOptions[groups.length % colorOptions.length],
                      };
                      if (onSaveGroups) {
                        onSaveGroups([...groups, newG]);
                      }
                      setGroupId(newG.id);
                      setQuickGroupName('');
                      setShowQuickAddGroup(false);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-cosmo-cyan text-cosmo-950 text-xs font-bold hover:brightness-110 cursor-pointer"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddGroup(false)}
                    className="px-2 py-1.5 rounded-xl bg-cosmo-800 text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Auth Method Tabs */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-300 mb-2">认证方式</label>
            <div className="flex rounded-xl bg-cosmo-950 p-1 border border-cosmo-700">
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                  authType === 'password'
                    ? 'bg-cosmo-800 text-cosmo-cyan font-semibold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" /> 密码认证
              </button>
              <button
                type="button"
                onClick={() => setAuthType('privateKey')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                  authType === 'privateKey'
                    ? 'bg-cosmo-800 text-cosmo-cyan font-semibold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Key className="w-3.5 h-3.5" /> SSH 私钥认证
              </button>
            </div>
          </div>

          {/* Password Auth Fields */}
          {authType === 'password' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">SSH 密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入服务器密码"
                  className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Private Key Auth Fields */}
          {authType === 'privateKey' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">私钥内容 (PEM / OpenSSH)</label>
                  <button
                    type="button"
                    onClick={handleImportKey}
                    className="text-xs text-cosmo-cyan hover:underline flex items-center gap-1 font-medium"
                  >
                    <Upload className="w-3 h-3" /> 从本地文件导入
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                  className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan font-mono resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">私钥密码 (Passphrase, 若有)</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="若私钥未加密可留空"
                  className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan font-mono"
                />
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">标签 (Tags)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-lg bg-cosmo-800 text-cosmo-cyan border border-cosmo-cyan/30 text-xs flex items-center gap-1"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-rose-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="输入标签按回车添加 (如: Docker, Redis)"
                className="flex-1 bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 rounded-xl bg-cosmo-800 hover:bg-cosmo-700 text-xs text-slate-200 font-medium"
              >
                添加
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">备忘备注</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例：部署在阿里云，每月 15 号续费"
              className="w-full bg-cosmo-950 border border-cosmo-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cosmo-cyan"
            />
          </div>

          {/* Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-cosmo-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-cosmo-800 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cosmo-accent to-cosmo-cyan text-cosmo-950 hover:brightness-110 shadow-glow-cyan/20 shadow transition-all font-bold"
            >
              保存服务器
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
