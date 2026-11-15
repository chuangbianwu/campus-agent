import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import CourseCard, { type CourseCardData } from '@/components/CourseCard';
import FreeRoomCard, { type FreeRoomCardData } from '@/components/FreeRoomCard';
import LeaveFormCard from '@/components/LeaveFormCard';
import type { LeaveFormData } from '@/lib/leaveForm';
import ApprovalsCard, { type ApprovalsData } from '@/components/ApprovalsCard';
import LoginView, { type RoleKey } from '@/components/LoginView';
import ThinkingSteps, { type ToolCallInfo } from '@/components/ThinkingSteps';
import CitationDrawer, { type Citation } from '@/components/CitationDrawer';
import Rail, { NAV_TITLES, QUICK_PROMPTS, COUNSELOR_QUICK_PROMPTS, type NavKey } from '@/components/Rail';
import Board from '@/components/Board';
import AboutView from '@/components/AboutView';
import './App.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallInfo[];
  cards?: { cardType: string; data: CourseCardData | FreeRoomCardData | LeaveFormData | ApprovalsData }[];
  citations?: Citation[];
  safety?: string;
}

export default function App() {
  // 登录角色：null = 未登录（显示登录页）；选择后持久化到 localStorage
  const [role, setRole] = useState<RoleKey | null>(
    () => (localStorage.getItem('cbw-role') as RoleKey | null) ?? null
  );
  const [nav, setNav] = useState<NavKey>('assistant');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState<Citation[] | null>(null);
  // 语音输入：Web Speech API（Chrome/Edge 支持中文识别）
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const voiceBaseRef = useRef(''); // 开始录音时输入框里已有的文字
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lampGlowRef = useRef<HTMLDivElement>(null);
  const coolGlowRef = useRef<HTMLDivElement>(null);

  // 粒子场背景（低亮度星点连线，营造氛围但不抢焦点）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, t = 0;
    const resize = () => { w = canvas.width = innerWidth; h = canvas.height = innerHeight; };
    resize();
    addEventListener('resize', resize);
    const N = innerWidth < 900 ? 45 : 85;
    const ps = Array.from({ length: N }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.4 + 0.4, tw: Math.random() * Math.PI * 2,
    }));
    const step = () => {
      t += 0.008;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.fillStyle = `rgba(140,160,220,${0.25 + 0.2 * Math.sin(t * 2 + p.tw)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y, d = dx * dx + dy * dy;
        if (d < 130 * 130) {
          ctx.strokeStyle = `rgba(120,140,200,${(1 - d / (130 * 130)) * 0.08})`;
          ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke();
        }
      }
      raf = requestAnimationFrame(step);
    };
    step();
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);

  // 两盏"灯光"随鼠标轻微视差
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      if (lampGlowRef.current) lampGlowRef.current.style.transform = `translate(${nx * 18}px,${ny * 14}px)`;
      if (coolGlowRef.current) coolGlowRef.current.style.transform = `translate(${nx * -22}px,${ny * -16}px)`;
    };
    addEventListener('mousemove', onMove);
    return () => removeEventListener('mousemove', onMove);
  }, []);

  // 新消息自动滚到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // 选择 / 切换角色：清空对话，重新进入
  const selectRole = (r: RoleKey) => {
    localStorage.setItem('cbw-role', r);
    setRole(r);
    setMessages([]);
    setNav('assistant');
  };
  const switchRole = () => {
    localStorage.removeItem('cbw-role');
    setRole(null);
    setMessages([]);
    setNav('assistant');
  };

  /**
   * 语音输入开关
   * 设计决策：识别结果只填进输入框，不自动发送——
   * 给用户一次检查修改的机会，避免识别错字直接发出去（演示更稳）
   */
  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as unknown as Record<string, unknown>;
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => any) | undefined;
    if (!SR) {
      alert('当前浏览器不支持语音输入，请用 Chrome / Edge 打开');
      return;
    }
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.interimResults = true; // 边说边出字，反馈感强
    rec.continuous = false;
    voiceBaseRef.current = input ? input + ' ' : '';
    rec.onresult = (e: any) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(voiceBaseRef.current + transcript);
    };
    rec.onend = () => { setListening(false); recognitionRef.current = null; };
    rec.onerror = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  /** 办理回执：审批/下载完成后，在对话流追加一条可追踪的系统消息 */
  const appendReceipt = (content: string) => {
    setMessages((msgs) => [
      ...msgs,
      { id: `r${Date.now()}`, role: 'assistant', content },
    ]);
  };

  const ask = async (text?: string) => {    const q = (text ?? input).trim();
    if (!q || loading || !role) return;
    recognitionRef.current?.stop(); // 发送时若正在录音，先停掉
    setInput('');
    setLoading(true);
    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', content: q };
    const aiMsg: Message = { id: `a${Date.now()}`, role: 'assistant', content: '', toolCalls: [] };
    setMessages((m) => [...m, userMsg, aiMsg]);
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, role }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const ev = JSON.parse(data);
            setMessages((msgs) => {
              const next = [...msgs];
              const msg = { ...next[next.length - 1] };
              if (ev.type === 'delta') {
                msg.content += ev.content;
              } else if (ev.type === 'tool_call') {
                msg.toolCalls = [...(msg.toolCalls ?? []), { id: ev.id, label: ev.label, status: 'running' as const }];
              } else if (ev.type === 'tool_result') {
                msg.toolCalls = (msg.toolCalls ?? []).map((t) =>
                  t.id === ev.id ? { ...t, status: 'done' as const, summary: ev.summary } : t
                );
              } else if (ev.type === 'card') {
                msg.cards = [...(msg.cards ?? []), { cardType: ev.cardType, data: ev.data }];
              } else if (ev.type === 'citations') {
                msg.citations = ev.items;
              } else if (ev.type === 'safety') {
                msg.safety = ev.rule;
              } else if (ev.type === 'error') {
                msg.content = String(ev.message ?? ev.content ?? '未知错误');
              }
              next[next.length - 1] = msg;
              return next;
            });
          } catch { /* 忽略不完整的行 */ }
        }
      }
    } catch (e) {
      const errText = `请求失败：${e instanceof Error ? e.message : '网络错误'}。请确认服务已启动且 .env 中配置了 DEEPSEEK_API_KEY。`;
      setMessages((msgs) => {
        const next = [...msgs];
        next[next.length - 1] = { ...next[next.length - 1], content: errText };
        return next;
      });
    }
    setLoading(false);
  };

  const chips = (role === 'counselor' ? COUNSELOR_QUICK_PROMPTS[nav] : QUICK_PROMPTS[nav]) ?? [];
  const showChat = nav !== 'about';
  const lastId = messages.length ? messages[messages.length - 1].id : '';

  return (
    <>
      <canvas ref={canvasRef} className="bg-canvas" />
      <div ref={lampGlowRef} className="bg-lampglow" />
      <div ref={coolGlowRef} className="bg-coolglow" />

      {!role ? (
        <LoginView onSelect={selectRole} />
      ) : (
      <div className="shell">
        <Rail active={nav} onChange={setNav} role={role} onSwitchRole={switchRole} />

        <main className="panel">
          {showChat ? (
            <>
              <div className="chat-head">
                <div className="chat-title">{NAV_TITLES[nav].title}</div>
                <div className="chat-note">{NAV_TITLES[nav].note}</div>
              </div>

              <div className="chat-body" ref={scrollRef}>
                {messages.length === 0 && (
                  <div className="hero">
                    <div className="hero-logo">勤</div>
                    <div className="hero-h">今晚想办点什么？</div>
                    <div className="hero-sub">问课表、查制度、找流程，一次说清楚。</div>
                  </div>
                )}

                {messages.map((m) => (
                  <div key={m.id} className={`msg ${m.role === 'user' ? 'user' : 'ai'}`}>
                    <div className="avatar">{m.role === 'user' ? '我' : 'AI'}</div>
                    <div className="msg-body">
                      {m.role === 'assistant' && (m.toolCalls?.length ?? 0) > 0 && (
                        <ThinkingSteps
                          toolCalls={m.toolCalls!}
                          streaming={loading && m.id === lastId}
                        />
                      )}
                      {/* 等待首个响应期间的骨架屏（消除等待空白，附状态文案） */}
                      {m.role === 'assistant' && loading && m.id === lastId && !m.content && (m.toolCalls?.length ?? 0) === 0 && (
                        <div className="bubble skeleton">
                          <span className="sk-status">正在分析意图…</span>
                          <span className="sk-bar" />
                          <span className="sk-bar" />
                          <span className="sk-bar short" />
                        </div>
                      )}
                      {/* 工具执行完毕、最终回答开始流式输出前的衔接状态 */}
                      {m.role === 'assistant' && loading && m.id === lastId && !m.content && (m.toolCalls?.length ?? 0) > 0 && (
                        <div className="thinking-status">数据加载完毕，正在组织回答…</div>
                      )}
                      {m.content && (
                        <div className="bubble">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      )}
                      {m.cards?.map((c, i) =>
                        c.cardType === 'courses' ? (
                          <CourseCard key={i} data={c.data as CourseCardData} />
                        ) : c.cardType === 'free_rooms' ? (
                          <FreeRoomCard key={i} data={c.data as FreeRoomCardData} />
                        ) : c.cardType === 'leave_form' ? (
                          <LeaveFormCard
                            key={i}
                            data={c.data as LeaveFormData}
                            onDownloaded={(f) => appendReceipt(`📄 请假申请表已生成并下载：${f}（预填姓名/专业/制度依据）`)}
                          />
                        ) : c.cardType === 'approvals' ? (
                          <ApprovalsCard
                            key={i}
                            data={c.data as ApprovalsData}
                            onDecide={(r, d, reason) =>
                              appendReceipt(
                                d === 'approved'
                                  ? `✓ 已批准 ${r.student} 的请假申请（${r.type} · ${r.days} 天，${r.range}）`
                                  : `✗ 已驳回 ${r.student} 的请假申请（${r.type} · ${r.days} 天，${r.range}）${reason ? `，理由：${reason}` : ''}`
                              )
                            }
                          />
                        ) : null
                      )}
                      {m.safety && <div className="safety-tag">🛡 安全护栏已触发（{m.safety}）</div>}
                      {m.citations && m.citations.length > 0 && (
                        <div className="citation-row">
                          {m.citations.map((c, i) => (
                            <button
                              key={i}
                              className="citation-tag"
                              onClick={() => setDrawer(m.citations!)}
                            >
                              📚 来源：《{c.title}》{c.section ? ` · ${c.section}` : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="chat-foot">
                {chips.length > 0 && (
                  <div className="quick-row">
                    {chips.map((c) => (
                      <button key={c} className="chip" disabled={loading} onClick={() => ask(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                <div className="input-row">
                  <div className="input-box">
                    <textarea
                      className="chat-input"
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
                      }}
                      placeholder={listening ? '正在聆听，请说话…' : '输入问题，Enter 发送…'}
                    />
                    <button
                      className={`mic-btn ${listening ? 'listening' : ''}`}
                      onClick={toggleVoice}
                      title={listening ? '停止录音' : '语音输入'}
                    >
                      {listening ? '■' : '🎙'}
                    </button>
                    <button
                      className="send-btn"
                      disabled={loading || !input.trim()}
                      onClick={() => ask()}
                      title="发送"
                    >
                      ↑
                    </button>
                  </div>
                </div>
                <div className="status-line">deepseek-chat · Function Calling · 自实现 BM25 RAG</div>
              </div>
            </>
          ) : (
            <AboutView />
          )}
        </main>

        <Board role={role} />
      </div>
      )}

      <CitationDrawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        citations={drawer ?? []}
      />
    </>
  );
}
