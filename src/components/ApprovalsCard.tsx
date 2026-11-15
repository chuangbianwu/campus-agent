/**
 * 待审批请假卡片（辅导员专属 · 生成式 UI）
 *
 * 辅导员问"有哪些请假待审批"→ Agent 调 query_leave_approvals → 渲染这张卡。
 * 批准/驳回是本地状态操作（Mock），但演示效果完整：
 * 点完后该行立即变灰并显示结果徽标。
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
}

export interface ApprovalsData {
  requests: LeaveRequestItem[];
}

function ApprovalsCard({
  data,
  onDecide,
}: {
  data: ApprovalsData;
  onDecide?: (r: LeaveRequestItem, d: 'approved' | 'rejected') => void;
}) {
  // 本地审批状态：id → 'approved' | 'rejected'
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});
  // 已处理的直接从列表移除（评审 P1：状态回写要可见），只留待处理
  const pending = data.requests.filter((r) => !decisions[r.id]);

  const decide = (r: LeaveRequestItem, d: 'approved' | 'rejected') => {
    setDecisions((s) => ({ ...s, [r.id]: d }));
    onDecide?.(r, d); // 通知对话流追加回执消息，形成"办理-回执-追踪"闭环
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
              </div>
              <div className="appr-reason">{r.reason}</div>
              <div className="appr-meta">{r.range} · 提交于 {r.submitted}</div>
            </div>
            <div className="appr-actions">
              <button className="appr-btn ok" onClick={() => decide(r, 'approved')}>批准</button>
              <button className="appr-btn no" onClick={() => decide(r, 'rejected')}>驳回</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApprovalsCard;
