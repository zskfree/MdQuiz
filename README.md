# MdQuiz

MdQuiz 是一个本地优先的 Markdown 题库练习应用，面向题库导入、顺序练题、快速练题、错题复习、模拟考试和结果回看等场景。

项目使用 React + TypeScript + Vite 构建，数据持久化到浏览器 IndexedDB，可离线使用。当前默认内置题库来源于 `source-materials/` 目录中的 Markdown 文件，构建时会自动扫描并生成默认题库。

## 当前版本能力

- 多题库管理
  - 默认题库：构建时自动扫描 `source-materials/*.md`
  - 导入题库：支持上传 `.md` 题库文件
  - 切换当前题库
  - 下载题库：导出为可再次导入的 Markdown 文件
  - 删除题库：支持删除导入题库，默认题库不可删除
- 练题模式
  - 顺序练题
  - 快速练题
  - 今日复习
  - 错题练习
  - 标记回看
- 学习数据管理
  - 题库之间的做题记录、复习记录、考试记录相互隔离
  - 支持清除当前题库做题记录
  - 支持整站备份导出 / 导入
- 模拟考试
  - 按题库发起考试
  - 支持交卷、成绩统计、结果回看
- 题库解析
  - 支持单题 Markdown 导入
  - 支持整份 Markdown 题库自动切题导入
  - 自动解析题干、选项、答案、解析
  - 自动推断单选 / 多选 / 判断题
  - 自动生成题库诊断信息
- 部署与预览
  - 支持 GitHub Pages 自动部署
  - `npm run preview` 已支持本地正确预览生产构建产物

## 技术栈

- React 18
- TypeScript
- Vite 5
- React Router 6
- Zustand
- IndexedDB
- react-markdown
- remark-gfm
- remark-math
- rehype-katex

## 项目结构

```text
MdQuiz/
  src/
    app/                    # 应用入口与路由
    components/             # 通用组件与布局
    core/
      import-export/        # 题库/备份导入导出
      memory/               # 复习调度与记忆记录
      parser/               # Markdown 解析
      storage/              # IndexedDB 仓储与迁移
    pages/                  # 看板、题库、练习、考试、诊断、设置页面
    stores/                 # Zustand 状态管理
  source-materials/         # 默认题库 Markdown 源文件
  public/builtin-library/   # 构建生成的默认题库静态数据
  scripts/
    build-library.mjs       # 扫描 source-materials 并生成默认题库
    build-site.mjs          # GitHub Pages 生产构建
    build-preview.mjs       # 本地 preview 构建
  .github/workflows/
    deploy.yml              # GitHub Pages 自动部署工作流
```

## 环境要求

- Node.js 20+
- npm 9+

CI 当前使用 Node 22。

## 本地开发

安装依赖：

```bash
npm ci
```

启动开发环境：

```bash
npm run dev
```

说明：

- `npm run dev` 会先执行 `npm run build:library`
- 开发环境读取的是最新生成的默认题库数据

## Google 登录与云同步

当前版本已接入 Firebase，实现了：

- Google 登录
- 手动上传同步（本地 -> 云端）
- 手动下载恢复（云端 -> 本地，合并恢复）
- 自动同步开关（前台在线时定时同步）

当前实现不会在源码里内置 Firebase 项目配置，统一从 `VITE_FIREBASE_*` 环境变量读取。

可复制 `.env.example` 到 `.env.local` 并填写：

```bash
cp .env.example .env.local
```

如需切换到自己的 Firebase 项目，可在 `.env.local` 覆盖：

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### GitHub Actions Variables 注入（推荐）

公开仓库建议通过 GitHub Actions Variables 注入构建变量，而不是写死在代码中。

在仓库 Settings -> Secrets and variables -> Actions -> Variables 新建以下键：

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

工作流 [deploy.yml](.github/workflows/deploy.yml) 已读取这些变量并注入构建环境。

安全说明：

- `VITE_*` 变量会在前端打包后出现在浏览器端，不属于后端机密。
- 真正的安全边界依赖 Firebase Firestore/Storage 规则（必须按用户 UID 做读写隔离）。

### Firebase 控制台配置步骤

1. 创建 Firebase 项目
2. 在 Authentication 中启用 Google 登录
3. 创建 Firestore Database
4. 创建 Storage Bucket
5. 在 Project settings -> Web App 中获取配置

### Firestore 规则示例

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/sync/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Storage 规则示例

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 使用入口

在设置页可完成：

- Google 登录/退出
- 上传到云端
- 从云端恢复
- 开启/关闭自动同步

## 构建与预览

生产构建：

```bash
npm run build
```

本地预览生产构建：

```bash
npm run preview
```

说明：

- `npm run build` 用于 GitHub Pages 部署产物，构建时会使用仓库对应的生产 `base`
- `npm run preview` 会先重新生成一份本地预览专用 `dist`，强制使用 `/` 作为 `base`
- 如果你刚执行过 `npm run preview`，准备发布前请重新执行一次 `npm run build`

运行测试：

```bash
npm run test
```

## 默认题库构建规则

默认题库不再手工维护单独的 JSON 清单，而是由 `source-materials/` 自动生成。

