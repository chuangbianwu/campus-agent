/**
 * Vercel Serverless 版请假接口（线上部署用）
 *
 * GET  /api/leave  待审批数量
 * POST /api/leave  学生提交请假申请
 *
 * 注意：Serverless 内存存储不保证跨请求共享（每次请求可能是不同实例），
 * 线上环境此接口退化为"本次实例内有效"。两端互通的完整演示请用本地服务。
 * 生产做法：把 server/store.ts 换成 Vercel KV / Postgres，接口保持不变。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { submitLeaveRequest, pendingCount } from '../server/store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    res.status(200).json({ pending: pendingCount() });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const { type, days, range, reason } = req.body || {};
  if (!type || !days || !range || !reason) {
    res.status(400).json({ error: '缺少必填字段：type/days/range/reason' });
    return;
  }
  const created = submitLeaveRequest({
    type: String(type), days: Number(days), range: String(range), reason: String(reason),
  });
  res.status(200).json({ ok: true, request: created });
}
