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

function ApprovalsCard({ data }: { data: ApprovalsData }) {
  // 本地审批状态：id → 'approved' | 'rejected'
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});
  const pending = data.requests.filter((r) => !decisions[r.id]);

  return (
    <div className="appr-card">
      <div className="appr-card-header">
        <span>待审批请假申请</span>
        <span className="appr-card-count">{pending.length} 条待处理</span>
      </div>
      <div className="appr-card-body">
        {data.requests.map((r) => {
          const d = decisions[r.id];
          return (
            <div key={r.id} className={`appr-item ${d ? 'done' : ''}`}>
              <div className="appr-main">
                <div className="appr-name-row">
                  <span className="appr-name">{r.student}</span>
                  <span className="appr-class">{r.className}</span>
                  <span className={`appr-type ${r.type === '病假' ? 'sick' : ''}`}>{r.type} · {r.days} 天</span>
                </div>
                <div className="appr-reason">{r.reason}</div>
                <div className="appr-meta">{r.range} · 提交于 {r.submitted}</div>
              </div>
              {d ? (
                <span className={`appr-result ${d}`}>{d === 'approved' ? '已批准' : '已驳回'}</span>
              ) : (
                <div className="appr-actions">
                  <button
                    className="appr-btn ok"
                    onClick={() => setDecisions((s) => ({ ...s, [r.id]: 'approved' }))}
                  >
                    批准
                  </button>
                  <button
                    className="appr-btn no"
                    onClick={() => setDecisions((s) => ({ ...s, [r.id]: 'rejected' }))}
                  >
                    驳回
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ApprovalsCard;