规则如下：

1. `source-materials/` 下每个 `.md` 文件视为一个默认题库
2. 题库名称默认取 Markdown 文件名（不带扩展名）
3. 构建时扫描所有 `.md` 文件，生成：
   - `public/builtin-library/libraries.json`
   - `public/builtin-library/questions.json`
   - `public/builtin-library/diagnostics.json`
4. 应用启动后会把这些默认题库加载到本地存储

当前默认题库文件：

- [中级电力交易员笔试题库.md](D:/projects/MdQuiz/source-materials/中级电力交易员笔试题库.md)

如果你要新增默认题库，只需要把新的 `.md` 文件放进 `source-materials/`，然后执行：

```bash
npm run build
```

## 题库 Markdown 格式

项目支持两类 Markdown 题库输入。

### 1. 整份题库文件

推荐使用这种格式，一份文件内包含多道题：

```md
# 中级电力交易员笔试题库

## 1、电力市场中长期交易的主要作用是什么？

以下说法正确的是：

- A. 仅用于实时平衡
- B. 有助于稳定市场预期
- C. 只适用于现货市场
- D. 与合同管理无关
- 答案：B
- 解析：中长期交易有助于稳定供需双方预期。

## 2、电力用户侧响应属于以下哪类机制？

- A. 需求响应
- B. 输电检修
- C. 电源扩建
- D. 财务结算
- 答案：A
```

### 2. 单题 Markdown 文件

也支持单题文件，可带 frontmatter：

```md
---
id: trader-2025-10-001
title: 示例题目
type: single
answer: A
explanation: 这里是解析
---

# 示例题目

以下哪项描述正确？

A. 选项一
B. 选项二
C. 选项三
D. 选项四
```

### 支持的答案形式

- 单选：`A`
- 多选：`AC`、`A,C`
- 判断：`true`、`false`、`正确`、`错误`、`对`、`错`、`是`、`否`

### 导出格式

题库页面的“下载题库”会导出为 Markdown 文件，格式与上传导入兼容，可直接再次上传。

## 题库页面功能

题库页面当前支持：

- 导入 `.md` 题库文件
- 查看所有题库及来源类型
- 切换当前题库
- 下载题库为 Markdown 文件
- 删除导入题库
- 查看当前题库诊断信息

约束：

- 默认题库 `sourceType = builtin` 不允许删除
- 导入题库 `sourceType = imported` 可以删除
- 删除题库时会同时删除：
  - 题库元数据
  - 题目数据
  - 诊断信息
  - 做题记录
  - 会话记录
  - 考试结果

## 做题记录与数据隔离

不同题库的学习数据已按题库隔离保存，包括：

- 记忆记录
- 错题与复习数据
- 当前练题 / 考试会话
- 考试结果

设置页面支持“清除当前题库做题记录”，该操作不会删除题库本身，只会清空当前题库对应的学习数据。

## 页面说明

- 看板：学习概览与快捷入口
- 题库：题库导入、切换、下载、删除、诊断查看
- 练习：顺序练题、快速练题、错题练习、今日复习
- 考试：创建考试、交卷、结果查看
- 设置：整站备份导入导出、清除当前题库做题记录

## GitHub Pages 部署

仓库已配置自动部署工作流：[deploy.yml](D:/projects/MdQuiz/.github/workflows/deploy.yml)

触发方式：

- push 到 `main`
- 手动触发 `workflow_dispatch`

工作流会自动执行：

1. `npm ci`
2. `npm run build`
3. 复制 `dist/index.html` 到 `dist/404.html`
4. 上传 Pages 构建产物并部署

### 生产 base 规则

`vite.config.ts` 的生产 `base` 按下面优先级解析：

1. `VITE_BASE_PATH`
2. `GITHUB_REPOSITORY` 推导出的仓库名
3. 当前工作目录名
4. 如果仓库名以 `.github.io` 结尾，则使用 `/`

这套规则用于兼容 GitHub Pages 的子路径部署。

## 常见问题

### 1. `npm run dev` 正常，但 `npm run preview` 白屏

当前版本已经修复该问题。

原因是：

- 生产构建使用 GitHub Pages 的子路径 `base`
- 本地 `preview` 需要使用根路径 `/`

现在 `npm run preview` 会先生成本地预览专用构建，再启动 `vite preview`。

### 2. GitHub Pages 部署后白屏或资源 404

优先检查：

- Pages 是否配置为 GitHub Actions 部署
- Actions 工作流是否成功执行
- 线上 `index.html` 是否引用了正确的 `assets/*.js` 和 `assets/*.css`
- 仓库访问路径和 `base` 是否一致

### 3. 默认题库没有更新

优先检查：

- 是否把新的 `.md` 文件放进了 `source-materials/`
- 是否重新执行了 `npm run build`
- 是否把新的 `dist/`、`builtin-library/`、`assets/` 等构建产物一起提交

## 开发建议

- 新增默认题库时，优先使用“整份题库 Markdown”格式
- 提交前至少执行一次：

```bash
npm run build
```

- 如果改动了题库解析或导出逻辑，再执行：

```bash
npm run test
```
