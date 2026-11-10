# 校园智能办事助手 - AI Agent

参加"全国高校AI Web开发挑战赛"的作品。

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS
- **后端**：Express + TypeScript（保护 API Key，转发流式响应）
- **AI**：DeepSeek API（流式输出）

## 项目结构

```
.
├── .env                  # 环境变量（API Key，不提交到 Git）
├── .env.example          # 环境变量模板
├── server/
│   └── index.ts          # Express 后端 API
├── src/
│   ├── App.tsx           # 前端聊天界面主组件
│   ├── App.css           # 聊天界面样式
│   └── ...               # 其他组件
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env，填入你的 DeepSeek API Key
# 从 https://platform.deepseek.com/api_keys 获取
```

### 3. 启动项目

需要同时启动后端和前端：

```bash
# 方式一：同时启动（推荐）
npm run start:both

# 方式二：分开启动（两个终端）
# 终端 1：启动后端
npm run server

# 终端 2：启动前端
npm run dev
```

### 4. 访问应用

- 前端：http://localhost:5173
- 后端 API：http://localhost:3001

## 核心功能

- 流式对话：输入问题，AI 逐字回复
- 消息历史：保留上下文，支持多轮对话
- 错误兜底：API 错误时友好提示

## 开发计划

| 日期 | 任务 |
|------|------|
| Day 1 (11.10) | 项目搭建 + 基础流式对话 ✅ |
| Day 2 (11.11) | Tool Calling 框架 + 调度 Agent |
| Day 3 (11.12) | 课表查询 + 制度问答工具 Agent |
| Day 4 (11.13) | RAG 接入（校园文档检索） |
| Day 5 (11.14) | UI 打磨 + 思考过程可视化 |
| Day 6 (11.15) | 错误兜底 + 安全过滤 + 联调 |
| Day 7 (11.16) | 部署 + 演示视频 |
| Day 8 (11.17) | 技术文档 + 提交 |
