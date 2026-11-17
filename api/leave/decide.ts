/**
 * Vercel Serverless 版审批接口（线上部署用）
 *
 * POST /api/leave/decide  辅导员批准/驳回（写回存储，学生端可查）
 *
 * Serverless 内存存储的局限见 api/leave.ts 头部注释。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { decideRequest, pendingCount } from '../../server/store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const { id, decision, reason } = req.body || {};
  const updated = decideRequest(String(id), decision, reason ? String(reason) : undefined);
  if (!updated) {
    res.status(404).json({ error: '申请不存在或已处理' });
    return;
  }
  res.status(200).json({ ok: true, request: updated, pending: pendingCount() });
}
