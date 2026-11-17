import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'
import dotenv from 'dotenv'
import { runAgentChat } from './server/agent'
import { submitLeaveRequest, decideRequest, pendingCount } from './server/store'

/** 手动读取请求体（vite 中间件没有 Express 的 json 解析） */
function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
  });
}

// 加载 .env（DeepSeek API Key 只待在服务器侧，前端永远看不到）
dotenv.config()

/**
 * campus-api 插件：把 AI 聊天接口直接挂进 Vite 开发服务器
 *
 * 为什么这样做？
 * 之前前端跑在 7100、后端 Express 跑在 3001，两个进程：
 * 后端一旦没启动，前端就报 "Failed to fetch"。
 * 现在接口挂在 Vite 里，前端请求 /api/chat 就是请求自己，
 * 打开预览 = 前后端同时就绪，还顺便解决了跨域问题。
 *
 * 注意：这只是开发环境的便利方案。将来部署上线时，
 * 会用 server/index.ts（Express）提供同样的接口，业务逻辑完全复用。
 */
function campusApi(): Plugin {
  return {
    name: 'campus-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', (req, res) => {
        // 只接受 POST
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        // 手动读取请求体（这里没有 Express 的 json 中间件）
        readBody(req).then(async (body) => {
          const apiKey = process.env.DEEPSEEK_API_KEY;
          if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'DeepSeek API Key 未配置，请在 .env 文件中设置' }));
            return;
          }

          // SSE 响应头
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          try {
            const { messages, role } = JSON.parse(body || '{}');
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
      });

      /**
       * 请假互通接口（学生提交 → 辅导员审批 → 学生查结果，共享内存存储）
       *   POST /api/leave        学生提交请假申请
       *   POST /api/leave/decide 辅导员批准/驳回（持久化，学生端可查）
       *   GET  /api/leave        待审批数量（教师端看板徽标）
       */
      server.middlewares.use('/api/leave/decide', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
        readBody(req).then((body) => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { id, decision, reason } = JSON.parse(body || '{}');
            const updated = decideRequest(String(id), decision, reason ? String(reason) : undefined);
            if (!updated) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: '申请不存在或已处理' }));
              return;
            }
            res.end(JSON.stringify({ ok: true, request: updated, pending: pendingCount() }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: '请求格式错误' }));
          }
        });
      });

      server.middlewares.use('/api/leave', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'GET') {
          res.end(JSON.stringify({ pending: pendingCount() }));
          return;
        }
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
        readBody(req).then((body) => {
          try {
            const { type, days, range, reason } = JSON.parse(body || '{}');
            if (!type || !days || !range || !reason) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: '缺少必填字段：type/days/range/reason' }));
              return;
            }
            const created = submitLeaveRequest({ type: String(type), days: Number(days), range: String(range), reason: String(reason) });
            res.end(JSON.stringify({ ok: true, request: created }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: '请求格式错误' }));
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react(), campusApi()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
