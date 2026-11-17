/**
 * 待审批请假卡片（辅导员专属 · 生成式 UI）
 *
 * 辅导员问"有哪些请假待审批"→ Agent 调 query_leave_approvals → 渲染这张卡。
 * 批准/驳回是本地状态操作（Mock），但演示效果完整：
 * 点完后该行立即从列表移除，并在对话流追加回执。
 *
 * 防误触设计（评审 P0）：批准保持一键完成；驳回必须先确认——
 * 点击"驳回"展开确认区，可填写驳回理由，二次确认后才生效。
 */

import { useState } from 'react';

export interface LeaveRequestItem {
  id: string;
  student: string;
  className: string;
  type: string;
  days: number;
  range: string;
  reason: string;
  submitted: string;
  /** 本次运行中学生端新提交的，打"新"徽标（两端互通可视化） */
  isNew?: boolean;
}

export interface ApprovalsData {
  requests: LeaveRequestItem[];
}

function ApprovalsCard({
  data,
  onDecide,
}: {
  data: ApprovalsData;
  onDecide?: (r: LeaveRequestItem, d: 'approved' | 'rejected', reason?: string) => void;
}) {
  // 本地审批状态：id → 'approved' | 'rejected'
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});
  // 驳回二次确认：待确认的条目 + 理由输入
  const [confirming, setConfirming] = useState<LeaveRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  // 已处理的直接从列表移除（评审 P1：状态回写要可见），只留待处理
  const pending = data.requests.filter((r) => !decisions[r.id]);

  /**
   * 审批结果通过 API 写回服务端共享存储——
   * 学生端随后问"我的请假批了吗"能查到真实结果（两端互通闭环）
   */
  const decide = async (r: LeaveRequestItem, d: 'approved' | 'rejected', reason?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/leave/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, decision: d, reason }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // 后端不可达时仍完成本地演示（静态数据模式），不回执"已写回"
      onDecide?.(r, d, reason);
      setDecisions((s) => ({ ...s, [r.id]: d }));
      setBusy(false);
      return;
    }
    setDecisions((s) => ({ ...s, [r.id]: d }));
    onDecide?.(r, d, reason); // 通知对话流追加回执消息，形成"办理-回执-追踪"闭环
    setBusy(false);
  };

  const confirmReject = () => {
    if (!confirming) return;
    decide(confirming, 'rejected', rejectReason.trim() || undefined);
    setConfirming(null);
    setRejectReason('');
  };

  return (
    <div className="appr-card">
      <div className="appr-card-header">
        <span>待审批请假申请</span>
        <span className="appr-card-count">
          {pending.length > 0 ? `${pending.length} 条待处理` : '全部处理完毕 ✓'}
        </span>
      </div>
      <div className="appr-card-body">
        {pending.length === 0 && (
          <div className="appr-empty">本轮申请已全部处理，回执见对话记录。</div>
        )}
        {pending.map((r) => (
          <div key={r.id} className="appr-item">
            <div className="appr-main">
              <div className="appr-name-row">
                <span className="appr-name">{r.student}</span>
                <span className="appr-class">{r.className}</span>
                <span className={`appr-type ${r.type === '病假' ? 'sick' : ''}`}>{r.type} · {r.days} 天</span>
                {r.isNew && <span className="appr-new">新</span>}
              </div>
              <div className="appr-reason">{r.reason}</div>
              <div className="appr-meta">{r.range} · 提交于 {r.submitted}</div>
            </div>
            <div className="appr-actions">
              <button className="appr-btn ok" onClick={() => decide(r, 'approved')}>批准</button>
              <button
                className="appr-btn no"
                onClick={() => { setConfirming(r); setRejectReason(''); }}
              >
                驳回
              </button>
            </div>
          </div>
        ))}

        {/* 驳回二次确认区：理由可填，取消不生效（防误触） */}
        {confirming && (
          <div className="appr-confirm">
            <div className="appr-confirm-text">
              确认驳回 <b>{confirming.student}</b> 的请假申请（{confirming.type} · {confirming.days} 天，{confirming.range}）？
            </div>
            <input
              className="appr-confirm-input"
              placeholder="驳回理由（选填，将写入回执）"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmReject(); }}
              autoFocus
            />
            <div className="appr-confirm-actions">
              <button className="appr-btn warn" onClick={confirmReject}>确认驳回</button>
              <button className="appr-btn ghost" onClick={() => setConfirming(null)}>取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApprovalsCard;
