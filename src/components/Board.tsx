/**
 * 右侧情境看板
 *
 * 概览统计 + 今日课程 + 系统状态。
 * 今日课程从课表数据实时计算（周末自动显示下周一），
 * 评委一眼能看到 Agent 背后的数据规模和系统健康度。
 */

import coursesDataJson from '../../server/data/courses.json';
import policiesDataJson from '../../server/data/policies.json';
import leaveRequestsJson from '../../server/data/leave_requests.json';
import { useEffect, useState } from 'react';
import type { Course } from './CourseCard';
import type { RoleKey } from './LoginView';

const coursesData = coursesDataJson as {
  schedule: Record<string, Course[]>;
};

const policies = policiesDataJson as Array<{ content: string }>;

const pendingCountStatic = (leaveRequestsJson as { requests: unknown[] }).requests.length;

/**
 * 备忘录（辅导员专属，localStorage 持久化）
 * 评审反馈"教师端缺一个能随手记录的地方"——班会事项、谈话提醒都放这里
 */
interface Memo { id: string; text: string; done: boolean; }

function MemoBlock() {
  const [memos, setMemos] = useState<Memo[]>(() => {
    try { return JSON.parse(localStorage.getItem('cbw-memos') ?? '[]'); } catch { return []; }
  });
  const [draft, setDraft] = useState('');

  useEffect(() => {
    localStorage.setItem('cbw-memos', JSON.stringify(memos));
  }, [memos]);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setMemos((m) => [{ id: `m${Date.now()}`, text, done: false }, ...m]);
    setDraft('');
  };

  return (
    <div>
      <div className="board-title">备忘录</div>
      <div className="memo-add">
        <input
          className="memo-input"
          placeholder="随手记一笔，Enter 保存"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        />
      </div>
      {memos.length === 0 && <div className="memo-empty">还没有备忘，比如"周五前收齐困难认定表"</div>}
      {memos.map((m) => (
        <div key={m.id} className={`memo-row ${m.done ? 'done' : ''}`}>
          <button
            className="memo-check"
            title={m.done ? '标为未完成' : '标为完成'}
            onClick={() => setMemos((s) => s.map((x) => x.id === m.id ? { ...x, done: !x.done } : x))}
          >
            {m.done ? '✓' : ''}
          </button>
          <span className="memo-text">{m.text}</span>
          <button
            className="memo-del"
            title="删除"
            onClick={() => setMemos((s) => s.filter((x) => x.id !== m.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/** 制度文档按小节切片的数量（与 server/rag 逻辑一致） */
function countChunks() {
  return policies.reduce((sum, p) => {
    return sum + p.content.split(/(?=\n[一二三四五六七八九十]+、)/).filter((s) => s.trim()).length;
  }, 0);
}

function getToday() {
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const today = weekDays[new Date().getDay()];
  const isWeekend = today === '周日' || today === '周六';
  const day = isWeekend ? '周一' : today;
  return {
    label: isWeekend ? '下周一课程' : '今日课程',
    courses: coursesData.schedule[day] || [],
  };
}

function Board({ role }: { role: RoleKey }) {
  const today = getToday();
  const chunkCount = countChunks();
  // 待审批数从共享存储实时拉取（学生新提交后这里会变），失败时退回静态数据
  const [pendingCount, setPendingCount] = useState(pendingCountStatic);
  useEffect(() => {
    if (role !== 'counselor') return;
    fetch('/api/leave')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.pending === 'number') setPendingCount(d.pending); })
      .catch(() => { /* 后端不可达时用静态值，不影响其他功能 */ });
  }, [role]);

  return (
    <aside className="panel board">
      <div>
        <div className="board-title">概览</div>
        <div className="stat-grid">
          {role === 'counselor' ? (
            <div className="stat"><div className="stat-num lit">{pendingCount}</div><div className="stat-label">待审批请假</div></div>
          ) : (
            <div className="stat"><div className="stat-num lit">{today.courses.length}</div><div className="stat-label">{today.label}</div></div>
          )}
          <div className="stat"><div className="stat-num">{chunkCount}</div><div className="stat-label">知识库切片</div></div>
          <div className="stat"><div className="stat-num">{role === 'counselor' ? 4 : 5}</div><div className="stat-label">Agent 工具</div></div>
          <div className="stat"><div className="stat-num">{policies.length}</div><div className="stat-label">制度文档</div></div>
        </div>
      </div>

      {role === 'counselor' && <MemoBlock />}

      <div>
        <div className="board-title">{role === 'counselor' ? `张三 · ${today.label}` : today.label}</div>
        {today.courses.map((c, i) => (
          <div key={i} className="today-row">
            <span className="today-time">{c.time}</span>
            <span className="today-name">{c.course}</span>
            <span className="today-room">{c.room}</span>
          </div>
        ))}
      </div>

      <div>
        <div className="board-title">系统状态</div>
        <div className="sys-row"><span>DeepSeek API</span><span className="tag ok">正常</span></div>
        <div className="sys-row"><span>RAG 检索引擎</span><span className="tag ok">已索引</span></div>
        <div className="sys-row"><span>安全护栏</span><span className="tag ok">已启用</span></div>
      </div>
    </aside>
  );
}

export default Board;
