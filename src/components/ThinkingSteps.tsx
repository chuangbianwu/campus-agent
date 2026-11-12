/**
 * 思考步骤面板（可折叠）
 *
 * 把 Agent 的决策过程拆成三步展示：
 *   ① 分析用户意图
 *   ② 调用工具 · 工具名
 *   ③ 数据加载完毕
 * 流式进行中默认展开，结束后自动折叠成一行摘要，
 * 评委可以点开回看——过程透明，但平时不占地方。
 */

import { useState, useEffect } from 'react';

export interface ToolCallInfo {
  id: string;
  label: string;               // 工具名（如"课表查询"）
  status: 'running' | 'done';
  summary?: string;
}

/** 由工具调用记录推导步骤状态 */
function buildSteps(toolCalls: ToolCallInfo[], streaming: boolean) {
  const allDone = toolCalls.length > 0 && toolCalls.every((t) => t.status === 'done');
  const steps: Array<{ text: string; state: 'done' | 'running' | 'pending' }> = [
    { text: '分析用户意图', state: toolCalls.length > 0 ? 'done' : 'running' },
  ];
  for (const t of toolCalls) {
    steps.push({
      text: `调用工具 · ${t.label}`,
      state: t.status === 'done' ? 'done' : 'running',
    });
  }
  if (toolCalls.length > 0) {
    steps.push({
      text: '数据加载完毕',
      state: allDone ? 'done' : 'pending',
    });
    steps.push({
      text: '组织回答',
      state: allDone ? (streaming ? 'running' : 'done') : 'pending',
    });
  }
  return steps;
}

function ThinkingSteps({ toolCalls, streaming }: { toolCalls: ToolCallInfo[]; streaming: boolean }) {
  const [open, setOpen] = useState(true);

  // 流式结束后自动折叠（用户可手动再展开）
  useEffect(() => {
    if (!streaming) setOpen(false);
  }, [streaming]);

  const steps = buildSteps(toolCalls, streaming);

  return (
    <div className={`thinking ${open ? 'open' : ''}`}>
      <button className="thinking-toggle" onClick={() => setOpen(!open)}>
        <span className="thinking-arrow">▶</span>
        思考过程 · {steps.filter((s) => s.state === 'done').length}/{steps.length} 步
      </button>
      {open && (
        <div className="thinking-steps">
          {steps.map((s, i) => (
            <div key={i} className={`tstep ${s.state}`}>
              <span className="tstep-icon">
                {s.state === 'done' ? '✓' : s.state === 'running' ? <span className="spin" /> : '○'}
              </span>
              {s.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ThinkingSteps;
