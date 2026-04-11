# 贡献指南 (Contributing Guide)

欢迎来到 **KVideo** 项目！我们非常感谢你愿意为这个项目做出贡献。无论是修复 Bug、添加新功能、改进文档，还是提出建议，你的每一份贡献都将让这个项目变得更好。

为了确保协作顺畅、代码质量一致，请在提交贡献前仔细阅读本指南。

## 📋 目录

- [行为准则](#行为准则)
- [快速开始](#快速开始)
- [开发环境设置](#开发环境设置)
- [代码规范](#代码规范)
- [Git 工作流程](#git-工作流程)
- [提交规范](#提交规范)
- [Pull Request 指南](#pull-request-指南)
- [设计系统规范](#设计系统规范)
- [测试要求](#测试要求)
- [常见问题](#常见问题)

## 🤝 行为准则

我们致力于构建一个开放、友好、包容的社区环境。请在参与项目时：

- ✅ 保持尊重和礼貌
- ✅ 欢迎不同的观点和经验
- ✅ 接受建设性的批评
- ✅ 专注于对社区最有利的事情
- ❌ 不要使用性别化的语言或图像
- ❌ 不要进行人身攻击或政治攻击
- ❌ 不要骚扰或歧视他人

详细的行为准则请参阅 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 🚀 快速开始

### 我能贡献什么？

以下是一些你可以做出贡献的方式：

1. **🐛 报告 Bug**：发现了问题？请提交 Issue
2. **💡 提出新功能**：有好想法？在 Discussions 或 Issues 中分享
3. **📝 改进文档**：发现文档不清晰或有错误？帮助我们改进
4. **🎨 优化 UI/UX**：让界面更美观、更易用
5. **⚡ 性能优化**：让应用运行得更快
6. **🔧 修复 Bug**：解决现有的问题
7. **✨ 添加功能**：实现新的特性

### 第一次贡献？

如果这是你第一次为开源项目做贡献，我们推荐：

1. 浏览 [GitHub Issues](https://github.com/KuekHaoYang/KVideo/issues)
2. 寻找标记为 `good first issue` 的问题
3. 在 Issue 中评论，表明你想要解决这个问题
4. 按照本指南进行开发和提交

## 🛠 开发环境设置

### 系统要求

确保你的开发环境满足以下要求：

| 工具 | 最低版本 | 推荐版本 | 检查命令 |
|------|----------|----------|----------|
| **Node.js** | 20.0.0 | 22.x LTS | `node --version` |
| **npm** | 9.0.0 | 10.x | `npm --version` |
| **Git** | 2.30.0 | 最新版本 | `git --version` |

### 详细设置步骤

#### 1. Fork 仓库

点击 GitHub 页面右上角的 "Fork" 按钮，将项目 Fork 到你的账号下。

#### 2. 克隆仓库

```bash
# 克隆你 Fork 的仓库
git clone https://github.com/YOUR_USERNAME/KVideo.git
cd KVideo

# 添加上游仓库
git remote add upstream https://github.com/KuekHaoYang/KVideo.git
```

#### 3. 安装依赖

```bash
npm install
```

#### 4. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000` 查看应用。

#### 5. 验证环境

确保以下命令都能正常运行：

```bash
# 代码检查
npm run lint

# 构建测试
npm run build
```

## 📏 代码规范

### 核心规范

#### 1. 文件长度限制 ⚠️

> [!CAUTION]
> **这是项目的硬性规则！所有项目文件必须保持在 150 行以内（除系统文件外）。**

**检查命令：**

```bash
find . -type f -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*" -not -name "package-lock.json" -not -name "*.png" -not -name "*.md" | xargs wc -l | awk '$1 > 150 && $2 != "total" {print $2 " - " $1 "行"}'
```

**如果命令有输出，说明有文件超过 150 行，必须重构！**

**重构策略：**

如果文件超过 150 行，请使用以下方法重构：

##### A. 提取组件

**问题：** 一个组件太长，包含太多 JSX

**解决方案：** 将大组件拆分为多个小组件

```typescript
// ❌ 不好：一个 200 行的大组件
export function VideoPlayer() {
  // 150+ 行代码
  return (
    <div>
      {/* 大量 JSX */}
    </div>
  );
}

// ✅ 好：拆分为多个小组件
export function VideoPlayer() {
  return (
    <div>
      <PlayerControls />
      <ProgressBar />
      <VolumeControl />
    </div>
  );
}

// PlayerControls.tsx (单独文件)
export function PlayerControls() { /* ... */ }

// ProgressBar.tsx (单独文件)
export function ProgressBar() { /* ... */ }

// VolumeControl.tsx (单独文件)
export function VolumeControl() { /* ... */ }
```

##### B. 提取自定义 Hook

**问题：** 组件包含大量状态逻辑

**解决方案：** 将逻辑提取到自定义 Hook

```typescript
// ❌ 不好：组件内有大量状态逻辑
export function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  // ... 大量逻辑
  
  const handleSearch = async () => {
    // ... 50+ 行逻辑
  };
  
  return <div>{/* JSX */}</div>;
}

// ✅ 好：提取到自定义 Hook
export function SearchPage() {
  const { query, results, loading, handleSearch } = useSearch();
  return <div>{/* JSX */}</div>;
}

// useSearch.ts (单独文件)
export function useSearch() {
  // ... 所有状态逻辑
  return { query, results, loading, handleSearch };
}
```

##### C. 提取工具函数

**问题：** 文件包含大量辅助函数

**解决方案：** 将工具函数移到 `lib/utils/`

```typescript
// ❌ 不好：组件文件包含工具函数
export function VideoCard() {
  const formatDuration = (seconds: number) => {
    // ... 格式化逻辑
  };
  
  const formatDate = (date: Date) => {
    // ... 格式化逻辑
  };
  
  // ... 更多工具函数
  
  return <div>{/* JSX */}</div>;
}

// ✅ 好：提取到工具文件
import { formatDuration, formatDate } from '@/lib/utils/format-utils';

export function VideoCard() {
  return <div>{/* JSX */}</div>;
}

// lib/utils/format-utils.ts
export function formatDuration(seconds: number) { /* ... */ }
export function formatDate(date: Date) { /* ... */ }
```

##### D. 模块化

**问题：** 单个文件处理多个相关功能

**解决方案：** 按功能拆分文件并使用桶文件（barrel exports）

```typescript
// ❌ 不好：player-utils.ts 包含 200 行
export function parseHLS() { /* ... */ }
export function handlePlayback() { /* ... */ }
export function manageQuality() { /* ... */ }
// ... 更多函数

// ✅ 好：拆分为多个文件
// lib/utils/player/index.ts
export * from './hls-parser';
export * from './playback-manager';
export * from './quality-manager';

// lib/utils/player/hls-parser.ts
export function parseHLS() { /* ... */ }

// lib/utils/player/playback-manager.ts
export function handlePlayback() { /* ... */ }

// lib/utils/player/quality-manager.ts
export function manageQuality() { /* ... */ }
```

#### 2. TypeScript 规范

**类型安全**

```typescript
// ❌ 避免使用 any
function processData(data: any) {
  return data.value;
}

// ✅ 使用具体类型
interface VideoData {
  id: string;
  title: string;
  url: string;
}

function processData(data: VideoData) {
  return data.title;
}

// ✅ 或使用 unknown（需要类型检查）
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data');
}
```

**函数返回类型**

```typescript
// ❌ 缺少返回类型
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ 明确返回类型
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

**接口定义**

```typescript
// ✅ 使用 interface 定义对象类型
interface VideoCardProps {
  video: Video;
  onPlay: (id: string) => void;
  className?: string;
}

// ✅ 使用 type 定义联合类型
type ThemeMode = 'light' | 'dark' | 'system';
```

#### 3. React 组件规范

**函数组件**

```typescript
// ✅ 标准函数组件结构
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = 'primary', children, onClick }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

**组件文件组织**

```typescript
// 1. 导入
import React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. 类型定义
interface ComponentProps {
  // ...
}

// 3. 组件定义
export function Component({ prop1, prop2 }: ComponentProps) {
  // 4. Hooks
  const [state, setState] = useState();
  const router = useRouter();
  
  // 5. 事件处理函数
  const handleClick = () => {
    // ...
  };
  
  // 6. 渲染
  return (
    <div>{/* JSX */}</div>
  );
}
```

**单一职责原则**

```typescript
// ❌ 组件做太多事情
export function VideoSection() {
  // 获取数据
  // 处理搜索
  // 渲染列表
  // 处理分页
  // 处理过滤
}

// ✅ 拆分为专注的组件
export function VideoSection() {
  const videos = useVideos();
  return (
    <div>
      <SearchBar />
      <FilterPanel />
      <VideoList videos={videos} />
      <Pagination />
    </div>
  );
}
```

#### 4. 样式规范

**Tailwind CSS 优先**

```typescript
// ✅ 使用 Tailwind 类名
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl glass p-6 hover:shadow-lg transition-shadow">
      {children}
    </div>
  );
}
```

**遵循 Liquid Glass 设计系统**

```typescript
// ✅ 正确使用圆角
<div className="rounded-2xl">  {/* 容器：大圆角 */}
<div className="rounded-full">  {/* 小元素：完全圆形 */}

// ❌ 不要使用其他圆角值
<div className="rounded-lg">   {/* 错误！ */}
<div className="rounded-xl">   {/* 错误！ */}
```

**响应式设计**

```typescript
// ✅ 移动优先的响应式设计
<div className="
  flex flex-col           {/* 移动端：垂直布局 */}
  md:flex-row            {/* 平板及以上：水平布局 */}
  gap-4 md:gap-6         {/* 响应式间距 */}
">
```

#### 5. 命名规范

**文件命名**

- 组件文件：`PascalCase.tsx`（例如：`VideoCard.tsx`）
- Hook 文件：`camelCase.ts`（例如：`useVideoPlayer.ts`）
- 工具文件：`kebab-case.ts`（例如：`format-utils.ts`）
- 类型文件：`kebab-case.ts`（例如：`video-types.ts`）

**变量命名**

```typescript
// ✅ 清晰的命名
const videoList = [...];
const isLoading = false;
const handleSubmit = () => {};

// ❌ 模糊的命名
const data = [...];
const flag = false;
const fn = () => {};
```

**常量命名**

```typescript
// ✅ 全大写 + 下划线
const MAX_VIDEO_DURATION = 7200;
const API_BASE_URL = 'https://api.example.com';
```

#### 6. 导入顺序

```typescript
// 1. React 和 Next.js
import React from 'react';
import { useState } from 'react';
import Link from 'next/link';

// 2. 第三方库
import { create } from 'zustand';

// 3. 项目别名导入
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils/date-utils';

// 4. 相对路径导入
import { LocalComponent } from './LocalComponent';

// 5. 类型导入
import type { Video } from '@/lib/types/video';
```

## 🔄 Git 工作流程

### 分支策略

**主分支**

- `main`：稳定的生产分支，只接受 PR 合并

**功能分支命名**

遵循以下命名规范：

- `feat/功能名称`：新功能（例如：`feat/add-playlist`）
- `fix/问题描述`：错误修复（例如：`fix/search-crash`）
- `docs/文档修改`：文档更新（例如：`docs/update-readme`）
- `refactor/重构名称`：代码重构（例如：`refactor/player-controls`）
- `perf/优化内容`：性能优化（例如：`perf/image-loading`）
- `style/样式修改`：样式调整（例如：`style/button-spacing`）
- `test/测试内容`：测试相关（例如：`test/add-unit-tests`）
- `chore/其他修改`：构建或工具变动（例如：`chore/update-deps`）

### 开发流程

#### 1. 同步上游仓库

在开始新工作前，先同步最新的代码：

```bash
# 获取上游更新
git fetch upstream

# 切换到主分支
git checkout main

# 合并上游更新
git merge upstream/main

# 推送到你的 Fork
git push origin main
```

#### 2. 创建功能分支

```bash
# 从 main 创建新分支
git checkout -b feat/your-feature-name

# 确认当前分支
git branch
```

#### 3. 进行开发

在开发过程中：

- 频繁提交小的、原子性的改动
- 编写清晰的提交信息
- 定期运行 `npm run lint` 检查代码

#### 4. 提交前检查

**必须通过的检查：**

```bash
# 1. 代码规范检查
npm run lint

# 2. 文件长度检查
find . -type f -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*" -not -name "package-lock.json" -not -name "*.png" -not -name "*.md" | xargs wc -l | awk '$1 > 150 && $2 != "total" {print $2 " - " $1 "行"}'

# 3. 构建测试
npm run build
```

**如果任何检查失败，必须先修复！**

#### 5. 推送分支

```bash
# 推送到你的 Fork
git push origin feat/your-feature-name
```

## 📝 提交规范

### Conventional Commits

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型：**

- `feat`：新功能
- `fix`：错误修复
- `docs`：文档变更
- `style`：代码格式（不影响代码运行）
- `refactor`：重构
- `perf`：性能优化
- `test`：测试相关
- `chore`：构建过程或辅助工具的变动

**示例：**

```bash
# 简单提交
git commit -m "feat: 添加视频播放列表功能"

# 详细提交
git commit -m "feat(player): 添加倍速播放功能

- 支持 0.5x 到 2x 的播放速度
- 添加速度选择器 UI
- 保存用户的速度偏好

Closes #123"
```

**提交信息最佳实践：**

- ✅ 使用中文或英文（保持一致）
- ✅ 使用祈使句（"添加功能" 而不是 "添加了功能"）
- ✅ 第一行不超过 50 个字符
- ✅ 正文每行不超过 72 个字符
- ✅ 说明 "做了什么" 和 "为什么"，而不仅是 "怎么做"

## 🔍 Pull Request 指南

### 创建 PR

1. **推送分支到你的 Fork**

```bash
git push origin feat/your-feature-name
```

2. **在 GitHub 上创建 PR**

- 访问你的 Fork 页面
- 点击 "Compare & pull request"
- 选择目标分支：`KuekHaoYang/KVideo:main`

### PR 描述模板

```markdown
## 📝 变更说明

简要描述这个 PR 做了什么。

## 🎯 相关 Issue

Closes #123
Fixes #456

## 📸 截图（如果是 UI 变更）

[如果有 UI 变更，添加截图或 GIF]

## ✅ 检查清单

- [ ] 代码已通过 `npm run lint`
- [ ] 所有文件都在 150 行以内
- [ ] 构建成功（`npm run build`）
- [ ] 已在本地测试所有变更
- [ ] 遵循 Liquid Glass 设计系统
- [ ] 提交信息符合规范
- [ ] 已更新相关文档

## 🧪 测试步骤

1. 第一步
2. 第二步
3. 预期结果

## 📌 额外说明

[任何其他需要 reviewer 知道的信息]
```

### PR 审查流程

1. **自动检查**：GitHub Actions 会自动运行检查
2. **代码审查**：维护者会审查你的代码
3. **修改请求**：如果需要修改，会留下评论
4. **批准和合并**：审查通过后会被合并

### 回应审查意见

```bash
# 进行修改后
git add .
git commit -m "refactor: 根据审查意见调整代码"
git push origin feat/your-feature-name
```

PR 会自动更新。

## 🎨 设计系统规范

### Liquid Glass 原则

在编写 UI 代码时，必须遵循 Liquid Glass 设计系统：

#### 1. 圆角规范

> [!IMPORTANT]
> **只使用两种圆角：`rounded-2xl` 和 `rounded-full`**

```typescript
// ✅ 正确
<div className="rounded-2xl">  {/* 容器、卡片、按钮、输入框 */}
<div className="rounded-full"> {/* 头像、徽章、药丸形状 */}

// ❌ 错误
<div className="rounded-lg">
<div className="rounded-xl">
<div className="rounded-md">
```

#### 2. 玻璃效果

```typescript
// ✅ 使用 glass 类或 backdrop-filter
<div className="glass">
  {/* 内容 */}
</div>

// 或自定义玻璃效果
<div className="
  backdrop-blur-xl 
  backdrop-saturate-180 
  backdrop-brightness-110
  bg-white/10
  border border-white/20
">
```

#### 3. 动画过渡

```typescript
// ✅ 使用标准过渡曲线
<button className="
  transition-all 
  duration-300 
  ease-out
  hover:scale-105
">
```

#### 4. 颜色系统

```typescript
// ✅ 使用 CSS 变量
<div className="bg-glass text-glass-text border-glass-border">

// 或 Tailwind 的语义化颜色
<div className="bg-primary text-primary-foreground">
```

### 组件复用

优先复用 `components/ui/` 下的基础组件：

```typescript
// ✅ 好：复用基础组件
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export function Feature() {
  return (
    <Modal>
      <Button variant="primary">确定</Button>
    </Modal>
  );
}

// ❌ 不好：重新实现基础组件
export function Feature() {
  return (
    <div className="modal">
      <button className="btn">确定</button>
    </div>
  );
}
```

## 🧪 测试要求

### 手动测试

在提交 PR 前，请手动测试以下内容：

#### 功能测试

- [ ] 新功能按预期工作
- [ ] 没有破坏现有功能
- [ ] 边界情况处理正确

#### 浏览器测试

在以下浏览器中测试：

- [ ] Chrome/Edge（最新版）
- [ ] Firefox（最新版）
- [ ] Safari（最新版）

#### 响应式测试

在以下设备尺寸测试：

- [ ] 移动端（375px - 428px）
- [ ] 平板端（768px - 1024px）
- [ ] 桌面端（1280px+）

#### 无障碍测试

- [ ] 键盘导航正常工作
- [ ] 焦点状态清晰可见
- [ ] 屏幕阅读器友好

### 代码检查

```bash
# 运行 ESLint
npm run lint

# 检查文件长度
find . -type f -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*" -not -name "package-lock.json" -not -name "*.png" -not -name "*.md" | xargs wc -l | awk '$1 > 150 && $2 != "total" {print $2 " - " $1 "行"}'
```

## ❓ 常见问题

### Q1: 我应该从哪里开始？

**A:** 查看标记为 `good first issue` 的 Issues，这些通常比较简单，适合新手。

### Q2: 如何让文件保持在 150 行以内？

**A:** 参考 [文件长度限制](#1-文件长度限制-️) 部分的重构策略。关键是：
- 提取组件
- 提取 Hook
- 提取工具函数
- 模块化

注：系统文件（如 README.md、CONTRIBUTING.md 等文档）不受此限制。

### Q3: 我的 PR 多久会被审查？

**A:** 通常在 1-3 个工作日内。如果超过一周没有回应，可以在 PR 中添加评论提醒。

### Q4: 可以同时提交多个 PR 吗？

**A:** 可以，但建议每个 PR 专注于一个功能或修复。避免在一个 PR 中做太多不相关的改动。

### Q5: 如何解决合并冲突？

```bash
# 1. 同步上游
git fetch upstream
git checkout main
git merge upstream/main

# 2. 切换到功能分支并 rebase
git checkout feat/your-feature
git rebase main

# 3. 解决冲突后
git add .
git rebase --continue

# 4. 强制推送（因为 rebase 改变了历史）
git push origin feat/your-feature --force
```

### Q6: 我的提交信息写错了怎么办？

```bash
# 修改最后一次提交
git commit --amend -m "新的提交信息"

# 如果已经推送了
git push origin feat/your-feature --force
```

### Q7: 如何测试我的改动？

1. 启动开发服务器：`npm run dev`
2. 在浏览器中手动测试功能
3. 测试不同的设备尺寸
4. 运行 `npm run build` 确保生产构建成功

### Q8: Liquid Glass 设计系统在哪里定义？

在 `app/styles/glass.css` 文件中。所有组件都应该基于这个设计系统。

### Q9: 我需要更新文档吗？

如果你的 PR 包含以下内容，请更新相应文档：

- 新功能：更新 README.md
- API 变化：更新相关注释和文档
- 配置变化：更新配置说明

### Q10: 如何报告安全漏洞？

请查看 [SECURITY.md](SECURITY.md) 了解安全漏洞报告流程。不要在公开 Issue 中讨论安全问题。

## 📞 需要帮助？

如果你有任何问题：

1. **查看文档**：README.md 和本指南
2. **搜索 Issues**：可能已经有人问过相同的问题
3. **提出问题**：在 Discussions 或 Issues 中提问
4. **联系维护者**：[@KuekHaoYang](https://github.com/KuekHaoYang)

## 🎉 感谢你的贡献！

感谢你花时间阅读本指南，并为 KVideo 做出贡献。每一个贡献，无论大小，都让这个项目变得更好。

我们期待看到你的 Pull Request！

---

<div align="center">
  <strong>让我们一起打造更好的 KVideo！</strong>
</div>
