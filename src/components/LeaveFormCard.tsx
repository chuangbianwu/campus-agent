/**
 * 请假申请表卡片（生成式 UI · 对话即办事）
 *
 * Agent 检索到请假制度条款后，后端附带这张卡片：
 * 预填学生信息 + 制度依据，一键下载 .docx。
 * 演示金句："Agent 不只告诉你流程，直接把表给你填好了。"
 */

import { useState } from 'react';
import { downloadLeaveForm, type LeaveFormData } from '@/lib/leaveForm';

function LeaveFormCard({
  data,
  onDownloaded,
}: {
  data: LeaveFormData;
  onDownloaded?: (fileName: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onDownload = async () => {
    setBusy(true);
    try {
      const fileName = await downloadLeaveForm(data);
      setDone(true);
      // 回执：下载完成后在对话里留一条可追踪记录（办理-回执-追踪闭环）
      onDownloaded?.(fileName);
      setTimeout(() => setDone(false), 3000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="leave-card">
      <div className="leave-card-header">
        <span>请假申请表</span>
        <span className="leave-card-badge">已预填</span>
      </div>
      <div className="leave-card-body">
        <div className="leave-row"><span className="leave-label">姓名</span><span>{data.student}</span></div>
        <div className="leave-row"><span className="leave-label">专业</span><span>{data.major} · {data.grade}</span></div>
        <div className="leave-row"><span className="leave-label">依据</span><span className="leave-basis">{data.basis}</span></div>
      </div>
      <div className="leave-card-foot">
        <button className="leave-btn" onClick={onDownload} disabled={busy}>
          {busy ? '生成中…' : done ? '✓ 已下载' : '⬇ 下载 .docx'}
        </button>
        <span className="leave-hint">也可以直接对我说「帮我请 X 天假」，一键提交给辅导员审批</span>
      </div>
    </div>
  );
}

export default LeaveFormCard;
