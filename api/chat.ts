/**
 * Vercel Serverless 版本的聊天接口（线上部署用）
 *
 * 本地开发时接口由 vite.config.ts 的中间件提供；
 * 部署到 Vercel 后，前端请求的 /api/chat 由这个函数处理。
 * 业务逻辑同样复用 server/agent.ts —— 三个入口（Vite/Express/Vercel），一份逻辑。
 *
 * Vercel 约定：api/ 目录下的文件自动成为 /api/<文件名> 接口，
 * 前端同源访问，天然没有跨域问题。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runAgentChat } from '../server/agent';

// Node.js 运行时（支持 SSE 流式输出），最长执行 60 秒（Hobby 套餐上限）
export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Vercel 环境变量在部署后台配置（Settings → Environment Variables）
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '服务器未配置 DEEPSEEK_API_KEY' });
    return;
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: '请求格式错误：messages 必须是数组' });
    return;
  }

  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    await runAgentChat(messages, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }, apiKey);
  } catch (error) {
    console.error('API 调用失败:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      content: `服务出错：${error instanceof Error ? error.message : '未知错误'}`,
    })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
}
