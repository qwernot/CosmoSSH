import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar, NavTab } from './components/Sidebar';
import { HostList } from './components/HostManager/HostList';
import { TerminalView, TerminalSession } from './components/Terminal/TerminalView';
import { SFTPView } from './components/SFTP/SFTPView';
import { SyncView } from './components/CloudSync/SyncView';
import { SettingsView } from './components/Settings/SettingsView';
import { AppDataPayload, CloudSyncConfig, HostConfig, HostGroup, AppSettings } from '@shared/types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('hosts');
  const [appData, setAppData] = useState<AppDataPayload>({
    version: '1.0.0',
    updatedAt: Date.now(),
    hosts: [],
    groups: [],
    snippets: [],
    settings: {
      theme: 'cosmo-dark',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      cursorBlink: true,
      scrollback: 5000,
    },
  });

  const [syncConfig, setSyncConfig] = useState<CloudSyncConfig>({
    workerUrl: '',
    token: '',
    autoSync: false,
  });

  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sftpTargetHost, setSftpTargetHost] = useState<HostConfig | null>(null);

  // Load initial store data
  useEffect(() => {
    async function init() {
      try {
        const data = await window.cosmossh.store.getData();
        if (data) {
          setAppData(data);
        }
        const sync = await window.cosmossh.store.getSyncConfig();
        if (sync) {
          setSyncConfig(sync);
        }
      } catch (e) {
        console.error('Failed to load local store:', e);
      }
    }
    init();
  }, []);

  // SSH Actions
  const handleConnectSSH = async (host: HostConfig) => {
    // Count existing sessions for this host to generate unique tab title
    const hostSessions = sessions.filter((s) => s.host.id === host.id);
    const sessionCount = hostSessions.length;
    const sessionTitle = sessionCount > 0 ? `${host.name} #${sessionCount + 1}` : host.name;

    const sessionId = `ssh_${host.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newSession: TerminalSession = {
      id: sessionId,
      host,
      title: sessionTitle,
      connected: false,
      connecting: true,
    };

    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(sessionId);
    setCurrentTab('terminal');

    try {
      const res = await window.cosmossh.ssh.connect(sessionId, host, 24, 80);
      if (res.success) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, connected: true, connecting: false } : s))
        );
      } else {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId ? { ...s, connected: false, connecting: false, error: res.error } : s
          )
        );
      }
    } catch (err: any) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, connected: false, connecting: false, error: err.message } : s
        )
      );
    }

    // Attach close listener
    window.cosmossh.ssh.onClose(sessionId, () => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, connected: false, connecting: false } : s))
      );
    });
  };

  const handleCloseSession = async (sessionId: string) => {
    await window.cosmossh.ssh.disconnect(sessionId);
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[remaining.length - 1]?.id || null);
      }
      return remaining;
    });
  };

  const handleOpenSFTP = (host: HostConfig) => {
    setSftpTargetHost(host);
    setCurrentTab('sftp');
  };

  // Host Store Actions
  const handleSaveHost = async (host: HostConfig) => {
    const updatedHosts = await window.cosmossh.store.saveHost(host);
    setAppData((prev) => ({ ...prev, hosts: updatedHosts }));
  };

  const handleDeleteHost = async (id: string) => {
    const updatedHosts = await window.cosmossh.store.deleteHost(id);
    setAppData((prev) => ({ ...prev, hosts: updatedHosts }));
  };

  const handleSaveGroups = async (groups: HostGroup[]) => {
    const updated = await window.cosmossh.store.setData({ groups });
    setAppData(updated);
  };

  const handleDeleteGroup = async (groupId: string) => {
    const remainingGroups = appData.groups.filter((g) => g.id !== groupId);
    const fallbackGroupId = remainingGroups[0]?.id || 'default';
    const updatedHosts = appData.hosts.map((h) =>
      h.groupId === groupId ? { ...h, groupId: fallbackGroupId } : h
    );
    const updated = await window.cosmossh.store.setData({
      groups: remainingGroups,
      hosts: updatedHosts,
    });
    setAppData(updated);
  };

  // Sync Store Actions
  const handleSaveSyncConfig = async (config: CloudSyncConfig) => {
    const saved = await window.cosmossh.store.setSyncConfig(config);
    setSyncConfig(saved);
  };

  const handleUpdateAppData = async (partial: Partial<AppDataPayload>) => {
    const updated = await window.cosmossh.store.setData(partial);
    setAppData(updated);
  };

  const handleSaveSettings = async (settings: AppSettings) => {
    const updated = await window.cosmossh.store.setData({ settings });
    setAppData(updated);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-cosmo-950 font-sans text-slate-100">
      {/* Sleek Custom Frameless Titlebar */}
      <TitleBar />

      {/* Main Body Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          activeSessionCount={sessions.filter((s) => s.connected).length}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className={`flex-1 flex flex-col h-full overflow-hidden ${currentTab === 'hosts' ? '' : 'hidden'}`}>
            <HostList
              hosts={appData.hosts}
              groups={appData.groups}
              onSaveHost={handleSaveHost}
              onDeleteHost={handleDeleteHost}
              onSaveGroups={handleSaveGroups}
              onDeleteGroup={handleDeleteGroup}
              onConnectSSH={handleConnectSSH}
              onOpenSFTP={handleOpenSFTP}
            />
          </div>

          <div className={`flex-1 flex flex-col h-full overflow-hidden ${currentTab === 'terminal' ? '' : 'hidden'}`}>
            <TerminalView
              isVisible={currentTab === 'terminal'}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={setActiveSessionId}
              onCloseSession={handleCloseSession}
              onNewSessionClick={() => setCurrentTab('hosts')}
              onNewSessionForHost={handleConnectSSH}
              onOpenSFTP={handleOpenSFTP}
              snippets={appData.snippets}
              settings={appData.settings}
            />
          </div>

          <div className={`flex-1 flex flex-col h-full overflow-hidden ${currentTab === 'sftp' ? '' : 'hidden'}`}>
            <SFTPView
              hosts={appData.hosts}
              initialHost={sftpTargetHost}
            />
          </div>

          <div className={`flex-1 flex flex-col h-full overflow-hidden ${currentTab === 'sync' ? '' : 'hidden'}`}>
            <SyncView
              syncConfig={syncConfig}
              onSaveSyncConfig={handleSaveSyncConfig}
              appData={appData}
              onUpdateAppData={handleUpdateAppData}
            />
          </div>

          <div className={`flex-1 flex flex-col h-full overflow-hidden ${currentTab === 'settings' ? '' : 'hidden'}`}>
            <SettingsView
              settings={appData.settings}
              onSaveSettings={handleSaveSettings}
              appData={appData}
              onImportData={handleUpdateAppData}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
