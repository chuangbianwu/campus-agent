/**
 * 关于作品视图
 *
 * 答辩讲解页：四大亮点对照评分维度 + 架构一句话 + 技术栈。
 * 评委点开就能 30 秒看懂这个作品强在哪。
 */

const HIGHLIGHTS = [
  {
    title: '调度 Agent + Tool Calling',
    desc: '大模型自主识别意图、选择工具、组织回答，支持最多 3 轮工具链调用，可处理"查课表+请假"这类复合需求。',
    dim: 'AI 技术深度 35%',
  },
  {
    title: 'RAG 检索增强',
    desc: '制度文档切片 + 自实现 BM25 检索引擎 + 中文二元分词，每个回答附条款级引用出处，零外部依赖。',
    dim: 'AI 技术深度 · 检索质量',
  },
  {
    title: '生成式 UI',
    desc: '工具返回结构化数据，前端直接渲染课程卡片：数据零出错、样式统一、对话即办事。',
    dim: '创新性 25%',
  },
  {
    title: 'AI 安全护栏',
    desc: '双层纵深防御：规则层拦截提示词注入与敏感话题（零 API 消耗），提示词层加固兜底。',
    dim: 'AI 安全',
  },
];

const TECH_STACK = [
  'DeepSeek Function Calling',
  '自实现 BM25 RAG 检索',
  'Agent 工具调度',
  'SSE 流式输出',
  'React 19 + TypeScript + Vite',
  'shadcn/ui 组件系统',
];

function AboutView() {
  return (
    <div className="about">
      <div>
        <h2>校园百事通</h2>
        <div className="about-sub">传智杯 · 全国高校 AI Web 开发挑战赛参赛作品 —— AI 驱动的校园智能办事 Agent</div>
      </div>

      <div>
        <div className="board-title">核心亮点</div>
        <div className="about-grid">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="about-card">
              <div className="about-card-title">{h.title}</div>
              <div className="about-card-desc">{h.desc}</div>
              <div className="about-card-dim">{h.dim}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="board-title">技术栈</div>
        <div className="tech-badges" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {TECH_STACK.map((t, i) => (
            <span key={t} className={`tech-badge ${i === 0 ? 'lit' : ''}`}>{t}</span>
          ))}
        </div>
      </div>

      <div>
        <div className="board-title">架构</div>
        <div className="about-card-desc" style={{ lineHeight: 2 }}>
          用户提问 → 输入安全护栏 → 调度 Agent（意图识别 → 工具调用 → 结果回填，最多 3 轮）→ 结构化卡片 + 流式回答。
          同一份 Agent 逻辑运行在三个入口：Vite 中间件（开发）、Express（独立后端）、Vercel Serverless（线上）。
        </div>
      </div>
    </div>
  );
}

export default AboutView;
