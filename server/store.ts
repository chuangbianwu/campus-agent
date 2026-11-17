/**
 * 共享数据存储（内存版）
 *
 * 为什么需要它？
 * 之前待审批请假是静态 JSON，前端批准/驳回只是本地状态，刷新就没了，
 * 学生提交请假更是无处可写——学生端和教师端是"两个世界"。
 * 这个模块是两端互通的地基：
 *   学生提交请假 → 写入这里 → 辅导员查询时从这里读 → 审批结果写回 → 学生再查得到
 *
 * 注意：内存存储在服务重启后重置为初始 Mock 数据（演示场景可接受）。
 * Vercel Serverless 环境下每次请求可能是不同实例，不保证共享——
 * 所以"提交-审批"互通的演示请在本地跑（npm run dev / Express 均可）。
 * 生产环境的正确做法是换成数据库（如 Vercel KV / Postgres），接口不用变。
 */

import leaveRequestsJson from './data/leave_requests.json';
import coursesDataJson from './data/courses.json';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface StoredLeaveRequest {
  id: string;
  student: string;
  className: string;
  type: string;
  days: number;
  range: string;
  reason: string;
  submitted: string;
  status: LeaveStatus;
  /** 审批理由（驳回时填写），学生端可查到 */
  decisionReason?: string;
  decidedAt?: string;
  /** 本次运行中新提交的（教师端列表打"新"徽标） */
  isNew?: boolean;
}

const student = (coursesDataJson as { student: string }).student;

/** 内存中的请假申请列表（启动时用静态 Mock 初始化） */
const requests: StoredLeaveRequest[] = (
  leaveRequestsJson as { requests: Array<Omit<StoredLeaveRequest, 'status'>> }
).requests.map((r) => ({ ...r, status: 'pending' as LeaveStatus }));

/** 新申请单号序号（避免与初始数据撞号） */
let seq = 100;

function now(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 辅导员的待审批列表（新提交的排最前） */
export function listPendingRequests(): StoredLeaveRequest[] {
  return requests
    .filter((r) => r.status === 'pending')
    .sort((a, b) => Number(b.isNew ?? false) - Number(a.isNew ?? false));
}

/** 学生查自己的申请（含审批结果和驳回理由） */
export function listRequestsByStudent(name: string = student): StoredLeaveRequest[] {
  return requests.filter((r) => r.student === name);
}

/** 学生提交请假申请，返回新申请单 */
export function submitLeaveRequest(input: {
  type: string;
  days: number;
  range: string;
  reason: string;
}): StoredLeaveRequest {
  const d = new Date();
  const id = `LQ${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${seq++}`;
  const req: StoredLeaveRequest = {
    id,
    student,
    className: '软件 2401',
    type: input.type,
    days: input.days,
    range: input.range,
    reason: input.reason,
    submitted: now(),
    status: 'pending',
    isNew: true,
  };
  requests.unshift(req);
  console.log(`[请假互通] 新申请提交：${req.student} ${req.type} ${req.days} 天（${req.id}）`);
  return req;
}

/** 辅导员审批：写入结果，学生端可查 */
export function decideRequest(
  id: string,
  decision: 'approved' | 'rejected',
  reason?: string
): StoredLeaveRequest | null {
  const req = requests.find((r) => r.id === id);
  if (!req || req.status !== 'pending') return null;
  req.status = decision;
  req.decisionReason = reason;
  req.decidedAt = now();
  req.isNew = false;
  console.log(`[请假互通] ${req.student} 的申请已${decision === 'approved' ? '批准' : '驳回'}${reason ? `（理由：${reason}）` : ''}`);
  return req;
}

/** 待审批数量（看板徽标用） */
export function pendingCount(): number {
  return requests.filter((r) => r.status === 'pending').length;
}
