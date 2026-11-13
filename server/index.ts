/**
 * 后端 API 服务器（Express 版，用于独立运行 / 将来部署上线）
 *
 * 本地开发时其实用不到它 —— vite.config.ts 里的中间件已经提供同样的接口。
 * 保留它的意义：部署到云服务器 / Vercel 时，前端是静态文件，
 * 需要一个独立的后端进程，就是这个文件。
 *
 * 核心业务逻辑都在 ./agent.ts 里，这里只做"HTTP 壳"：
 * 收请求 → 调 Agent → 把 Agent 事件写成 SSE 推给前端
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { join } from 'path';
import { runAgentChat } from './agent';

// 加载 .env 文件（从项目根目录读取）
dotenv.config({ path: join(process.cwd(), '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// CORS：允许前端访问（开发时前端在 http://localhost:5173）
app.use(cors());
// 解析 JSON 请求体
app.use(express.json());

/**
 * POST /api/chat
 * SSE 事件格式（与前端 src/App.tsx 约定）：
 *   data: {"type":"tool_call",   "id":"...", "label":"课表查询", "args":{...}}
 *   data: {"type":"tool_result", "id":"...", "summary":"查询了周二的课表：共3门课"}
 *   data: {"type":"delta",       "content":"你周二有..."}
 *   data: [DONE]
 */
app.post('/api/chat', async (req, res) => {
  const { messages, role } = req.body;

  // 检查 API Key 是否配置
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
    res.status(500).json({ error: 'DeepSeek API Key 未配置，请在 .env 文件中设置 DEEPSEEK_API_KEY' });
    return;
  }

  // 设置 SSE 响应头（Server-Sent Events）
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    await runAgentChat(messages, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }, apiKey, role === 'counselor' ? 'counselor' : 'student');
  } catch (error) {
    console.error('API 调用失败:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      content: `服务出错：${error instanceof Error ? error.message : '未知错误'}`,
    })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

// 健康检查接口
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`后端服务器运行在 http://localhost:${PORT}`);
  console.log('API 端点:');
  console.log(`  POST http://localhost:${PORT}/api/chat  - 聊天接口（含 Tool Calling）`);
  console.log(`  GET  http://localhost:${PORT}/api/health - 健康检查`);
});
