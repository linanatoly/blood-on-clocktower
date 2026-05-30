# 🩸 血染钟楼 - 暗流涌动说书人开局工具

一个纯 HTML/CSS/JS 的血染钟楼多人网页游戏，需要PC端做本地局域网服务器，玩家和上帝端支持 PC 和移动端。

## ✨ 特性

- 🎮 **无框架依赖** — 纯原生 DOM 架构，前端零运行时依赖
- 🔌 **实时通信** — 基于 WebSocket 的多人实时互动
- 📱 **响应式设计** — 同时适配 PC 和移动端浏览器
- 🎭 **完整角色体系** — 包含村民、外来者、爪牙、恶魔四类角色
- 🕵️ **间谍模式** — 间谍角色可查看上帝完整数据
- 💬 **私聊与群聊** — 玩家间私聊、上帝群聊多玩家
- 📝 **事件记录** — 上帝可记录游戏事件，支持快捷模板
- 🔄 **断线重连** — 支持断线后自动恢复会话
- 🎯 **双模式选角** — 玩家自选 / 上帝代选角色

## 🚀 快速开始

### 方式一：免安装版（推荐，无需 Node.js）

1. 双击 `start.bat` 或 `server.exe`
2. 浏览器自动打开，开始游戏

就这么简单。`server.exe` 内置了 Node.js 运行时，完全不需要额外安装。

### 方式二：源码版（开发者）

**环境要求**：[Node.js](https://nodejs.org/) >= 16

```bash
# 1. 安装依赖
npm install

# 2. 启动服务器
node server.js

# 3. 浏览器访问
# 启动器页面: http://localhost:8080/launcher.html
# 直接游戏:   http://localhost:8080/
```

### 一键启动

- **Windows**: 双击 `start.bat`（自动选择免安装或 Node.js 模式）
- **macOS / Linux**: 运行 `./start.sh`

## 📖 使用说明

- 详细操作指南见 [上帝操作手册.md](./上帝操作手册.md)
- 功能列表见 [功能点汇总.md](./功能点汇总.md)

## 🏗️ 项目结构

```
├── server.js              # Node.js WebSocket 服务端
├── index.html             # 游戏页面入口
├── launcher.html          # 服务器启动器 / 管理面板
├── package.json           # 项目配置与依赖
├── start.bat / start.sh   # 一键启动脚本
├── src/
│   ├── app.js             # 应用入口，事件总线枢纽
│   ├── PlayerManager.js   # 玩家管理（入座/选角/状态）
│   ├── ChatManager.js     # 聊天会话管理
│   ├── EventLogManager.js # 事件记录管理
│   ├── LobbyPage.js       # 大厅页面（创建/加入房间）
│   ├── event-constants.js # 事件常量、角色列表、快捷模板
│   ├── core/
│   │   └── EventBus.js    # 事件总线
│   ├── dataManager/
│   │   └── dataManager.js # 数据中心（WS连接/状态存储/持久化）
│   ├── uiManager/         # UI 组件（继承 UIComponent）
│   │   ├── GameTable.js   # 游戏桌面（座位布局）
│   │   ├── ChatPanel.js   # 聊天面板
│   │   ├── EventLogPanel.js # 事件记录面板
│   │   ├── FunctionPanel.js # 底部功能栏
│   │   ├── SeatPopup.js   # 座位弹窗
│   │   └── ...            # 其他 UI 组件
│   └── styles/            # CSS 样式（每组件一个文件）
└── assets/                # 图片资源（角色头像等）
```

## 🧪 测试

```bash
# 运行单元测试
npm test

# Watch 模式
npm run test:watch

# Vitest UI 面板
npm run test:ui
```

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 原生 HTML/CSS/JS (ES Modules) |
| 后端 | Node.js + ws (WebSocket) |
| 测试 | Vitest + jsdom |
| 通信 | WebSocket (JSON 消息) |

## 📄 许可证

[MIT License](./LICENSE)
