# Recess - 童年游戏合集

参考 QQ 游戏大厅设计的童年游戏合集平台，首期支持经典纸笔推理游戏「炸飞机」。支持 Web（PC + 移动端）和微信小程序。

## 游戏介绍

### 炸飞机

炸飞机是一种双人推理类纸上游戏。在 10×10 的棋盘上各部署 3 架飞机，双方轮流攻击坐标，根据反馈推理对方飞机位置，击落全部机头获胜。

**游戏流程：**
1. **部署阶段** — 在 10×10 棋盘上摆放 3 架飞机，可自由调整位置和朝向
2. **对战阶段** — 双方轮流点击对方棋盘坐标发起攻击，获得「空 / 伤 / 头」反馈
3. **结算阶段** — 率先击落对方全部 3 个机头的玩家获胜

**飞机形状（11 格）：**
```
    ★          机头 (1格)
  ■■■■■        机翼 (5格)
    ■          机身 (2格)
    ■
   ■■■         尾翼 (3格)
```

## 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| **后端** | NestJS 11 + TypeORM + MySQL | 模块化架构，WebSocket 网关处理实时对战 |
| **实时通信** | Socket.IO | 双向通信，支持断线重连 |
| **认证** | JWT | 游客模式 + 微信小程序授权登录 |
| **Web 前端** | React 19 + Vite + Ant Design | PC 并排双棋盘，移动端 Tab 切换 |
| **小程序** | Taro 4 + React | 编译到微信小程序，共享类型和游戏逻辑 |
| **构建** | pnpm workspace + Turborepo | Monorepo 管理，共享包复用 |
| **语言** | TypeScript 5.x | 全栈类型安全 |

## 项目结构

```
recess/
├── packages/
│   ├── shared/              # 共享类型和常量
│   │   └── src/
│   │       ├── bomb-plane.ts    # 飞机形状、棋盘类型、攻击结果
│   │       └── ws-events.ts     # WebSocket 事件类型定义
│   ├── server/              # NestJS 后端
│   │   └── src/
│   │       ├── entities/        # TypeORM 实体 (User, Game, Room, RoomPlayer)
│   │       └── modules/
│   │           ├── auth/            # 游客/微信登录，JWT 签发
│   │           ├── games/           # 游戏类型查询
│   │           ├── rooms/           # 房间 CRUD + WebSocket 网关
│   │           └── bomb-plane/      # 炸飞机引擎 + 对战网关
│   ├── web/                 # React Web 前端
│   │   └── src/
│   │       ├── pages/             # Lobby（大厅）、Room（房间/对战）
│   │       ├── components/        # Board（棋盘组件）
│   │       ├── hooks/             # useSocket（WebSocket hook）
│   │       └── api.ts             # REST API 封装
│   └── miniapp/             # Taro 微信小程序
│       └── src/
│           ├── pages/             # index（大厅）、room（对战）
│           ├── components/        # Board（棋盘组件）
│           └── services/          # API 封装、Socket 服务
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 数据库设计

使用 MySQL，数据库名 `recess`，共 5 张表：

| 表名 | 说明 |
|------|------|
| `users` | 用户信息（昵称、头像、微信 openId、游客标识） |
| `games` | 游戏类型（名称、标识、人数限制、状态） |
| `rooms` | 房间（关联游戏、创建者、状态、密码） |
| `room_players` | 房间玩家（座位号、准备状态） |
| `game_records` | 游戏记录（飞机部署 JSON、攻击记录、胜负结果） |

预置测试数据：1 款游戏（炸飞机）、4 位测试用户、3 个不同状态的房间。

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 9
- MySQL >= 5.7

### 1. 安装依赖

```bash
pnpm install
```

### 2. 初始化数据库

在 MySQL 中创建数据库和表：

```bash
mysql -u root -p < scripts/init-db.sql
```

或手动在 MySQL 中创建 `recess` 数据库并执行建表语句。

### 3. 配置环境变量

在 `packages/server/` 下创建 `.env` 文件：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=recess
JWT_SECRET=your-secret-key
```

### 4. 启动开发服务

```bash
# 启动后端 (http://localhost:3000)
pnpm dev:server

# 启动 Web 前端 (http://localhost:5173)
pnpm dev:web

# 启动小程序开发 (需配合微信开发者工具)
pnpm dev:miniapp
```

## API 接口

### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/guest` | 游客登录，返回 JWT |
| POST | `/auth/wechat` | 微信登录（传入 code） |
| GET | `/games` | 获取游戏列表 |
| GET | `/rooms?gameId=1` | 获取房间列表 |
| POST | `/rooms` | 创建房间 |
| POST | `/rooms/:id/join` | 加入房间 |
| POST | `/rooms/:id/leave` | 离开房间 |

### WebSocket 事件

**客户端 → 服务端：**

| 事件 | 说明 |
|------|------|
| `room:join` | 进入房间 |
| `room:leave` | 离开房间 |
| `game:ready` | 准备 |
| `game:place-planes` | 部署飞机 |
| `game:attack` | 攻击坐标 |

**服务端 → 客户端：**

| 事件 | 说明 |
|------|------|
| `room:update` | 房间状态变更 |
| `game:state` | 游戏状态同步 |
| `game:attack-result` | 攻击结果（miss / hit / headshot） |
| `game:turn` | 回合切换 |
| `game:over` | 游戏结束 |

## 打包构建

```bash
# 构建所有包
pnpm build

# 单独构建
pnpm build --filter=@recess/server     # 后端 → packages/server/dist/
pnpm build --filter=@recess/web        # Web → packages/web/dist/

# 小程序打包
cd packages/miniapp
pnpm build:weapp    # 微信小程序 → packages/miniapp/dist/
pnpm build:h5       # H5 版本 → packages/miniapp/dist/
```

构建产物：
- **server**: `packages/server/dist/` — 可用 `node dist/main.js` 启动
- **web**: `packages/web/dist/` — 静态文件，部署到 Nginx 或 CDN
- **miniapp**: `packages/miniapp/dist/` — 用微信开发者工具上传

## License

MIT
