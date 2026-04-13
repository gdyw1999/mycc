---
name: web-terminal
description: 启动浏览器可访问的 CC 终端，支持外网和手机远程操作。当用户说"启动web终端"、"浏览器访问CC"、"手机看终端"、"远程终端"、"web terminal"、"打开终端网页"、"出门了帮我开手机终端"时触发。也适用于需要在手机上直接操作 CC 交互界面（approve/deny、查看完整输出）的场景。
---

# Web Terminal

多标签页 AI 终端，预置 Claude Code / Codex 标签页，且默认以 yolo 模式启动，通过浏览器远程访问，手机也能用。

## 触发词

- "/web-terminal"
- "启动web终端"
- "手机看终端"
- "远程终端"
- "出门了帮我开手机终端"

## 执行步骤

### 1. 启动服务（后台运行）

```bash
WEB_TERMINAL_TOKEN=mycc node .claude/skills/web-terminal/scripts/server.mjs
```

> 用 `run_in_background=true`，等服务启动后继续。

### 2. 检查 frp 隧道状态

Web Terminal 通过 **frp** 隧道提供服务，确保 frpc 客户端已启动并包含以下配置：

```toml
[[proxies]]
name = "web-terminal-tcp"
type = "tcp"
localIP = "127.0.0.1"
localPort = 7681
remotePort = 7681
```

### 3. 告知用户访问链接

| 访问方式 | 地址 |
|---------|------|
| **外网（域名）** | http://8027.linbaobao.net |
| **外网（IP）** | http://101.126.93.180:7681 |
| **本地** | http://127.0.0.1:7681 |

Token 不出现在 URL 里，在登录页输入即可（默认：`mycc`）。

## 功能特性

- **多标签页**：Claude Code、Codex 两个 AI CLI 标签页切换，默认 yolo 模式
- **懒加载**：PTY 进程在首次切换到对应标签页时才启动，节省资源
- **独立滚动缓冲**：每个标签页独立保存 50KB 输出历史
- **连接状态指示**：实时显示 WebSocket 连接状态（绿点 = Connected）
- **移动端优化**：虚拟按键栏（Stop/Enter/Tab/Esc/方向键）、输入框、发送按钮

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WEB_TERMINAL_PORT` | 7681 | 监听端口 |
| `WEB_TERMINAL_TOKEN` | 随机 | 当前使用 `KJ7HI0` |
| `WEB_TERMINAL_CWD` | 当前目录 | 工作目录 |
| `WEB_TERMINAL_TABS` | 内置默认标签页 | JSON 自定义标签页配置 |

### 自定义标签页

通过 `WEB_TERMINAL_TABS` 环境变量传入 JSON 数组：

```bash
WEB_TERMINAL_TABS='[{"id":"claude","label":"CC","cmd":"claude","args":["--continue","--dangerously-skip-permissions"]},{"id":"codex","label":"Codex","cmd":"codex","args":["resume","--last","--yolo"]}]' node server.mjs
```

## 脚本路径

`.claude/skills/web-terminal/scripts/server.mjs`

依赖已安装在 `.claude/skills/web-terminal/scripts/node_modules/`
