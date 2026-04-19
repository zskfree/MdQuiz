# MdQuiz

MdQuiz 是一个本地优先（Local-first）的 Markdown 题库刷题应用，支持题库导入、顺序练习、快速刷题、错题/到期复习、模拟考试和结果回顾。

项目使用 React + TypeScript + Vite，数据持久化到浏览器 IndexedDB，可离线使用。

## 目录

- [项目特性](#项目特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [题库来源与构建流程](#题库来源与构建流程)
- [Markdown 题目格式规范](#markdown-题目格式规范)
- [应用模块说明](#应用模块说明)
- [部署到 GitHub Pages](#部署到-github-pages)
- [常见问题排查](#常见问题排查)
- [开发建议](#开发建议)

## 项目特性

- 本地优先：题库、会话、记忆记录、考试结果都存储在 IndexedDB。
- 多模式练习：
  - 顺序刷题
  - 快速刷题
  - 今日复习（到期题）
  - 错题练习
- 模拟考试：可配置题量与时长，支持交卷与结果统计。
- Markdown 题库：支持 frontmatter 元信息和选项自动提取。
- 诊断能力：自动检测缺失答案、选项不匹配等问题。
- GitHub Pages 部署：内置 CI 工作流，支持 SPA 回退。

## 技术栈

- React 18
- TypeScript
- Vite 5
- React Router 6
- Zustand
- IndexedDB（自定义存储层）
- react-markdown + remark/rehype（含 KaTeX）

## 项目结构

```text
MdQuiz/
  src/
    app/                 # 应用入口与路由
    components/          # 通用布局组件
    pages/               # 页面：home/library/practice/exam/diagnostics/settings
    stores/              # Zustand 状态管理
    core/
      parser/            # Markdown/frontmatter/选项解析
      import-export/     # 导入导出逻辑
      storage/           # IndexedDB 访问与仓储
      grading/           # 判分逻辑
      memory/            # 记忆复习算法
      renderer/          # Markdown 渲染
  libraries/builtin/questions/
                         # 内置 Markdown 题库源文件
  public/builtin-library/
                         # 构建出的内置题库 JSON（manifest/questions/diagnostics）
  scripts/
    build-library.mjs    # 将内置 Markdown 题库编译为 JSON
    import-default-library.mjs
                         # 批量导入脚本（一次性工具）
  .github/workflows/deploy.yml
                         # GitHub Pages 自动部署
```

## 快速开始

### 1) 环境要求

- Node.js 20+（CI 使用 Node 22）
- npm 9+

### 2) 安装依赖

```bash
npm ci
```

### 3) 本地开发

```bash
npm run dev
```

说明：`dev` 会先执行 `build:library`，确保内置题库 JSON 是最新的。

### 4) 生产构建

```bash
npm run build
```

### 5) 本地预览构建结果

```bash
npm run preview
```

### 6) 运行测试

```bash
npm run test
```

## 题库来源与构建流程

内置题库采用“两段式”流程：

1. 编辑 `libraries/builtin/questions/` 下的 Markdown 文件。
2. 运行 `npm run build:library`。
3. 生成以下文件：
   - `public/builtin-library/manifest.json`
   - `public/builtin-library/questions.json`
   - `public/builtin-library/diagnostics.json`

应用启动后会加载上述 JSON，并写入本地存储。

## Markdown 题目格式规范

支持 frontmatter，推荐格式如下：

```md
---
id: trader-2025-10-001
title: "示例题目"
type: single
tags: [Electricity Trader, Mid-Level]
difficulty: 3
answer: A
explanation: "这里是解析"
---

# 示例题目

以下哪项描述正确？

A. 选项一
B. 选项二
C. 选项三
D. 选项四
```

### frontmatter 字段说明

- `id`: 题目唯一 ID（缺失时系统会生成回退 ID，并给出诊断）
- `title`: 标题（缺失时用正文首行推断）
- `type`: `single | multiple | boolean`
- `tags`: 标签数组或逗号分隔字符串
- `difficulty`: 难度（数字）
- `answer`: 答案
- `explanation`: 解析

### answer 支持形式

- 单选：`A`
- 多选：`[A, C]` 或 `AC` 或 `A,C`
- 判断：`true/false`、`对/错`、`是/否`、`√/×`

### 诊断示例

系统会自动生成以下问题类型的诊断信息：

- `missing-id`
- `missing-answer`
- `duplicate-id`
- `invalid-type`
- `option-answer-mismatch`
- `markdown-error`
- `asset-missing`

## 应用模块说明

- 首页（复习看板）：总览学习状态。
- 题库页：管理已加载题库、导入题库。
- 练习页：顺序刷题、快速刷题、到期复习、错题练习。
- 考试页：开始模拟考试、查看成绩单。
- 诊断页：查看题库解析与结构问题。
- 设置页：导入导出备份、基础设置。

## 部署到 GitHub Pages

### 自动部署（推荐）

仓库已包含工作流：`.github/workflows/deploy.yml`

触发方式：

- push 到 `main`
- 手动 `workflow_dispatch`

工作流会自动：

1. 安装依赖
2. 执行 `npm run build`
3. 复制 `dist/index.html` 到 `dist/404.html`（SPA 路由回退）
4. 发布到 GitHub Pages

### base 路径策略

`vite.config.ts` 已支持自动推导生产 `base`：

优先级如下：

1. `VITE_BASE_PATH`（手动指定）
2. `GITHUB_REPOSITORY` 推导仓库名作为子路径
3. 若仓库名以 `.github.io` 结尾，使用根路径 `/`

这可以避免项目页路径变化导致的静态资源 404 与白屏。

## 常见问题排查

### 1) 本地正常，GitHub Pages 白屏

优先检查：

- Actions 是否成功执行。
- Pages 配置是否指向 GitHub Actions。
- 线上 `index.html` 中 `assets/*.js` / `assets/*.css` 请求是否 200。
- `base` 路径是否与仓库访问路径一致。

### 2) 默认题库未显示

检查：

- `public/builtin-library/*.json` 是否存在。
- 是否执行过 `npm run build`（会先执行 `build:library`）。
- 请求路径是否走 `import.meta.env.BASE_URL` 前缀（避免根路径 404）。

### 3) 切题后页面滚动行为异常

项目已对移动端快速模式做了滚动容器优化（整页锁定、内容区滚动）。
若仍异常，优先检查最近样式修改是否影响 `app-main`、`quick-mode` 容器高度链路。

### 4) TypeScript 提示 moduleResolution 弃用

这是 TS 版本升级后的提示，不影响当前运行。可按 TypeScript 官方迁移建议后续统一升级配置。

## 开发建议

- 新增题库时优先保持 frontmatter 结构完整（尤其 `id`、`answer`）。
- 提交前至少执行一次：

```bash
npm run build
```

- 修改部署相关配置后，务必在 PR 中附带：
  - GitHub Pages 访问 URL
  - 浏览器控制台是否有报错
  - 关键静态资源请求状态码截图

---

如果你准备继续迭代，我建议下一步补充：

- 题库格式校验 CLI（提交前自动检查）
- 端到端测试（练习流、考试流、导入导出）
- 版本化 CHANGELOG
