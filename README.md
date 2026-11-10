# 校园百事通 · 智能办事 Agent

> 传智杯·全国高校 AI Web 开发挑战赛参赛作品
> 面向大学生的 AI Native Web 助手：通过多工具协作 Agent，一站式完成课表查询、校园制度咨询等高频事务。

## ✨ 核心亮点

| 亮点 | 说明 | 对应评分维度 |
|---|---|---|
| **调度 Agent + Tool Calling** | 大模型识别意图 → 调用工具 → 流式组织回答，最多 3 轮工具链 | AI 技术深度 |
| **RAG 检索增强** | 制度文档切片 + 自实现 BM25 检索引擎 + 引用溯源（条款级出处） | AI 技术深度 |
| **生成式 UI** | 工具返回结构化数据，前端直接渲染课程卡片，数据零出错 | 创新性 |
| **思考过程可视化** | 工具调用卡片实时展示 Agent 决策过程 | 用户体验 |
| **AI 安全护栏** | 双层防护：规则层拦截注入攻击/敏感话题 + 提示词层加固 | AI 安全 |
| **错误兜底** | 30s 超时 + 自动重试 + 友好降级，工具异常隔离 | 实用性 |

## 🏗️ 架构

```
用户提问
   │
   ▼
┌─────────────────────────────────────────┐
│  输入安全护栏（server/safety.ts）        │  注入攻击/敏感话题 → 直接拒绝，不调 API
└─────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────┐
│  调度 Agent（server/agent.ts）           │
│  循环：问大模型 → 要工具？→ 执行 → 再问   │
└─────────────────────────────────────────┘
   │                    │
   ▼                    ▼
课表查询工具        制度问答工具（RAG）
courses.json       切片 → BM25 → 带出处条款
   │                    │
   └────────┬───────────┘
            ▼
   结构化卡片 + 流式文字 → 前端渲染
```

三个服务入口复用同一份 Agent 逻辑：

- `vite.config.ts` 中间件 —— 本地开发（`npm run dev` 即全栈）
- `server/index.ts` —— Express 独立后端
- `api/chat.ts` —— Vercel Serverless 函数（线上）

## 🚀 本地运行

```bash
npm install

# 配置 .env（参考 .env.example）
# DEEPSEEK_API_KEY=sk-你的key

npm run dev        # 前端 + API 一体启动
# 或
npm run start:both # Express 后端(3001) + Vite 前端(5173) 分离模式
```

## ☁️ 部署到 Vercel

1. 将本仓库推送到 GitHub
2. [vercel.com](https://vercel.com) → Import Repository → 选择本仓库（框架自动识别为 Vite）
3. Settings → Environment Variables 添加 `DEEPSEEK_API_KEY`
4. Deploy，获得 `https://<项目名>.vercel.app` 在线地址

## 🧰 技术栈

React 19 · TypeScript · Vite 7 · Tailwind CSS · shadcn/ui · DeepSeek API（Function Calling）· Express · Vercel Serverless

## 📁 目录结构

```
├── api/chat.ts          # Vercel Serverless 接口（线上）
├── server/
│   ├── agent.ts         # 调度 Agent 核心（三入口复用）
│   ├── safety.ts        # 输入安全护栏
│   ├── tools/           # 工具注册中心（课表 / 制度问答）
│   ├── rag/             # RAG：切片 + BM25 检索 + 引用溯源
│   ├── data/            # 模拟数据（课表 / 制度文档）
│   └── index.ts         # Express 独立后端
└── src/
    ├── App.tsx          # 聊天主界面（SSE 流式 + 工具可视化）
    └── components/CourseCard.tsx  # 生成式 UI 课程卡片
```
