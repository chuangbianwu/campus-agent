/**
 * 校园智能办事 Agent - 前端主界面（Day 2 升级版）
 *
 * 新增功能：Agent 思考过程可视化
 * - 当 AI 调用工具时，消息气泡上方会显示工具卡片：
 *   "🔧 课表查询（执行中...）" → "✅ 查询了周二的课表：共 3 门课"
 * - 这是比赛"用户体验"和"AI 技术深度"的加分项：
 *   评委能直观看到 Agent 的决策过程，而不是一个黑盒
 *
 * 后端 SSE 事件协议（与 server/index.ts 约定）：
 *   {"type":"tool_call",   "id", "label", "args"}     → Agent 决定调工具
 *   {"type":"tool_result", "id", "label", "summary"}  → 工具执行完毕
 *   {"type":"delta",       "content"}                 → 回复文字
 *   {"type":"error",       "content"}                 → 出错
 *   [DONE]                                            → 结束
 */

import { useState, useRef, useEffect } from 'react';
import './App.css';
import CourseCard, { type CourseCardData } from './components/CourseCard';

// 一次工具调用的展示数据
interface ToolCall {
  id: string;                 // 工具调用 ID（用于配对结果）
  label: string;              // 工具名称（如"课表查询"）
  args: Record<string, unknown>; // 调用参数
  status: 'running' | 'done'; // 执行中 / 已完成
  summary?: string;           // 执行结果摘要
  icon?: string;              // 自定义图标（如安全护栏用 🛡️）
}

// 结构化卡片数据（生成式 UI）
interface Card {
  cardType: 'courses';        // 卡片类型（以后可扩展）
  data: CourseCardData;
}

// 消息类型定义
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];     // 这条 AI 消息关联的工具调用记录
  cards?: Card[];             // 这条 AI 消息关联的生成式 UI 卡片
}

function App() {
  // ========== 状态管理 ==========
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是校园智能办事助手。试试问我：\n· 我周二有什么课？\n· 请假需要什么流程？\n· 图书馆能借几本书？',
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ========== Refs ==========
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 每当 messages 变化时，自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * 更新指定 AI 消息的工具调用记录
   * @param messageId 消息 ID
   * @param updater 对 toolCalls 数组的修改函数
   */
  const updateToolCalls = (messageId: string, updater: (calls: ToolCall[]) => ToolCall[]) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, toolCalls: updater(msg.toolCalls || []) }
          : msg
      )
    );
  };

  // ========== 核心函数：发送消息 ==========
  const handleSend = async () => {
    const userContent = input.trim();
    if (!userContent || isLoading) return;

    // 1. 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // 2. 准备发送给后端的消息（只发 role + content）
    const apiMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    // 3. 创建一条空的 AI 消息，接收流式内容
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolCalls: [],
    };

    try {
      // 请求同源接口（由 Vite 服务器的 campus-api 插件处理，见 vite.config.ts）
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '请求失败');
      }

      setMessages(prev => [...prev, aiMessage]);

      // 4. 读取 SSE 流
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);

            // ---- 事件 1：Agent 决定调用工具 ----
            if (json.type === 'tool_call') {
              updateToolCalls(aiMessageId, calls => [
                ...calls,
                {
                  id: json.id,
                  label: json.label,
                  args: json.args || {},
                  status: 'running',
                },
              ]);
            }

            // ---- 事件 2：工具执行完毕 ----
            else if (json.type === 'tool_result') {
              updateToolCalls(aiMessageId, calls =>
                calls.map(c =>
                  c.id === json.id
                    ? { ...c, status: 'done', label: json.label, summary: json.summary }
                    : c
                )
              );
            }

            // ---- 事件 2.5：结构化卡片（生成式 UI）----
            else if (json.type === 'card') {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, cards: [...(msg.cards || []), { cardType: json.cardType, data: json.data }] }
                    : msg
                )
              );
            }

            // ---- 事件 3：回复文字（追加到气泡）----
            else if (json.type === 'delta' && json.content) {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, content: msg.content + json.content }
                    : msg
                )
              );
            }

            // ---- 事件 3.5：安全护栏拦截 ----
            else if (json.type === 'safety') {
              updateToolCalls(aiMessageId, calls => [
                ...calls,
                {
                  id: `safety-${Date.now()}`,
                  label: '安全护栏',
                  args: {},
                  status: 'done',
                  summary: '拦截了可疑输入（未调用大模型）',
                  icon: '🛡️',
                },
              ]);
            }

            // ---- 事件 4：后端报错 ----
            else if (json.type === 'error') {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, content: msg.content + `\n\n⚠️ ${json.content}` }
                    : msg
                )
              );
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }

      // 5. 流结束
      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `抱歉，发生了错误：${error.message || '未知错误'}`,
        }
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // 按 Enter 发送（Shift+Enter 换行）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ========== 渲染 UI ==========
  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>校园智能办事助手</h1>
        <span className="subtitle">AI Agent · 课表查询 · 制度咨询 · 办事指南</span>
      </header>

      <main className="messages-area">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`}
          >
            <div className="avatar">
              {msg.role === 'user' ? '你' : 'AI'}
            </div>

            <div className="message-body">
              {/* 工具调用卡片：展示 Agent 的思考过程 */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="tool-calls">
                  {msg.toolCalls.map(tc => (
                    <div key={tc.id} className={`tool-call ${tc.status}`}>
                      <span className="tool-icon">
                        {tc.icon || (tc.status === 'running' ? '⏳' : '🔧')}
                      </span>
                      <span className="tool-label">{tc.label}</span>
                      <span className="tool-status">
                        {tc.status === 'running'
                          ? '调用中...'
                          : tc.summary || '已完成'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 生成式 UI 卡片（课程表等） */}
              {msg.cards?.map((card, i) =>
                card.cardType === 'courses' ? (
                  <CourseCard key={i} data={card.data} />
                ) : null
              )}

              {/* 消息气泡 */}
              <div className="bubble">
                <div className="content" style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
                {msg.isStreaming && <span className="cursor-blink">▋</span>}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="input-area">
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题，按 Enter 发送..."
            disabled={isLoading}
            className="chat-input"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="send-button"
          >
            {isLoading ? '发送中...' : '发送'}
          </button>
        </div>
        <div className="status-bar">
          {isLoading ? 'AI 正在思考中...' : '就绪'}
        </div>
      </footer>
    </div>
  );
}

export default App;
