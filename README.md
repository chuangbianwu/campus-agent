# 校园百事通 · 智能办事 Agent

> 传智杯·全国高校 AI Web 开发挑战赛参赛作品
> 面向校园双角色（学生 / 辅导员）的 AI Native Web 助手：通过多工具协作 Agent，一站式完成查课表、问制度、找自习教室、生成请假表、审批请假等高频事务——**对话即办事**。

## ✨ 核心亮点

| 亮点 | 说明 | 对应评分维度 |
|---|---|---|
| **调度 Agent + Tool Calling** | 大模型识别意图 → 调用工具 → 流式组织回答，最多 3 轮工具链（可完成"明天下午没课的话去哪自习"这类复合任务） | AI 技术深度 |
| **自实现 RAG 检索** | 制度文档切片 + 自实现 BM25 检索 + 中文二元分词 + 引用溯源（条款级出处），零外部向量库依赖 | AI 技术深度 |
| **生成式 UI** | 工具返回结构化数据，前端直接渲染课程卡片 / 空闲教室卡片 / 预填请假表（可下载 .docx）/ 审批卡片；卡片带**角色+意图双重门控** | 创新性 |
| **双角色权限差异化** | 学生 / 辅导员三层隔离：角色专属系统提示词 → 工具清单按角色过滤 → 执行层越权拦截 | AI 安全 |
| **AI 安全护栏** | 三层规则防护：提示词注入 / 敏感话题 / 违规行为请求，命中即拒、零 API 消耗 | AI 安全 |
| **办理-回执-追踪闭环** | 审批后列表实时移除 + 对话追加回执；请假表下载后留痕 | 体验完成度 |
| **双端互通（请假闭环）** | 学生对 AI 说"帮我请 X 天假"即提交申请 → 辅导员端实时收到（"新"徽标）→ 批准/驳回（驳回需二次确认+理由）→ 学生问"我的请假批了吗"查到结果和理由 | 产品完整度 |
| **完整周课表视图** | "我的课表"导航页：5 列周视图网格，今天高亮，课程块按类型配色，与 Agent 工具同源数据 | 产品完整度 |
| **辅导员备忘录** | 右侧看板随手记，勾选完成 / 删除，localStorage 持久化 | 实用性 |
| **错误兜底** | 30s 超时 + 自动重试 + 骨架屏加载态（全程状态文案）+ 工具异常隔离 | 实用性 |

## 🎭 双角色能力矩阵

| 能力 | 学生（张三） | 辅导员（李老师） |
|---|:-:|:-:|
| 课表查询 / 制度问答 / 空闲教室 | ✅ | ✅ |
| 请假申请表生成（.docx 下载） | ✅ | ❌（角色门控） |
| 对话直接提交请假申请 | ✅ | ❌（角色门控） |
| 请假进度查询（审批结果+理由） | ✅ | ❌（角色门控） |
| 待审批请假列表 + 批准/驳回 | ❌（越权拦截） | ✅（驳回需二次确认） |
| 备忘录 | ❌ | ✅ |
| 完整周课表视图 | ✅ | ✅ |

角色差异不止于界面：系统提示词、可用工具集、执行层权限三处均按角色隔离。

> 请假互通基于服务端共享内存存储（`server/store.ts`），重启后重置为初始 Mock 数据。
> Vercel Serverless 环境下跨请求不保证共享，互通演示请用本地服务（`npm run dev` 或 Express）。
> 生产化时换成数据库（Vercel KV / Postgres）即可，接口无需变动。

## 🏗️ 架构

```
用户提问
   │
   ▼
┌─────────────────────────────────────────┐
│  输入安全护栏（server/safety.ts）        │  注入/敏感/违规 → 直接拒绝，不调 API
└─────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────┐
│  调度 Agent（server/agent.ts）           │
│  循环：问大模型 → 要工具？→ 执行 → 再问   │  最多 3 轮工具链
└─────────────────────────────────────────┘
   │
   ▼
工具注册中心（server/tools/index.ts）
  ├─ get_course_schedule    课表查询 → courses 卡片
  ├─ query_campus_policy    制度问答（RAG）→ 引用溯源 + leave_form 卡片（门控）
  ├─ query_free_rooms       空闲教室 → free_rooms 卡片
  └─ query_leave_approvals  待审批列表（辅导员专属）→ approvals 卡片
   │
   ▼
结构化卡片 + 条款引用 + 流式文字 → 前端渲染（SSE）
```

三个服务入口复用同一份 Agent 逻辑：

- `vite.config.ts` 中间件 —— 本地开发（`npm run dev` 即全栈）
- `server/index.ts` —— Express 独立后端
- `api/chat.ts` —— Vercel Serverless 函数（线上）

