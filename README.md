[![Upstream Sync](https://github.com/sky06walker/KVideo/actions/workflows/Github_Upstream_Sync.yml/badge.svg)](https://github.com/sky06walker/KVideo/actions/workflows/Github_Upstream_Sync.yml)

# 视频聚合平台 (KVideo)

![KVideo Banner](public/icon.png)

> 一个基于 Next.js 16 构建的现代化视频聚合播放平台。采用独特的 "Liquid Glass" 设计语言，提供流畅的视觉体验和强大的视频搜索功能。

**在线体验：[https://kvideo.pages.dev/](https://kvideo.pages.dev/)**

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

## 项目简介

**KVideo** 是一个高性能、现代化的视频聚合与播放应用，专注于提供极致的用户体验和视觉设计。本项目利用 Next.js 16 的最新特性，结合 React 19 和 Tailwind CSS v4，打造了一个既美观又强大的视频浏览平台。

### 核心设计理念：Liquid Glass（液态玻璃）

项目的视觉设计基于 **"Liquid Glass"** 设计系统，这是一套融合了以下特性的现代化 UI 设计语言：

- **玻璃拟态效果**：通过 `backdrop-filter` 实现的磨砂半透明效果，让 UI 元素如同真实的玻璃材质
- **通用柔和度**：统一使用 `rounded-2xl` 和 `rounded-full` 两种圆角半径，创造和谐的视觉体验
- **光影交互**：悬停和聚焦状态下的内发光效果，模拟光线被"捕获"的物理现象
- **流畅动画**：基于物理的 `cubic-bezier` 曲线，实现自然的加速和减速过渡
- **深度层级**：清晰的 z-axis 层次结构，增强空间感和交互反馈

## 核心功能

### 智能视频播放

- **HLS 流媒体支持**：基于 [hls.js](https://github.com/video-dev/hls.js/) 原生支持 HLS (.m3u8) 格式，提供流畅的视频播放体验
- **播放控制**：完整的播放控制功能，包括进度条、音量控制、播放速度调节、全屏模式等
- **自动跳过片头/片尾**：可设置自动跳过片头和片尾的秒数
- **自动连播**：支持自动播放下一集
- **移动端优化**：专门为移动设备优化的播放器界面和双击手势控制
- **Chromecast 投屏**：支持通过 Google Cast 投屏到电视等设备
- **画中画 (PiP)**：支持浮动窗口模式播放
- **全屏模式选择**：支持系统全屏和网页全屏两种模式
- **代理播放**：三种代理模式（智能重试、仅直连、总是代理），灵活应对不同网络环境
- **卡顿检测**：自动检测播放卡顿并提示
- **键盘快捷键**：空格/K 播放暂停、F 全屏、M 静音、P 画中画、J/L/方向键 快进快退、上下键 音量调节

### 多源并行搜索

- **聚合搜索引擎**：同时在多个视频源中并行搜索，通过 Server-Sent Events (SSE) 实时返回结果
- **自定义视频源**：支持添加、编辑和管理自定义视频源
- **个人视频源**：非管理员用户可添加个人视频源，不影响其他用户（数据按用户隔离）
- **订阅源管理**：支持通过 JSON 链接批量导入和自动更新视频源
- **JSON 批量导入**：在导入设置中直接粘贴 JSON 数组格式的视频源进行批量添加
- **智能解析**：统一的解析器系统，自动处理不同源的数据格式
- **搜索历史**：自动保存搜索历史，支持快速重新搜索
- **搜索结果显示**：支持默认显示和合并同名源两种模式
- **实时延迟监测**：可选实时显示各源的网络延迟
- **清晰度标签**：自动解析并显示视频清晰度（4K/蓝光/1080P/720P/HD 等），方便快速分辨源质量
- **繁体中文搜索**：自动将繁体中文转换为简体中文进行搜索，确保繁体输入也能搜到结果
- **源过滤**：支持按源和类型筛选搜索结果，源标签支持按类型分组显示，智能合并同名分类标签，展开/折叠状态持久化记忆
- **多级标签**：搜索结果和播放器中显示源名称和内容类型双重标签

### 多线路折叠

- **智能折叠**：播放页面的线路列表默认只显示前 5 个源，避免长列表影响体验
- **展开/收起**：超过 5 个源时显示"展开更多 (N)"按钮，可随时展开查看全部线路
- **按类型分组**：当线路包含类型信息时，自动按内容类型分组显示（如"电影"、"电视剧"等）
- **延迟排序**：线路按网络延迟自动排序，最快的源排在前面
- **源切换**：在线路列表中快速切换到其他源，支持断点续播
- **自动切源**：当当前源不可用时，自动切换到延迟最低的可用源

### IPTV 直播

- **M3U 播放列表**：支持导入和管理 M3U/M3U8 格式的 IPTV 源
- **JSON 频道列表**：支持导入 JSON 格式的频道列表（数组或对象格式，自动识别）
- **频道网格**：按分组展示频道，支持分页浏览，大列表搜索优化
- **多级频道列表**：播放器内按源分组 → 按分类分组 → 频道的三级列表导航
- **多线路折叠**：频道多线路默认显示前 3 条，可点击展开查看全部
- **自动切源**：当视频源不可用时，自动选择延迟最低的可用源
- **自定义请求头**：自动解析 M3U 中的 `http-user-agent` 和 `http-referrer` 属性，通过代理传递
- **流媒体代理**：内置 HLS 流代理，自动处理 CORS 问题和 M3U8 URL 重写
- **智能内容检测**：当 content-type 不明确时，检查响应体内容自动识别 M3U8 格式，同时保持二进制流数据完整性
- **重定向跟随**：自动跟随 HTTP 3xx 重定向，提升兼容性
- **超时保护**：15 秒请求超时、30 秒加载超时、20 秒分片加载超时、3 次清单重试
- **逐源频道缓存**：每个 IPTV 源的频道独立缓存，避免重复加载
- **并发控制**：最多同时拉取 3 个源，防止网络拥堵
- **权限控制**：通过 `iptv_access` 权限控制谁可以访问 IPTV 功能
- **键盘快捷键**：播放器内支持空格暂停/继续、F 全屏、M 静音、方向键调节音量等
- **搜索优化**：播放器内搜索使用 `useTransition` 非阻塞渲染，避免大列表卡顿

### 豆瓣集成

- **电影 & 电视剧分类**：支持在电影和电视剧之间无缝切换，方便查找不同类型的影视资源
- **详细影视信息**：自动获取豆瓣评分、演员阵容、剧情简介等详细信息
- **推荐系统**：基于豆瓣数据的相关推荐
- **自定义标签管理**：支持拖拽排序的标签管理器，自定义首页推荐分类
- **可点击演员/导演**：播放页面的演员、导演名字可直接点击搜索其他作品

### 个性化推荐

- **基于观看历史**：根据观看历史自动分析偏好，推荐相关影视内容
- **智能分析**：分析最常观看的类型、演员和地区，生成精准推荐
- **标签集成**：推荐作为首个标签「为你推荐」出现在标签栏中（需观看 2 部以上作品）
- **自动加载**：无限滚动自动加载更多推荐内容
- **独立模式**：普通模式和高级模式的推荐互相独立
- **缓存优化**：推荐结果缓存 30 分钟，避免重复请求

### 收藏管理

- **一键收藏**：在搜索结果和播放页面快速收藏视频
- **收藏列表**：独立的收藏侧边栏，快速访问已收藏的视频
- **容量限制**：每个模式最多 100 条收藏
- **普通/高级隔离**：普通模式和高级模式的收藏互相独立
- **数据隔离**：多账户场景下，每个用户拥有独立的收藏数据

### 观看历史管理

- **自动记录**：自动记录观看进度和历史
- **断点续播**：从上次观看位置继续播放
- **智能去重**：按标题去重（V2），相同标题不同源的历史合并为一条
- **容量限制**：最多保存 50 条历史记录
- **历史管理**：支持删除单条历史或清空全部历史
- **隐私保护**：所有数据存储在本地，不上传到服务器

### 弹幕 (Danmaku)

- **弹幕聚合**：接入自建弹幕聚合 API（兼容 [danmu_api](https://github.com/huangxd-/danmu_api) 格式），自动匹配当前播放内容
- **Canvas 渲染**：基于 Canvas 的高性能弹幕渲染，支持数百条弹幕同时滚动，不影响播放交互
- **滚动/顶部/底部弹幕**：支持三种弹幕类型，自动分配轨道防止重叠
- **自定义显示**：可调节弹幕透明度（10%-100%）和字号（14/18/20/24/28px）
- **显示区域**：可选 25%/50%/75%/100% 的屏幕区域显示弹幕
- **播放器联动**：暂停时弹幕冻结，跳转时自动清除，全屏模式下正常显示
- **多 API 管理**：每个用户可添加多个弹幕 API，选择当前使用的 API
- **优先级规则**：用户选择的弹幕 API 优先于系统默认配置
- **环境变量预设**：可通过 `NEXT_PUBLIC_DANMAKU_API_URL` 为所有用户预设弹幕 API 地址

### 广告过滤

- **多模式选择**：支持关闭、关键词过滤、智能启发式过滤(Beta)和激进模式
- **UI 集成**：在播放器设置菜单中直接切换模式，实时生效
- **自定义关键词**：支持通过环境变量或文件扩展过滤关键词
- **高性能**：基于流式处理，对播放加载速度几乎无影响

### 响应式设计

- **全端适配**：完美支持桌面、平板、移动设备和 TV/机顶盒
- **移动优先**：专门的移动端组件和交互设计
- **触摸优化**：针对触摸屏优化的手势和交互（双击快进/快退、滑动音量控制）
- **TV 适配**：遥控器方向键导航和大屏 UI 优化

### 主题系统

- **深色/浅色模式**：支持系统级主题切换
- **动态主题**：基于 CSS Variables 的动态主题系统
- **无缝过渡**：主题切换时的平滑过渡动画

### PWA 支持

- **可安装应用**：支持将 KVideo 安装为独立应用
- **Service Worker**：离线缓存和资源预加载
- **全屏体验**：独立应用模式下的沉浸式体验

### 无障碍设计

- **键盘导航**：完整的键盘快捷键支持（播放控制、音量、进度等）
- **ARIA 标签**：符合 WCAG 标准的无障碍实现
- **语义化 HTML**：使用语义化标签提升可访问性

### 高级模式

- **独立入口**：在浏览器地址栏直接输入 `/premium` 即可进入独立的高级视频专区
- **内容隔离**：高级内容与普通内容完全物理隔离，互不干扰
- **专属设置**：拥有独立的内容源管理和功能设置（播放器、显示、弹幕等设置完全独立）
- **独立推荐**：基于高级模式观看历史的个性化推荐，与普通模式互不影响
- **分类浏览**：支持模糊匹配合并多源的相同分类标签，提供统一浏览体验
- **交错排列**：多源结果智能交错排列，平衡各源展示

### TV/大屏适配

- **自动检测**：自动检测 TV 浏览器（Smart TV、Tizen、WebOS、Fire TV 等）
- **空间导航**：支持遥控器/方向键在页面元素间导航
- **10 英尺 UI**：TV 模式下自动放大字体、交互元素和间距
- **焦点高亮**：TV 模式下聚焦元素显示醒目的高亮边框和缩放效果
- **播放器兼容**：播放器区域不受空间导航干扰，方向键正常控制播放

### Android TV 应用

- **WebView 封装**：基于 Android WebView 的轻量 APK，直接加载 KVideo 网页
- **遥控器支持**：D-pad 中心键映射为 Enter，Back 键映射为网页后退
- **全屏沉浸**：自动横屏、全屏、硬件加速
- **Leanback 启动器**：支持从 Android TV 主屏直接启动
- **可配置 URL**：在 `MainActivity.kt` 中修改 `KVIDEO_URL` 常量指向你的部署实例

### Apple TV 应用

- **WKWebView 封装**：基于 tvOS WKWebView 的轻量 SwiftUI 应用，直接加载 KVideo 网页
- **遥控器支持**：滑动手势映射为滚动，点击映射为聚焦/选择，Menu 按钮支持网页后退
- **TV 模式注入**：页面加载后自动注入 `tv-mode` CSS 类，激活大屏优化样式
- **可配置 URL**：在 `ContentView.swift` 中修改 `kvideoURL` 常量指向你的部署实例

### 数据管理

- **设置导出/导入**：支持将所有设置导出为 JSON 文件，方便备份和迁移
- **JSON 批量导入**：支持粘贴 JSON 数组格式的视频源进行批量导入
- **滚动位置记忆**：退出或刷新页面后，自动恢复到之前的滚动位置
- **返回顶部**：一键返回页面顶部
- **数据隔离**：多账户场景下，所有用户数据（历史、收藏、设置、个人源）按 profileId 完全隔离

## 隐私保护

本应用注重用户隐私：

- **本地存储**：所有数据存储在本地浏览器中
- **无服务器数据**：不收集或上传任何用户数据
- **自定义源**：用户可自行配置视频源
- **数据隔离**：多账户场景下，每个用户的数据（历史、收藏、设置、个人源）完全隔离
- **Profile ID**：基于密码的 SHA-256 哈希生成唯一用户标识，密码不可逆推

## 账户与访问控制

KVideo 支持基于环境变量的账户认证系统，支持角色区分和细粒度权限控制。

### 方式一：单管理员密码

通过 `ADMIN_PASSWORD` 环境变量设置管理员密码：

```bash
# Docker
docker run -d -p 3000:3000 -e ADMIN_PASSWORD=your_password --name kvideo kuekhaoyang/kvideo:latest
```

登录后自动获得超级管理员权限，可管理所有设置。

> **向后兼容**：`ACCESS_PASSWORD` 环境变量仍然有效，当 `ADMIN_PASSWORD` 未设置时，`ACCESS_PASSWORD` 将作为管理员密码使用。

### 方式二：多账户系统

通过 `ACCOUNTS` 环境变量配置多个账户，每个账户拥有独立的数据空间（收藏、历史、设置、个人源等）。

**格式：** `密码:名称[:角色[:权限1|权限2|...]]`，多个账户用逗号分隔。

- **角色**：`super_admin`（超级管理员）、`admin`（管理员）或 `viewer`（观众，默认）
- **权限**（可选）：使用 `|` 分隔，为该账户添加其角色之外的额外权限

```bash
# 基本用法
docker run -d -p 3000:3000 \
  -e ACCOUNTS="pass1:张三:admin,pass2:李四:viewer,pass3:王五" \
  --name kvideo kuekhaoyang/kvideo:latest

# 为观众添加额外权限（如 IPTV 访问和源管理）
docker run -d -p 3000:3000 \
  -e ACCOUNTS="pass1:张三:admin,pass2:李四:viewer:iptv_access|source_management" \
  --name kvideo kuekhaoyang/kvideo:latest
```

**特点：**
- 每个账户拥有独立的收藏、历史、设置和个人视频源数据
- 可同时配置 `ADMIN_PASSWORD`（作为超级管理员入口）
- 支持为任何角色添加额外的自定义权限

### 角色与权限

| 权限 | 说明 | super_admin | admin | viewer |
|------|------|:-----------:|:-----:|:------:|
| `source_management` | 管理系统视频源 | ✓ | - | - |
| `account_management` | 查看账户列表 | ✓ | - | - |
| `danmaku_api` | 配置系统弹幕 API | ✓ | - | - |
| `data_management` | 导出/导入/重置数据 | ✓ | - | - |
| `player_settings` | 播放器设置 | ✓ | ✓ | - |
| `danmaku_appearance` | 弹幕外观设置 | ✓ | ✓ | - |
| `view_settings` | 显示设置 | ✓ | ✓ | ✓ |
| `iptv_access` | 访问 IPTV 功能 | ✓ | ✓ | - |

> 通过 ACCOUNTS 的第 4 个字段，可以为任何角色添加上表中的额外权限。例如让观众也能访问 IPTV：`password:name:viewer:iptv_access`

### 个人视频源与弹幕 API

所有已登录的用户（包括观众）都可以：

- **添加个人视频源**：在设置页面添加自己的视频源，仅对自己可见，不影响其他用户
- **管理弹幕 API**：添加多个弹幕 API 端点，选择当前使用的 API（优先于系统默认）

这些数据按用户 profileId 隔离存储，切换账户后自动加载对应的个人配置。

### 方式三：高级内容独立密码

通过 `PREMIUM_PASSWORD` 环境变量为高级内容（`/premium`）设置独立的访问密码，实现与主密码的分离控制。

适合场景：给家人分享普通密码，但高级内容需要额外密码才能访问。

```bash
# Docker
docker run -d -p 3000:3000 \
  -e ADMIN_PASSWORD="admin123" \
  -e PREMIUM_PASSWORD="premium456" \
  --name kvideo kuekhaoyang/kvideo:latest
```

**特点：**
- 访问 `/premium` 页面时需输入此专用密码
- 管理员密码和 admin/super_admin 账号也可以解锁高级内容
- 密码仅在当前浏览器会话有效，关闭浏览器后需重新输入
- 不设置此变量时，高级内容无额外密码保护

### 方式四：会话持久化设置

通过 `PERSIST_SESSION` 环境变量控制用户登录后是否在设备上记住会话：

| 变量名 | 选项 | 说明 | 默认值 |
|--------|------|------|--------|
| `PERSIST_SESSION` | `true` / `false` | 是否在本地浏览器持久化保存登录状态。设置为 `true` 时，用户只需登录一次，后续访问无需再次登录。 | `true` |

> [!NOTE]
> 此功能仅在设置了 `ADMIN_PASSWORD`、`ACCESS_PASSWORD` 或 `ACCOUNTS` 时才会生效。

## 站点名称自定义配置

通过环境变量可以自定义站点名称、标题和描述，无需修改源代码。

### 可用环境变量：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NEXT_PUBLIC_SITE_TITLE` | 浏览器标签页标题 | `KVideo - 视频聚合平台` |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | 站点描述 | `视频聚合平台` |
| `NEXT_PUBLIC_SITE_NAME` | 站点头部名称 | `KVideo` |

### 配置示例：

**Vercel 部署：**
在 Vercel 项目设置中添加环境变量：

- 变量名：`NEXT_PUBLIC_SITE_NAME`
- 变量值：`我的视频平台`

**Cloudflare Pages 部署：**
在 Cloudflare Pages 项目设置中添加环境变量：
- 变量名：`NEXT_PUBLIC_SITE_NAME`
- 变量值：`我的视频平台`

**Docker 部署：**
```bash
docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_SITE_NAME="我的视频平台" \
  -e NEXT_PUBLIC_SITE_TITLE="我的视频 - 聚合播放平台" \
  -e NEXT_PUBLIC_SITE_DESCRIPTION="专属视频聚合播放平台" \
  --name kvideo kuekhaoyang/kvideo:latest
```

**本地开发：**
在项目根目录创建 `.env.local` 文件：
```env
NEXT_PUBLIC_SITE_NAME=我的视频平台
NEXT_PUBLIC_SITE_TITLE=我的视频 - 聚合播放平台
NEXT_PUBLIC_SITE_DESCRIPTION=专属视频聚合播放平台
```

## 自动订阅源配置

可以通过环境变量自动配置订阅源，应用启动时会自动加载并设置为自动更新。

支持两种环境变量名：`SUBSCRIPTION_SOURCES`（服务端） 和 `NEXT_PUBLIC_SUBSCRIPTION_SOURCES`（客户端构建时嵌入）。

**格式：** JSON 数组字符串，包含 `name` 和 `url` 字段；或直接提供订阅 URL（逗号分隔多个）。

**示例：**

```bash
# JSON 格式
SUBSCRIPTION_SOURCES='[{"name":"每日更新源","url":"https://example.com/api.json"},{"name":"备用源","url":"https://backup.com/api.json"}]'

# 简单 URL 格式
SUBSCRIPTION_SOURCES='https://example.com/api.json,https://backup.com/api.json'
```

**Docker 部署：**

```bash
docker run -d -p 3000:3000 -e SUBSCRIPTION_SOURCES='[{"name":"MySource","url":"..."}]' --name kvideo kuekhaoyang/kvideo:latest
```

**Vercel 部署：**

在 Vercel 项目设置中添加环境变量：
- 变量名：`SUBSCRIPTION_SOURCES`
- 变量值：`[{"name":"...","url":"..."}]`

**Cloudflare Pages 部署：**

在 Cloudflare Pages 项目设置中添加环境变量：
- 变量名：`NEXT_PUBLIC_SUBSCRIPTION_SOURCES`
- 变量值：`[{"name":"...","url":"..."}]`

## 广告过滤关键词配置

通过环境变量自定义广告过滤关键词，用于在 HLS 播放时识别和过滤广告片段。

| 变量名 | 说明 |
|--------|------|
| `AD_KEYWORDS` 或 `NEXT_PUBLIC_AD_KEYWORDS` | 广告关键词，逗号或换行分隔 |
| `AD_KEYWORDS_FILE` | 广告关键词文件路径（适用于 Docker 挂载） |

**示例：**

```bash
# 环境变量方式
AD_KEYWORDS="ad,sponsor,preroll,midroll"

# Docker 挂载文件方式
docker run -d -p 3000:3000 \
  -v /path/to/keywords.txt:/app/keywords.txt \
  -e AD_KEYWORDS_FILE=/app/keywords.txt \
  --name kvideo kuekhaoyang/kvideo:latest
```

## 弹幕 API 配置

通过环境变量预设弹幕聚合 API 地址，用户无需手动配置即可使用弹幕功能。

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NEXT_PUBLIC_DANMAKU_API_URL` | 弹幕聚合 API 地址 | - |

需要自建或使用兼容 [danmu_api](https://github.com/huangxd-/danmu_api) 格式的弹幕聚合服务。

**示例：**

```bash
# Docker
docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_DANMAKU_API_URL="https://your-danmu-api.example.com" \
  --name kvideo kuekhaoyang/kvideo:latest
```

设置后用户在播放器菜单中即可直接开启弹幕，也可在设置页面中覆盖此地址。

> 用户还可以在设置页面的「弹幕 API」区域添加多个 API 端点并选择当前使用的，用户选择的 API 优先于系统默认配置。

## IPTV 直播源配置

通过环境变量预设 IPTV 直播源，应用启动时会自动添加到直播源列表中。

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `IPTV_SOURCES` | IPTV 直播源配置（服务端） | - |
| `NEXT_PUBLIC_IPTV_SOURCES` | IPTV 直播源配置（客户端） | - |

**格式：** JSON 数组字符串，包含 `name` 和 `url` 字段；或直接提供 M3U 链接（逗号分隔多个）。

**示例：**

```bash
# JSON 格式
IPTV_SOURCES='[{"name":"央视","url":"https://example.com/cctv.m3u"},{"name":"地方台","url":"https://example.com/local.m3u"}]'

# 简单 URL 格式
IPTV_SOURCES='https://example.com/cctv.m3u,https://example.com/local.m3u'
```

## 合并同名源配置

通过环境变量设置默认启用搜索结果的合并同名源显示模式。

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `MERGE_SOURCES` | 启用合并同名源（`true` 或 `1`） | - |
| `NEXT_PUBLIC_MERGE_SOURCES` | 启用合并同名源（客户端） | - |

**示例：**

```bash
MERGE_SOURCES=true
```

设置后搜索结果会自动以合并模式显示，将来自不同源的同名视频合并为一个卡片。用户仍可在设置页面中手动切换显示模式。

## 自定义端口

通过 `PORT` 环境变量自定义应用端口，默认为 3000。

```bash
# 开发模式
PORT=8080 npm run dev

# 生产模式
PORT=8080 npm run start

# Docker
docker run -e PORT=8080 -p 8080:8080 --name kvideo kuekhaoyang/kvideo:latest
```

## 自定义源 JSON 格式

如果你想创建自己的订阅源或批量导入源，可以使用以下 JSON 格式。

**基本结构：**

可以是单个对象数组，也可以是包含 `sources` 或 `list` 字段的对象。

**源对象字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 否 | 唯一标识符，自动生成或自定义 |
| `name` | string | 是 | 显示名称 |
| `baseUrl` | string | 是 | API 地址 (例如: `https://example.com/api.php/provide/vod`) |
| `searchPath` | string | 否 | 搜索路径，默认 `/provide/vod` |
| `detailPath` | string | 否 | 详情路径，默认 `/provide/vod` |
| `group` | string | 否 | 分组，可选值: `"normal"` (默认) 或 `"premium"` |
| `enabled` | boolean | 否 | 是否启用，默认为 `true` |
| `priority` | number | 否 | 优先级，数字越小优先级越高，默认为 1 |
| `headers` | object | 否 | 自定义请求头 |

**示例 JSON：**

```json
[
  {
    "id": "my_source_1",
    "name": "我的精选源",
    "baseUrl": "https://api.example.com/vod",
    "group": "normal",
    "priority": 1
  },
  {
    "id": "premium_source_1",
    "name": "特殊资源",
    "baseUrl": "https://api.premium-source.com/vod",
    "group": "premium",
    "enabled": true
  }
]
```

### JSON 批量导入

除了通过订阅 URL 或文件导入外，还可以在导入设置中选择 **JSON** 标签页，直接粘贴上述格式的 JSON 数组进行批量导入。系统会解析、预览数量后再确认导入。

### 重要的区别说明：订阅源 vs 视频源

**这是一个常见的误区，请仔细阅读：**

- **视频源 (Source)**：
  - 指向单个 CMS/App API 接口
  - 例如：`https://api.example.com/vod`
  - 这种链接**不能**直接作为"订阅"添加
  - 只能在"自定义源管理"中作为单个源添加

- **订阅源 (Subscription)**：
  - 指向一个 **JSON 文件**（如上面的示例）的 URL
  - 这个 JSON 文件里包含了一个或多个视频源的列表
  - 例如：`https://mysite.com/kvideo-sources.json`
  - 这是一个**配置文件**的链接，不是视频 API 的链接
  - 只有这种返回 JSON 列表的链接才能在"订阅管理"中添加

> **简单来说**：如果你只有一个 m3u8 或 API 接口地址，请去"自定义源"添加。如果你有一个包含多个源的 JSON 文件链接，请去"订阅管理"添加。

## 全部环境变量参考

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `ADMIN_PASSWORD` | 管理员密码 | - |
| `ACCESS_PASSWORD` | 访问密码（向后兼容，等同于 `ADMIN_PASSWORD`） | - |
| `ACCOUNTS` | 多账户配置，格式：`密码:名称[:角色[:权限1\|权限2]]`，逗号分隔 | - |
| `PREMIUM_PASSWORD` | 高级内容独立密码，访问 `/premium` 时需输入 | - |
| `PERSIST_SESSION` | 是否持久化登录会话 | `true` |
| `PORT` | 自定义应用端口 | `3000` |
| `NEXT_PUBLIC_SITE_TITLE` | 浏览器标签页标题 | `KVideo - 视频聚合平台` |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | 站点描述 | `视频聚合平台` |
| `NEXT_PUBLIC_SITE_NAME` | 站点头部名称 | `KVideo` |
| `SUBSCRIPTION_SOURCES` | 自动订阅源配置（服务端） | - |
| `NEXT_PUBLIC_SUBSCRIPTION_SOURCES` | 自动订阅源配置（客户端） | - |
| `IPTV_SOURCES` / `NEXT_PUBLIC_IPTV_SOURCES` | IPTV 直播源配置 | - |
| `MERGE_SOURCES` / `NEXT_PUBLIC_MERGE_SOURCES` | 启用合并同名源显示（`true`/`1`） | - |
| `AD_KEYWORDS` / `NEXT_PUBLIC_AD_KEYWORDS` | 广告过滤关键词 | - |
| `AD_KEYWORDS_FILE` | 广告关键词文件路径 | - |
| `NEXT_PUBLIC_DANMAKU_API_URL` | 弹幕聚合 API 地址 | - |

## 技术栈

### 前端核心

| 技术 | 版本 | 用途 |
|------|------|------|
| **[Next.js](https://nextjs.org/)** | 16.1.6 | React 框架，使用 App Router |
| **[React](https://react.dev/)** | 19.2.4 | UI 组件库 |
| **[TypeScript](https://www.typescriptlang.org/)** | 5.x | 类型安全的 JavaScript |
| **[Tailwind CSS](https://tailwindcss.com/)** | 4.x | 实用优先的 CSS 框架 |
| **[Zustand](https://github.com/pmndrs/zustand)** | 5.x | 轻量级状态管理 |
| **[hls.js](https://github.com/video-dev/hls.js/)** | 1.x | HLS 流媒体播放引擎 |
| **[Lucide React](https://lucide.dev/)** | 0.x | 图标库 |
| **[@dnd-kit](https://dndkit.com/)** | 6.x | 拖拽交互（标签排序等） |

### 开发工具

- **ESLint 10**：代码质量检查
- **PostCSS 8**：CSS 处理器
- **Vercel Analytics**：性能监控和分析
- **Cloudflare Pages**：边缘部署支持

### 架构特点

- **App Router**：Next.js 的新路由系统，支持服务端组件和流式渲染
- **API Routes**：内置 API 端点，处理认证、豆瓣数据、视频源代理、IPTV 代理和弹幕聚合
- **Server-Sent Events**：搜索 API 使用 SSE 流式返回实时结果
- **Service Worker**：PWA 支持和资源缓存
- **Server Components**：优化首屏加载性能
- **Client Components**：复杂交互和状态管理
- **Edge Runtime**：API 路由运行在 Edge Runtime 上，提供更低延迟
- **Profile-based Storage**：所有用户数据按 profileId（SHA-256 哈希）隔离存储

## 快速部署

### 部署到自己的服务器

#### 选项 1：Vercel 一键部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/KuekHaoYang/KVideo)

1. 点击上方按钮
2. 连接你的 GitHub 账号
3. Vercel 会自动检测 Next.js 项目并部署
4. 几分钟后即可访问你自己的 KVideo 实例

#### 选项 2：Cloudflare Pages 部署 (推荐)

此方法完全免费且速度极快，是部署本项目的最佳选择。

1. **Fork 本仓库**：首先将项目 Fork 到你的 GitHub 账户。

2. **创建项目**：
   - 点击访问 [**Cloudflare Pages - Connect Git**](https://dash.cloudflare.com/?to=/:account/pages/new/provider/github)。
   - 如果未连接 GitHub，请点击 **Connect GitHub**；若已连接，直接选择你刚刚 Fork 的 `KVideo` 项目并点击 **Begin setup**。

3. **配置构建参数**：
   - **Project name**: 默认为 `kvideo` (建议保持不变，后续链接基于此名称)
   - **Framework Preset**: 选择 `Next.js`
   - **Build command**: 输入 `npm run pages:build`
   - **Build output directory**: 输入 `.vercel/output/static`
   - 点击 **Save and Deploy**。

4. **等待部署完成**：
   > 项目已内置 `wrangler.toml` 配置文件，其中包含 `nodejs_compat` 兼容性标志，无需手动配置。

5. **如果部署失败**：
   > 如果看到 `Unknown internal error occurred` 错误，这通常是 Cloudflare 的临时服务端问题。请在 **Deployments** 列表中找到最新部署，点击 `...` 菜单选择 **Retry deployment** 重试即可。
   >
   > 如果首次部署仍有问题，可尝试在 **[项目设置页面](https://dash.cloudflare.com/?to=/:account/pages/view/kvideo/settings/production)** 底部的 **Compatibility flags** 中手动添加 `nodejs_compat`，然后重新部署。

#### 选项 3：Docker 部署

**从 Docker Hub 拉取（最简单）：**

```bash
# 拉取最新版本
docker pull kuekhaoyang/kvideo:latest
docker run -d -p 3000:3000 --name kvideo kuekhaoyang/kvideo:latest
```

应用将在 `http://localhost:3000` 启动。

> **多架构支持**：镜像支持 2 种主流平台架构：
> - `linux/amd64` - Intel/AMD 64位（大多数服务器、PC、Intel Mac）
> - `linux/arm64` - ARM 64位（Apple Silicon Mac、AWS Graviton、树莓派 4/5）

**自己构建镜像：**

```bash
git clone https://github.com/KuekHaoYang/KVideo.git
cd KVideo
docker build -t kvideo .
docker run -d -p 3000:3000 --name kvideo kvideo
```

**使用 Docker Compose：**

```bash
docker-compose up -d
```

**完整配置示例（Docker）：**

```bash
docker run -d -p 3000:3000 \
  -e ADMIN_PASSWORD="admin123" \
  -e PREMIUM_PASSWORD="premium456" \
  -e ACCOUNTS="user1:用户一:admin,user2:用户二:viewer:iptv_access" \
  -e NEXT_PUBLIC_SITE_NAME="我的视频" \
  -e NEXT_PUBLIC_DANMAKU_API_URL="https://danmaku.example.com" \
  -e SUBSCRIPTION_SOURCES='[{"name":"默认源","url":"https://example.com/sources.json"}]' \
  -e IPTV_SOURCES='[{"name":"央视","url":"https://example.com/cctv.m3u"}]' \
  -e MERGE_SOURCES=true \
  --name kvideo kuekhaoyang/kvideo:latest
```

#### 选项 4：传统 Node.js 部署

```bash
# 1. 克隆仓库
git clone https://github.com/KuekHaoYang/KVideo.git
cd KVideo

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 启动生产服务器
npm start
```

应用将在 `http://localhost:3000` 启动。

#### 选项 5：Android TV APK 构建

项目内置了一个轻量的 Android TV WebView 壳应用，可以将 KVideo 打包成 APK 安装到 Android TV 或机顶盒上。

**前置要求：**

- [Android Studio](https://developer.android.com/studio)（推荐）或 Android SDK Command-line Tools
- JDK 17+

**步骤：**

1. **修改目标 URL**：编辑 `android-tv/app/src/main/java/com/kvideo/tv/MainActivity.kt`，将 `KVIDEO_URL` 改为你的部署地址：
   ```kotlin
   private const val KVIDEO_URL = "https://your-kvideo-instance.com"
   ```

2. **使用 Android Studio 构建（推荐）**：
   - 用 Android Studio 打开 `android-tv/` 目录
   - 等待 Gradle 同步完成
   - 点击 **Build → Build Bundle(s) / APK(s) → Build APK(s)**
   - APK 输出在 `android-tv/app/build/outputs/apk/debug/app-debug.apk`

3. **使用命令行构建**：
   ```bash
   cd android-tv
   ./gradlew assembleDebug
   ```
   APK 输出在 `app/build/outputs/apk/debug/app-debug.apk`

4. **安装到 Android TV**：
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```
   或通过 U 盘、文件管理器等方式侧载安装。

> **注意**：此 APK 是一个 WebView 壳应用，需要你的 KVideo 实例已经部署并可访问。APK 本身不包含 KVideo 代码，仅作为 TV 端的浏览器入口。
>
> **最低系统要求**：Android 8.0 (API 26) 及以上。Android 7.0 及更低版本的 WebView 不支持本项目使用的 ES2017+ JavaScript 特性和现代 CSS，可能导致白屏。如遇白屏问题，请升级系统 WebView 或使用 Android 8.0+ 设备。

#### 选项 6：Apple TV 应用构建

项目内置了一个轻量的 tvOS WKWebView 壳应用，可以将 KVideo 安装到 Apple TV 上。

**前置要求：**

- macOS + Xcode 15+
- Apple Developer 账号（免费账号即可侧载到个人设备）

**步骤：**

1. **创建 Xcode 项目**：打开 Xcode → **File → New → Project** → 选择 **tvOS → App** → 设置 Product Name 为 `KVideoTV`，Interface 选 **SwiftUI**，Language 选 **Swift**

2. **替换源文件**：将项目中 `apple-tv/KVideoTV/KVideoTV/` 目录下的 `KVideoTVApp.swift` 和 `ContentView.swift` 复制替换 Xcode 生成的同名文件

3. **修改目标 URL**：编辑 `ContentView.swift`，将 `kvideoURL` 改为你的部署地址：
   ```swift
   let kvideoURL = "https://your-kvideo-instance.com"
   ```

4. **设置部署目标**：将 Deployment Target 设置为 **tvOS 16.0** 或更高

5. **构建运行**：连接 Apple TV（或使用 tvOS 模拟器），按 **Cmd+R** 构建运行

**工作原理：**
- 全屏 `WKWebView` 加载 KVideo URL
- 页面加载后自动注入 `tv-mode` CSS 类，激活 TV 优化样式
- Apple TV 遥控器滑动手势映射为滚动，点击映射为聚焦/选择
- Menu 按钮支持网页后退导航

> **注意**：Apple TV 应用如果仅是 Web 壳应用，不可上架 App Store。此功能仅供个人侧载使用。也可以直接从 iPhone/iPad/Mac 使用 AirPlay 投屏，无需此应用。

## 如何更新

### Vercel 部署

Vercel 会自动检测 GitHub 仓库的更新并重新部署，无需手动操作。

### Docker 部署

当有新版本发布时：

```bash
# 停止并删除旧容器
docker stop kvideo
docker rm kvideo

# 拉取最新镜像
docker pull kuekhaoyang/kvideo:latest

# 运行新容器
docker run -d -p 3000:3000 --name kvideo kuekhaoyang/kvideo:latest
```

### Node.js 部署

```bash
cd KVideo
git pull origin main
npm install
npm run build
npm start
```

> **自动化部署**：本项目使用 GitHub Actions 自动构建和发布 Docker 镜像。每次代码推送到 main 分支时，会自动构建多架构镜像并推送到 Docker Hub。

## 常见问题

### Cloudflare Pages 部署报 "Unknown internal error"

这是 Cloudflare 的临时服务端错误，与代码无关。请在 Deployments 列表中重试部署即可。项目已内置 `wrangler.toml` 配置 `nodejs_compat` 兼容性标志。

### IPv6 环境下 HTTPS 访问视频无法播放

如果你的网络使用 IPv6 访问，且通过路由器端口映射（如 20443 → 443），请确保：
- 反向代理（如 Caddy/Nginx）正确监听 IPv6 地址
- 路由器的 IPv6 端口映射规则与 IPv4 一致
- 如使用非标准端口，确保 IPv6 防火墙规则也已放行

这是网络/反向代理配置问题，非 KVideo 代码问题。

### Android 7.0 设备白屏

Android 7.0 (API 24) 的 WebView 基于 Chrome 51，不支持本项目使用的现代 JavaScript（ES2017+）和 CSS 特性。最低要求 Android 8.0 (API 26) 及以上。

### IPTV 部分直播流无法播放

浏览器原生仅支持 HLS (m3u8) 和部分 MP4/WebM 格式。以下格式在浏览器中不受支持：
- RTMP/RTSP 流（需要专用播放器如 VLC/PotPlayer）
- 某些加密或受 DRM 保护的流
- 需要特定客户端验证的流

KVideo 已内置代理服务器自动处理 CORS 问题和 HLS URL 重写，大部分 HLS 直播流应能正常播放。

## 贡献代码

我们非常欢迎各种形式的贡献！无论是报告 Bug、提出新功能建议、改进文档，还是提交代码，你的每一份贡献都让这个项目变得更好。

**想要参与开发？请查看 [贡献指南](CONTRIBUTING.md) 了解详细的开发规范和流程。**

快速开始：
1. **报告 Bug**：[提交 Issue](https://github.com/KuekHaoYang/KVideo/issues)
2. **功能建议**：在 Issues 中提出你的想法
3. **代码贡献**：Fork → Branch → PR
4. **文档改进**：直接提交 PR

## 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 致谢

感谢以下开源项目：

- [Next.js](https://nextjs.org/) - React 框架
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Zustand](https://github.com/pmndrs/zustand) - 状态管理
- [React](https://react.dev/) - UI 库
- [hls.js](https://github.com/video-dev/hls.js/) - HLS 播放引擎
- [Lucide](https://lucide.dev/) - 图标库
- [dnd-kit](https://dndkit.com/) - 拖拽交互

## 联系方式

- **作者**：[KuekHaoYang](https://github.com/KuekHaoYang)
- **项目主页**：[https://github.com/KuekHaoYang/KVideo](https://github.com/KuekHaoYang/KVideo)
- **问题反馈**：[GitHub Issues](https://github.com/KuekHaoYang/KVideo/issues)

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/KuekHaoYang">KuekHaoYang</a>
  <br>
  如果这个项目对你有帮助，请考虑给一个 ⭐️
</div>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=KuekHaoYang/KVideo&type=date&legend=top-left)](https://www.star-history.com/#KuekHaoYang/KVideo&type=date&legend=top-left)
