# CosmoSSH - 现代化跨平台 SSH 终端与 SFTP 客户端

CosmoSSH 是专为运维、开发者和极客打造的新一代轻量级、高颜值跨平台终端软件。集成了强大的 SSH 交互终端、双向 SFTP 远程文件管理器、资产分组标签管理，以及基于 **Cloudflare Workers** 的**零知识端到端加密（E2EE）跨端云同步**。

---

## 📥 最新安装包下载 (GitHub Releases)

可直接前往 [GitHub Releases 页面](https://github.com/qwernot/CosmoSSH/releases) 获取各平台编译产物：

- **官方 Releases 发布页**：[https://github.com/qwernot/CosmoSSH/releases](https://github.com/qwernot/CosmoSSH/releases)
- **作者个人主页**：[https://666228.xyz](https://666228.xyz)

| 平台 | 最新安装包 (v1.0.3) | 格式 | 说明 |
| :--- | :--- | :--- | :--- |
| **Windows 64位 (标准包)** | [CosmoSSH-1.0.3-win.zip](https://github.com/qwernot/CosmoSSH/releases) | `.zip` 便携压缩包 | 解压后双击 `CosmoSSH.exe` 即可直接使用 |
| **Windows 64位 (极小体积)** | [CosmoSSH-1.0.3-win.7z](https://github.com/qwernot/CosmoSSH/releases) | `.7z` 高压缩包 | 7z 高压缩绿色版 |
| **Linux (Debian/Ubuntu)** | [cosmossh_1.0.3_amd64.deb](https://github.com/qwernot/CosmoSSH/releases) | `.deb` 标准包 | `sudo dpkg -i cosmossh_1.0.3_amd64.deb` |

> 💡 **Windows 打开提示「Windows 已保护你的电脑 / 存在风险」的解决方法**：  
> CosmoSSH 为个人开源项目，未购买每年昂贵的商业 EV 代码签名证书。若 Windows 弹出安全警告：点击弹窗中的「**更多信息 (More info)**」➔ 点击「**仍要运行 (Run anyway)**」即可（仅需首次操作）。或右键解压后的 `CosmoSSH.exe` ➔ 选择「属性」➔ 勾选最下方的「**解除锁定 (Unblock)**」确定即可。

---

## 核心特性 (v1.0.3)

- 📊 **Agentless 远程服务器硬件实时监控 (CPU/内存/磁盘/网速/进程)**：
  - **终端常驻微型监控条**：连接终端会话后，顶栏动态展示 CPU 占用百分比、内存使用量/总量、根磁盘空间、网络实时上下行带宽（`↓ 128 KB/s ↑ 35 KB/s`）及系统负载。
  - **高科技 HUD 详细监控仪表盘**：一键呼出高质感深空发光仪表盘，实时呈现 4 组动态仪表、内存明细、Swap 分区、磁盘剩余、连续开机时长与 **Top 5 高负载活跃进程排查列表**！
  - **零探针零侵入 (Agentless)**：完全复用已有 SSH 连接，通过轻量级 `/proc` 内存采样（单次执行仅耗时 ~35ms，CPU 占用 < 0.05%），无须在服务器安装任何客户端或守护进程，普通非 root 用户均可无缝使用。
  - **智能节能休眠**：离开终端标签页或断开连接时自动挂起轮询，零多余网络开销。
- 📂 **WinSCP 风格双栏文件传输 (双向来回拖拽)**：
  - **左栏本地电脑**：内置本地资源管理器，支持一键快捷跳转「桌面」、「下载」和「家目录」，可新建本地文件夹与在系统文件管理器中直接打开。
  - **右栏远程服务器**：全功能 SFTP 远程文件浏览、在线编辑、权限查看与快速管理。
  - **来回拖拽极速传输**：直接从左栏拖拽文件到右栏即可立即上传；从右栏拖拽文件到左栏即可立即下载到当前本地目录！
  - **一键下载到桌面**：远程文件提供「📥 一键下载到桌面」快捷按钮，无需任何文件选择弹窗，点击即下。
  - **双栏/单栏自由切换**：点击顶部「WinSCP 双栏模式」按钮，可一键切换全宽单栏或双栏对比视图。
- ⌨️ **极客终端快捷键支持**：
  - 智能 `Ctrl+C`：当选中文本时复制到系统剪贴板，未选中时放行 SIGINT 中断信号。
  - `Ctrl+V` 一键粘贴系统剪贴板内容到当前会话。
  - 鼠标右键智能复制/粘贴。
- 🔄 **版本更新通道 (逢十进一)**：
  - 内置软件内一键检查更新，可直接在软件内下载最新安装包或跳转至仓库页面更新。
- 🌐 **作者主页与极客工具集**：
  - 设置中心提供作者官方主页 `666228.xyz` 快捷入口。
- 🌌 **深空科幻高质感 UI**：采用宇宙暗黑主题与微发光视觉设计，低眼疲劳，流畅顺滑。
- ⚡ **高性能交互式 SSH 终端**：
  - 基于成熟的 `@xterm/xterm` 与 Node.js 原生 `ssh2`。
  - 支持多会话多标签页快速切换与同机多开会话。
  - PTY 窗口动态自适应缩放（Fit Addon + window-change 信号同步）。
  - 会话离开常驻保活，后台持续流式消费输出。
  - 内置常用运维指令快捷片段（Snippets），一键发送执行。
- 📂 **全功能 SFTP 远程文件传输与管理器**：
  - 双向文件传输，支持本地文件拖拽或对话框多选上传。
  - 路径面包屑导航，快捷跳转根目录、主目录与上级目录。
  - 文件属性管理：文件大小、修改时间、权限查看与修改（chmod）、重命名、删除。
  - **内置在线文本编辑器**：双击即可在线查看并编辑远程服务器配置文件（如 `nginx.conf`, `.env`, `docker-compose.yml`），按下 `Ctrl + S` 快捷保存直接回传服务器！
  - 实时传输队列监视抽屉，精确展示上传/下载进度与传输百分比。
- 🏷️ **自定义服务器分组管理**：支持自定义分组名称、8种高颜值深空圆点配色、资产平滑迁移与安全删除。
- 📡 **双模网络穿透测速**：原生 ICMP Ping + TCP SSH Banner 协议头探测，彻底解决本地 TUN/代理伪造 1ms 延迟。
- 🛡️ **Cloudflare 端到端加密云同步 (Zero-Knowledge E2EE)**：
  - 配套免费的 Cloudflare Workers + KV 服务（位于 `cloudflare-sync-worker/`）。
  - 客户端通过主密码（Master Password）在本地使用 **PBKDF2（100,000 次哈希）** 派生密钥，对所有凭据使用 **AES-256-GCM** 加密后再传输。
  - 云端仅保存密文，任何第三方甚至 Cloudflare 自身均无法读取任何服务器 IP、端口、密码或私钥。

---

## 目录结构

```
.
├── cloudflare-sync-worker/     # Cloudflare 云同步后端代码与部署文档
│   ├── worker.js               # Cloudflare Worker 脚本
│   ├── wrangler.toml           # Wrangler 部署配置
│   └── README.md               # 2分钟部署操作手册
├── release/                    # 构建生成的发布安装包
│   ├── cosmossh_1.0.3_amd64.deb # Linux deb 安装包 (已生成)
│   └── CosmoSSH-1.0.3-win.7z   # Windows 64位运行包 (已生成，解压即用)
├── src/
│   ├── main/                   # Electron 主进程 (SSH2, SFTP, IPC, 加密存储)
│   ├── preload/                # 安全预加载脚本 (ContextBridge)
│   ├── renderer/               # React 18 前端界面 (Tailwind, Lucide, Xterm)
│   └── shared/                 # 前后端共享类型定义 (Host, SFTP, Sync, Settings)
├── electron-builder.json5      # 跨平台打包规格配置
├── package.json
└── vite.config.ts
```

---

## 快速上手与本地开发

### 1. 环境准备
确保机器已安装 Node.js (推荐 v20+) 和 pnpm:
```bash
# 安装依赖
pnpm install
```

### 2. 启动开发模式
```bash
pnpm dev
```
此命令将启动 Vite 开发服务器并拉起 Electron 桌面客户端，支持热重载。

### 3. 构建项目
```bash
pnpm build
```

---

## 跨平台打包

### 打包 Linux 版本 (.deb 安装包)
```bash
pnpm dist:linux
```
生成的安装包位于：`release/cosmossh_1.0.0_amd64.deb`。
在 Ubuntu / Debian 系统上安装命令：
```bash
sudo dpkg -i release/cosmossh_1.0.0_amd64.deb
```

### 打包 Windows 版本
```bash
pnpm dist:win
```
生成的 Windows 便携压缩包位于：`release/CosmoSSH-1.0.0-win.7z`，解压后双击 `CosmoSSH.exe` 即可直接运行！

---

## Cloudflare 云同步配置（2 分钟快速启用）

1. 参考 `cloudflare-sync-worker/README.md`，登录 Cloudflare 控制台创建 Worker 并绑定 KV 空间。
2. 打开 CosmoSSH，点击左侧菜单 **云端同步**：
   - 填入您的 Worker 地址（例如：`https://cosmossh-sync.xxx.workers.dev`）。
   - 填入您的自定义访问令牌（Sync Token）。
   - 填入端到端加密主密码（Master Password）。
3. 点击 **立即上传备份 (Push)** 或在另一台设备上点击 **立即拉取并解密 (Pull)**，即可跨设备无缝同步所有服务器资产！