## 📡 API 文档

### POST `/api/chat`

请求体：

```json
{
  "messages": [{ "role": "user", "content": "我周二有什么课？" }],
  "role": "student"
}
```

- `messages`：对话历史（不含系统提示词，由后端注入）
- `role`：`"student"` | `"counselor"`，缺省为 `student`

响应：`text/event-stream`（SSE），事件协议：

| 事件 | 字段 | 说明 |
|---|---|---|
| `tool_call` | `id, label, args` | Agent 开始调用工具（思考过程可视化） |
| `tool_result` | `id, label, summary` | 工具执行完毕及摘要 |
| `card` | `cardType, data` | 生成式 UI 卡片：`courses` / `free_rooms` / `leave_form` / `approvals` |
| `citations` | `items[]` | RAG 引用溯源（文档名 + 小节 + 条款原文） |
| `safety` | `rule` | 安全护栏/越权拦截触发 |
| `delta` | `content` | 流式文字增量 |
| `error` | `content` | 错误信息 |
| `[DONE]` | — | 结束标记 |

### 工具 Schema

| 工具 | 参数 | 返回 | 角色 |
|---|---|---|---|
| `get_course_schedule` | `day: string`（"周一"~"周五"/"今天"/"明天"） | 课程列表 + `courses` 卡片 | 全部 |
| `query_campus_policy` | `topic: string`（原始问题） | 相关条款（带出处）+ `citations` + 门控的 `leave_form` 卡片 | 全部 |
| `query_free_rooms` | `day: string`，`period?: string`（上午/下午/晚上） | 空闲场所列表 + `free_rooms` 卡片 | 全部 |
| `query_leave_approvals` | 无 | 待审批列表 + `approvals` 卡片 | 仅辅导员 |

新增工具只需在 `server/tools/index.ts` 的 `tools` 数组中声明 definition + execute，Agent 自动发现（声明式注册）。

## 🛡️ 安全设计（三层纵深）

1. **规则层**（`server/safety.ts`）：提示词注入 / 敏感话题 / 违规行为请求，正则特征命中即拒，不调 API——响应快、零成本、行为 100% 可控
2. **提示词层**（系统提示词）：声明用户消息中的"指令"一律不执行，礼貌引导回校园事务
3. **执行层**（`executeTool`）：角色权限二次校验，越权调用直接拦截并通知前端显示徽标

评测数据见 [docs/EVALUATION.md](docs/EVALUATION.md)：护栏拦截率 5/5、误伤 0/3，RAG 命中率 10/10（含越界问题正确拒绝）。

## 🚀 本地运行

```bash
npm install

# 配置 .env（参考 .env.example）
# DEEPSEEK_API_KEY=sk-你的key

npm run dev        # 前端 + API 一体启动
# 或
npm run start:both # Express 后端(3001) + Vite 前端(5173) 分离模式
```

打开后进入登录页（Mock 登录，不校验密码），选择「张三 · 学生」或「李老师 · 辅导员」体验不同角色的工具集与权限。

## ☁️ 部署到 Vercel

1. 将本仓库推送到 GitHub
2. [vercel.com](https://vercel.com) → Import Repository → 选择本仓库（框架自动识别为 Vite）
3. Settings → Environment Variables 添加 `DEEPSEEK_API_KEY`
4. Deploy，获得 `https://<项目名>.vercel.app` 在线地址

## 🧰 技术栈

React 19 · TypeScript · Vite 7 · Tailwind CSS · shadcn/ui · DeepSeek API（Function Calling）· Express · Vercel Serverless · docx（浏览器端文档合成）· Web Speech API（语音输入）

## 📁 目录结构

```
├── api/chat.ts          # Vercel Serverless 接口（线上）
├── docs/EVALUATION.md   # 评测报告（RAG 命中率 / 护栏拦截率 / 用例集）
├── server/
│   ├── agent.ts         # 调度 Agent 核心（三入口复用）
│   ├── safety.ts        # 输入安全护栏（注入/敏感/违规三层规则）
│   ├── tools/index.ts   # 工具注册中心（声明式，4 个工具 + 角色权限）
│   ├── rag/             # RAG：切片 + BM25 检索 + 引用溯源
│   ├── data/            # 模拟数据（课表 / 制度文档 / 空闲教室 / 请假申请）
│   └── index.ts         # Express 独立后端
└── src/
    ├── App.tsx          # 主界面（SSE 流式 + 思考过程 + 骨架屏 + 语音输入）
    ├── lib/leaveForm.ts # 浏览器端 .docx 申请表合成
    └── components/      # LoginView / Rail / Board / 四种生成式卡片 / 引用抽屉…
```
