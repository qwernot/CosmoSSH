# CosmoSSH Cloudflare Worker 部署指南

CosmoSSH 云同步服务基于 **Cloudflare Workers + KV** 构建，完全免费、全球低延迟、免维护，并采用**零知识端到端加密（E2EE）**机制，所有服务器 IP、密码、密钥在离开您的客户端前均已通过主密码加密为密文，Cloudflare 端仅作为密文保险库，无法窥探任何敏感数据。

---

## 部署方法一：Cloudflare 网页控制台（免安装任何工具，推荐）

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 进入左侧菜单 **Workers 和 Pages (Workers & Pages)** -> 点击 **创建应用程序 (Create Application)** -> **创建 Worker (Create Worker)**。
3. 给 Worker 起一个名字（如 `cosmossh-sync`），点击 **部署 (Deploy)**。
4. 部署完成后点击 **编辑代码 (Edit code)**：
   - 将 `worker.js` 的完整内容复制并覆盖粘贴进去。
   - 点击右上角 **部署 (Deploy)** 保存。
5. 创建与绑定 KV 命名空间（用于存放密文）：
   - 回到 Cloudflare 控制台左侧菜单 -> **Workers 和 Pages** -> **KV**。
   - 点击 **创建命名空间 (Create namespace)**，命名为 `cosmossh_data`。
   - 回到刚才创建的 Worker -> 点击 **设置 (Settings)** -> **变量 (Variables)** -> 找到 **KV 命名空间绑定 (KV Namespace Bindings)**。
   - 点击 **添加绑定 (Add binding)**：
     - **变量名称 (Variable name)** 必须填写为：`COSMOSSH_KV`
     - **KV 命名空间 (KV namespace)** 选择刚才创建的 `cosmossh_data`。
   - 点击 **保存并部署 (Save and deploy)**。
6. 获取 Worker 访问地址：
   - 在 Worker 概述页面查看您的访问域名，例如：`https://cosmossh-sync.yourname.workers.dev`。

---

## 部署方法二：使用 Wrangler CLI 命令行部署

如果您本地安装了 Node.js，也可以在终端运行：

```bash
cd cloudflare-sync-worker

# 1. 登录 Cloudflare 账号
npx wrangler login

# 2. 创建 KV 命名空间
npx wrangler kv:namespace create COSMOSSH_KV

# 3. 将命令输出的 id 填入 wrangler.toml 文件中
# [[kv_namespaces]]
# binding = "COSMOSSH_KV"
# id = "你的KV_ID"

# 4. 部署 Worker
npx wrangler deploy
```

---

## 在 CosmoSSH 中启用同步

1. 打开 CosmoSSH 客户端，点击左侧导航栏的 **云同步 (Cloud Sync)** 图标。
2. 填写配置：
   - **Worker URL**：填写您的 Worker 地址（如 `https://cosmossh-sync.yourname.workers.dev`）。
   - **Sync Token (同步凭证)**：自定义一串属于您个人的复杂访问令牌（例如 `my-super-secret-token-888`）。
   - **Master Password (主密码)**：用于客户端端到端加解密的密钥。请务必牢记，不同设备需输入相同主密码才能解密主机配置。
3. 点击 **立即同步 (Sync Now)**，即可双向拉取和推送主机列表与配置！
