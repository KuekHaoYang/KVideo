[![Upstream Sync](https://github.com/KuekHaoYang/KVideo/actions/workflows/Github_Upstream_Sync.yml/badge.svg)](https://github.com/KuekHaoYang/KVideo/actions/workflows/Github_Upstream_Sync.yml)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/KuekHaoYang/KVideo)
[![Version](https://img.shields.io/badge/Version-4.9.4-orange?style=for-the-badge)](CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.5-149ECA?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.2.2-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[![Buy Me A Coffee](https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=kuekhaoyang&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff)](https://www.buymeacoffee.com/kuekhaoyang)

# 视频聚合平台 (KVideo)

![KVideo Banner](public/icon.png)

> 一个基于 Next.js 16、React 19 和 Tailwind CSS v4 构建的现代化视频聚合播放平台，聚焦自托管部署、多源并行搜索、播放器体验、IPTV 播放、账户隔离和 Redis 同步能力。

**当前版本：[`4.9.4`](CHANGELOG.md)**

> [!IMPORTANT]
> 这份 README 已按当前主分支和 2026-04-16 审计后的实际行为校正。旧版文案里关于 Apple TV 原生支持、宽松公共代理、以及“完整离线可用”的表述都已经不再成立。

> [!NOTE]
> 仓库默认不内置任何视频源、高级源或 IPTV 源。部署者必须自行配置已获授权、可合法使用且允许当前部署方式访问的内容来源。

## 项目简介

**KVideo** 是一个高性能、现代化的视频聚合与播放应用，核心目标不是“随便能播”，而是在当前代码约束下尽可能把以下几件事做好：

- 多源搜索与结果聚合
- 现代播放器交互与大屏适配
- 账户隔离、权限控制与跨设备同步
- 自托管场景下可控的媒体代理与 IPTV 能力
- 在审计后保持更严格、更诚实的运行边界

### 核心设计语言：Liquid Glass（液态玻璃）

项目 UI 延续了 **Liquid Glass** 风格，强调：

- **玻璃拟态效果**：大量使用 `backdrop-filter`、半透明叠层和柔和边框
- **统一圆角系统**：主要围绕 `rounded-2xl` 与 `rounded-full` 建立视觉一致性
- **光影与层级**：悬停、聚焦、弹层和播放器控制条都有清晰的深度关系
- **顺滑动画曲线**：采用更接近物理手感的缓动与过渡，而不是机械线性动画
- **大屏可读性**：TV 模式下会主动放大交互目标、焦点态和间距

## 支持矩阵

| 目标 | 状态 | 说明 |
|------|------|------|
| 桌面浏览器 | 支持 | 主力使用场景 |
| 移动浏览器 | 支持 | 包含触摸交互与移动端播放器优化 |
| PWA 安装 | 支持 | 但离线能力仅限同源壳与静态资源，不等于完整离线播放器 |
| Android TV 壳应用 | 支持 | 仓库内提供 `android-tv/` 工程 |
| 自托管 Node.js | 支持 | 完整能力路径 |
| Docker | 支持 | 完整能力路径，推荐部署方式之一 |
| Cloudflare Workers via OpenNext | 支持 | Cloudflare 主支持路径，但运行时会进入受限托管模式 |
| Vercel / 托管 Cloudflare 部署 | 支持但受限 | 自动关闭外部媒体代理、热链转发和 IPTV 流中继 |
| Apple TV / tvOS 原生打包 | 不支持 | 旧的 WebView 壳路径已移除，不再宣称支持 |

Apple TV 用户当前应使用浏览器、AirPlay，或其他已经被支持的投屏路径，而不是依赖仓库内不存在的完整 tvOS 产品链路。

## 核心功能

### 智能视频播放

- **HLS 流媒体支持**：基于 [hls.js](https://github.com/video-dev/hls.js/) 播放 HLS (`.m3u8`) 内容
- **完整播放控制**：进度条、音量、倍速、静音、系统全屏、网页全屏
- **自动跳过片头/片尾**：支持配置秒数
- **自动连播**：可自动播放下一集
- **移动端优化**：移动端播放器布局、双击手势、触摸交互单独处理
- **Google Cast / Chromecast**：播放器页面加载 Cast SDK
- **画中画（PiP）**：桌面浏览器与 Android WebView 都有对应兼容逻辑
- **代理播放模式**：直连、仅代理、智能重试等模式可切换
- **实际分辨率探测**：会对当前播放源和线路列表中的源做分辨率探测与缓存
- **广告过滤回退**：广告过滤失败时会退回原始视频流，而不是直接把播放器打死
- **键盘快捷键**：空格/K、F、M、P、方向键、J/L 等常用控制都已接入
- **一起看（VideoTogether）**：提供网页脚本集成，但默认不会加载，必须显式启用环境变量并由用户在设置中开启

### 多源并行搜索与源管理

- **并行聚合搜索**：多个视频源同时请求，服务端以 SSE 实时推送结果
- **自定义视频源**：支持手动添加、编辑、启用、禁用与排序
- **个人视频源**：用户可添加只对自己可见的个人源，不影响系统源
- **订阅源管理**：支持通过 JSON 链接自动导入与更新
- **JSON 批量导入**：可直接粘贴源列表 JSON
- **统一解析层**：对不同来源的字段差异做统一收敛
- **搜索历史**：自动保存并支持快速重搜
- **繁体中文搜索兼容**：使用 `opencc-js` 做繁简转换辅助搜索
- **合并同名源显示**：可切换默认卡片模式与合并模式
- **实时延迟显示**：可选展示各源网络延迟
- **内容过滤**：支持屏蔽关键词类目
- **搜索取消与超时保护**：服务端支持 `AbortSignal`、单源超时和总量限制，避免内存暴涨

### IPTV 直播

- **M3U / M3U8 播放列表导入**
- **JSON 频道列表导入**
- **HEVC/H.265 兼容处理**：会优先尝试 H.264 级别以缓解“有声音没画面”
- **频道网格与分组浏览**
- **多级频道结构**：源分组、分类分组、频道选择
- **多线路折叠与快速切换**
- **自定义请求头透传**：支持从 M3U 解析 `http-user-agent` 与 `http-referrer`
- **代理与重定向处理**：自托管模式下会处理中继、URL 重写和常见 CORS 问题
- **超时与并发控制**：频道拉取有限流、分片超时与重试策略
- **权限控制**：需要 `iptv_access`
- **播放器内搜索优化**：大列表搜索使用 `useTransition` 降低阻塞

> [!WARNING]
> IPTV 与媒体代理在 Vercel / Cloudflare 等托管部署中会被自动关闭。需要完整 IPTV 能力时，直接用 Docker 或传统 Node.js 自托管，别自欺欺人地把受限托管平台当完整功能环境。

### 豆瓣、推荐与元数据

- **电影 / 电视剧分类切换**
- **豆瓣评分、演员、简介等元数据展示**
- **相关推荐**
- **首页标签管理与排序**
- **演员 / 导演可点击继续检索**
- **个性化推荐**：基于观看历史生成“为你推荐”标签

### 收藏、历史与高级模式

- **一键收藏**
- **独立收藏侧边栏**
- **自动记录观看历史**
- **断点续播**
- **按标题去重的历史记录**
- **普通 / 高级模式隔离**
- **高级模式独立入口**：直接访问 `/premium`
- **高级源与普通源物理隔离**
- **高级模式单独推荐、单独设置、单独数据空间**

### 弹幕（Danmaku）

- **兼容 `danmu_api` 风格接口**
- **Canvas 高性能渲染**
- **滚动 / 顶部 / 底部弹幕**
- **透明度、字号、显示区域可调**
- **暂停、跳转、全屏联动**
- **每用户多 API 管理**
- **用户选择的弹幕 API 优先于系统默认**

### 账户、权限与跨设备同步

- **托管账户模式**：Redis + `AUTH_SECRET`，支持用户名密码登录与 HTTP-only 会话
- **环境变量兼容模式**：仍支持 `ADMIN_PASSWORD` / `ACCESS_PASSWORD` / `ACCOUNTS`
- **超级管理员账户管理**：创建、修改、重置、删除账户
- **独立高级内容密码**：`PREMIUM_PASSWORD`
- **配置同步**：Docker / Node.js 可使用普通 `redis://` / `rediss://`，Cloudflare / Vercel 等受限托管环境使用 Upstash Redis REST
- **多账户数据隔离**：收藏、历史、设置、个人源、弹幕 API 都按 `profileId` 隔离

### 全端体验

- **深色 / 浅色主题**
- **动态站点名称与图标**
- **TV 模式自动检测**
- **方向键 / 遥控器空间导航**
- **回到顶部、滚动位置记忆**
- **PWA 安装能力**
- **有限离线壳缓存**

## 安全与运行默认值

这部分不是装饰文案，而是当前仓库的真实默认行为。

- 只允许 `http` / `https` 出站目标
- 默认阻止回环、私网、链路本地、保留地址段等高风险目标
- 主机名会先解析，再对重定向结果继续做阻断校验
- 公开中继默认关闭；未启用认证时，必须显式设置 `KVIDEO_PUBLIC_RELAY_ENABLED=true` 才允许公共访问相关代理路由
- 代理路由不会转发 Cookie，也不会伪造客户端 IP / `Origin` / `Referer`
- 只要开启认证，`AUTH_SECRET` 就是硬要求
- 登录失败会触发节流，接口可能返回 `429` 与 `Retry-After`
- Vercel / Cloudflare 运行时会进入受限托管模式，自动关闭外部媒体代理、热链转发和 IPTV 流中继

## 认证模式与权限

### 方式一：托管账户模式（推荐）

启用条件：

- `AUTH_SECRET`
- Docker / 自托管 Node.js：`REDIS_URL` 或 `KVIDEO_REDIS_URL`
- Cloudflare / Vercel 等受限托管环境：`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- 至少一个首批账户来源：`ADMIN_PASSWORD` 或 `ACCOUNTS`

启用后：

- 登录页使用 **用户名 + 密码**
- 服务端使用 HTTP-only 签名会话 Cookie 作为认证真源
- 超级管理员可在设置页直接管理账户和权限
- 配置同步、历史、收藏等跨设备数据按登录账户自动隔离

### 方式二：环境变量兼容模式

未启用托管账户时，继续支持：

- `ADMIN_PASSWORD`
- `ACCESS_PASSWORD`
- `ACCOUNTS`

`ACCESS_PASSWORD` 仍作为 `ADMIN_PASSWORD` 的兼容别名保留。

### `ACCOUNTS` 格式

支持两种格式，多个账户之间用逗号分隔：

- 旧格式：`密码:名称[:角色[:权限1|权限2|...]]`
- 新格式：`用户名:密码:名称[:角色[:权限1|权限2|...]]`

角色：

- `super_admin`
- `admin`
- `viewer`

### 权限矩阵

| 权限 | 说明 | super_admin | admin | viewer |
|------|------|:-----------:|:-----:|:------:|
| `source_management` | 管理系统视频源 | ✓ | - | - |
| `account_management` | 查看与管理账户 | ✓ | - | - |
| `danmaku_api` | 配置系统弹幕 API | ✓ | - | - |
| `data_management` | 导出、导入、重置数据 | ✓ | - | - |
| `player_settings` | 播放器设置 | ✓ | ✓ | - |
| `danmaku_appearance` | 弹幕外观设置 | ✓ | ✓ | - |
| `view_settings` | 显示设置 | ✓ | ✓ | ✓ |
| `iptv_access` | 访问 IPTV 功能 | ✓ | ✓ | - |
| `iptv_source_management` | 管理 IPTV 源 | ✓ | ✓ | - |
| `iptv_builtin_sources` | 使用内置 IPTV 源能力 | ✓ | ✓ | - |

> [!NOTE]
> 当前代码里，只要账户拥有 `iptv_access`，权限解析会自动补上 `iptv_source_management`。

## 关键环境变量

### 认证与访问

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `AUTH_SECRET` | - | 启用认证时必填；缺失时受保护的认证/同步/代理流程不会正常工作 |
| `AUTH_COOKIE_SECURE` | 自动 | 可选强制值：`true` 或 `false`；未设置时按 `x-forwarded-proto` / 请求协议决定，避免 HTTP Docker 直连丢失会话 Cookie |
| `ADMIN_PASSWORD` | - | 管理员密码；兼容模式直接生效，也可作为托管模式首批超级管理员种子 |
| `ACCESS_PASSWORD` | - | `ADMIN_PASSWORD` 的兼容别名 |
| `ACCOUNTS` | - | 多账户配置，支持旧格式和用户名格式 |
| `PREMIUM_PASSWORD` | - | `/premium` 的独立密码 |
| `PERSIST_SESSION` | `true` | 是否持久化本地登录态 |
| `PORT` | `3000` | 自定义端口 |

### 中继与出站安全

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `KVIDEO_PUBLIC_RELAY_ENABLED` | `false` | 是否允许未认证场景下的公共代理访问 |
| `KVIDEO_OUTBOUND_PRIVATE_HOST_ALLOWLIST` | - | 允许显式访问的私网 / 内网主机白名单，逗号分隔 |

### Redis 与跨设备同步

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `REDIS_URL` | - | 普通 TCP Redis 地址，仅用于自托管 Node.js / Docker；支持 `redis://` 与 `rediss://` |
| `KVIDEO_REDIS_URL` | - | KVideo 专用 TCP Redis 地址；存在时优先于 `REDIS_URL` |
| `KVIDEO_REDIS_CONNECT_TIMEOUT_MS` | `5000` | TCP Redis 单次命令连接超时，单位毫秒 |
| `UPSTASH_REDIS_REST_URL` | - | Upstash REST 地址；与 Token 配对后启用托管账户与同步能力 |
| `UPSTASH_REDIS_REST_TOKEN` | - | Upstash REST Token；与 URL 配对后优先于 TCP Redis |

### 站点标题与图标

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NEXT_PUBLIC_SITE_TITLE` | `KVideo - 视频聚合平台` | 浏览器标题 |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | `视频聚合平台` | 站点描述 |
| `NEXT_PUBLIC_SITE_NAME` | `KVideo` | 站点名称 |
| `SITE_ICON_FILE` | - | Docker 运行时图标文件路径，优先于 `SITE_ICON_URL` |
| `SITE_ICON_URL` | - | Docker 运行时图标 URL 或站内路径 |

### 源、过滤器与集成

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `SUBSCRIPTION_SOURCES` / `NEXT_PUBLIC_SUBSCRIPTION_SOURCES` | - | 自动订阅源配置 |
| `IPTV_SOURCES` / `NEXT_PUBLIC_IPTV_SOURCES` | - | IPTV 源配置 |
| `MERGE_SOURCES` / `NEXT_PUBLIC_MERGE_SOURCES` | - | 默认启用合并同名源显示 |
| `AD_KEYWORDS` / `NEXT_PUBLIC_AD_KEYWORDS` | - | 广告过滤关键词 |
| `AD_KEYWORDS_FILE` | - | 广告关键词文件路径 |
| `DANMAKU_API_URL` / `NEXT_PUBLIC_DANMAKU_API_URL` | - | 默认弹幕 API 地址 |
| `VIDEOTOGETHER_ENABLED` | `false` | 是否允许加载 VideoTogether 脚本 |
| `VIDEOTOGETHER_SCRIPT_URL` | - | 启用 VideoTogether 时必填，必须显式提供脚本地址 |
| `VIDEOTOGETHER_SETTING_URL` | - | 可选的设置页地址 |

## 技术栈

### 前端核心

| 技术 | 当前版本 | 用途 |
|------|----------|------|
| [Next.js](https://nextjs.org/) | `16.2.4` | App Router、服务端组件、构建链路 |
| [React](https://react.dev/) | `19.2.5` | UI 组件模型 |
| [TypeScript](https://www.typescriptlang.org/) | `5.x` | 类型系统 |
| [Tailwind CSS](https://tailwindcss.com/) | `4.2.2` | 样式系统 |
| [Zustand](https://github.com/pmndrs/zustand) | `5.0.12` | 轻量状态管理 |
| [hls.js](https://github.com/video-dev/hls.js/) | `1.6.16` | HLS 播放 |
| [Lucide React](https://lucide.dev/) | `0.577.0` | 图标库 |
| [@dnd-kit](https://dndkit.com/) | `6.x / 10.x` | 拖拽排序 |
| [@upstash/redis](https://github.com/upstash/redis-js) | `1.37.0` | Cloudflare / 托管环境 Redis REST 同步与托管账户 |
| TCP Redis (`redis://` / `rediss://`) | - | Docker / 自托管 Node.js 托管账户、同步与登录限流 |
| [opencc-js](https://github.com/nk2028/opencc-js) | `1.0.5` | 繁简转换辅助搜索 |

### 开发工具

| 工具 | 当前版本 |
|------|----------|
| ESLint | `9.25.1` |
| eslint-config-next | `16.2.4` |
| Playwright | `1.56.1` |
| OpenNext Cloudflare Adapter | `1.19.1` |
| next-on-pages | `1.13.16`（仅保留兼容用途） |
| TypeScript Runtime (`tsx`) | `4.20.6` |

## 快速开始

### 本地开发

```bash
npm install
npm run dev
```

默认地址：`http://localhost:3000`

### 传统 Node.js 自托管

```bash
npm install
npm run build
npm start
```

### Docker 部署

```bash
cp .env.example .env
# 编辑 .env：至少填写 AUTH_SECRET，并用 ADMIN_PASSWORD 或 ACCOUNTS 种子化首批托管账户
docker compose up -d
```

Compose 会同时启动：

- `kvideo`：Next.js standalone 服务
- `redis`：持久化 Redis，数据卷为 `kvideo-redis-data`

如果你不用 Compose，而是手动运行容器，必须自己提供可访问的 Redis：

```bash
docker build -t kvideo .
docker run -d \
  -p 3000:3000 \
  -e AUTH_SECRET="replace-with-a-real-secret" \
  -e ADMIN_PASSWORD="replace-with-a-real-password" \
  -e REDIS_URL="redis://your-redis-host:6379/0" \
  --name kvideo \
  kvideo
```

### Docker Hub 镜像

```bash
docker pull kuekhaoyang/kvideo:latest
docker run -d \
  -p 3000:3000 \
  -e AUTH_SECRET="replace-with-a-real-secret" \
  -e ADMIN_PASSWORD="replace-with-a-real-password" \
  -e REDIS_URL="redis://your-redis-host:6379/0" \
  --name kvideo \
  kuekhaoyang/kvideo:latest
```

### 完整功能与受限功能的边界

**完整能力路径：**

- 自托管 Node.js
- Docker

**受限托管路径：**

- Vercel
- Cloudflare 托管运行时
- Cloudflare Workers via OpenNext

这些托管路径默认会进入合规限制模式：

- 关闭外部媒体代理
- 关闭热链转发
- 关闭 IPTV 流中继

如果你需要 `/api/proxy`、IPTV 中继、自定义 `User-Agent` / `Referer` 转发等完整能力，就不要继续拿受限托管环境硬扛，直接换 Docker 或传统 Node.js 自托管。

### Cloudflare 路径

当前主要支持路径是 **Cloudflare Workers via OpenNext**：

```bash
npm run cf:build
npm run cf:preview
```

`npm run pages:build` 仍然保留，但只是给现存兼容链路兜底的遗留构建脚本，不是这条分支主张的 Cloudflare 主路径。

Cloudflare Workers 不能使用 Docker Compose 里的 TCP Redis。需要托管账户与同步时，在 Cloudflare 侧配置 `AUTH_SECRET`、`ADMIN_PASSWORD` / `ACCOUNTS`，以及 `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`。

### Android TV APK

仓库内提供轻量 Android TV WebView 壳工程，位于 `android-tv/`。

构建命令：

```bash
cd android-tv
./gradlew --no-daemon assembleDebug
```

如需在构建时预置默认地址：

```bash
cd android-tv
./gradlew --no-daemon assembleDebug -PkvideoUrl="https://your-kvideo-instance.com"
```

GitHub Actions 中的 `Android TV APK` 工作流支持手动触发并发布 APK 资产。

## PWA 与离线边界

当前离线支持是 **有限壳缓存**，不是完整离线播放器。

已缓存：

- `/`
- `offline.html`
- `manifest.json`
- 图标与同源静态资源

不会离线缓存：

- 远程媒体
- 代理响应
- IPTV 直播流
- API 数据

离线失败时会回退到 `public/offline.html`。

## Apple TV

Apple TV 在当前仓库中 **不支持**。

- 旧的 tvOS WebView 壳路径已经被移除
- 仓库内没有完整、受支持、可直接构建的 tvOS 产品链路
- 如需在 Apple 生态的大屏上使用，请改用浏览器、AirPlay 或其他已支持设备投屏

补充说明见 [`apple-tv/README.md`](apple-tv/README.md)。

## 常用命令

```bash
npm run dev
npm run lint
npm test
npm run test:e2e
npm run build
npm run cf:build
docker compose config
docker build -t kvideo .
cd android-tv && ./gradlew --no-daemon lint test assembleDebug assembleRelease
```

## 开发与贡献

提交代码前，至少运行与你改动范围匹配的检查。对较广泛的改动，建议覆盖以下矩阵：

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run cf:build`
- `docker compose config`
- `docker build -t kvideo .`
- `cd android-tv && ./gradlew --no-daemon lint test assembleDebug assembleRelease`

更多开发约束见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 版本与更新

- 当前版本：[`4.9.4`](CHANGELOG.md)
- 更新日志：[`CHANGELOG.md`](CHANGELOG.md)
- 应用内“版本与更新”卡片使用仓库内的 `app-release.json` 元数据

## 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 致谢

感谢以下开源项目：

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://github.com/pmndrs/zustand)
- [hls.js](https://github.com/video-dev/hls.js/)
- [Lucide](https://lucide.dev/)
- [dnd-kit](https://dndkit.com/)
- [OpenNext](https://opennext.js.org/)

## 联系方式

- 作者：[KuekHaoYang](https://github.com/KuekHaoYang)
- 项目主页：[KuekHaoYang/KVideo](https://github.com/KuekHaoYang/KVideo)
- 问题反馈：[GitHub Issues](https://github.com/KuekHaoYang/KVideo/issues)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=KuekHaoYang/KVideo&type=date&legend=top-left)](https://www.star-history.com/#KuekHaoYang/KVideo&type=date&legend=top-left)
