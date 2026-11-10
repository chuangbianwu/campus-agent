/**
 * About 落地页（借鉴 StudyAI 的 About 页设计）
 *
 * 作用：评委/观众打开作品的第一个页面，30 秒内讲清楚：
 *   1. 这是什么（一句话定位）
 *   2. 强在哪（四大核心亮点，对应评分维度）
 *   3. 怎么用（三步使用流程）
 *   4. 真实数据感（今日课程预览，借鉴"今日任务"的进度感设计）
 * 点击"进入助手"进入聊天界面。
 */

import coursesDataJson from '../../server/data/courses.json';
import type { Course } from './CourseCard';

const coursesData = coursesDataJson as {
  student: string;
  major: string;
  semester: string;
  schedule: Record<string, Course[]>;
};

/** 算出今天是周几，取今天的课（周末显示下周一的） */
function getTodayCourses() {
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const today = weekDays[new Date().getDay()];
  const isWeekend = today === '周日' || today === '周六';
  const day = isWeekend ? '周一' : today;
  return { day, label: isWeekend ? '下周一' : '今天', courses: coursesData.schedule[day] || [] };
}

const HIGHLIGHTS = [
  {
    icon: '🤖',
    title: '调度 Agent',
    desc: '大模型自主识别意图、选择工具、组织回答，支持最多 3 轮工具链调用',
    tag: 'AI 技术深度',
  },
  {
    icon: '📚',
    title: 'RAG 知识库',
    desc: '制度文档切片 + BM25 检索引擎，每个回答都带条款级引用出处',
    tag: 'AI 技术深度',
  },
  {
    icon: '🎨',
    title: '生成式 UI',
    desc: '查询结果直接渲染成结构化卡片，数据零出错，对话即办事',
    tag: '创新性',
  },
  {
    icon: '🛡️',
    title: 'AI 安全护栏',
    desc: '规则层拦截注入攻击 + 提示词层加固，双层纵深防御',
    tag: 'AI 安全',
  },
];

const STEPS = [
  { icon: '💬', title: '自然语言提问', desc: '"我周二有什么课？""请假需要什么流程？"' },
  { icon: '⚙️', title: 'Agent 调用工具', desc: '调度 Agent 识别意图，调用课表/制度工具获取真实数据' },
  { icon: '✨', title: '卡片 + 回答', desc: '结构化卡片呈现数据，AI 补充个性化提醒' },
];

function LandingPage({ onEnter }: { onEnter: () => void }) {
  const today = getTodayCourses();

  return (
    <div className="landing">
      {/* 顶部导航 */}
      <nav className="landing-nav">
        <span className="landing-logo">🎓 校园百事通</span>
        <button className="landing-nav-btn" onClick={onEnter}>
          进入助手 →
        </button>
      </nav>

      {/* Hero 区：一句话定位 */}
      <section className="landing-hero">
        <div className="landing-badge">传智杯 · 全国高校 AI Web 开发挑战赛参赛作品</div>
        <h1 className="landing-title">校园百事通</h1>
        <p className="landing-subtitle">
          AI 驱动的校园智能办事 Agent —— 课表查询、制度咨询，对话即办事
        </p>
        <div className="landing-actions">
          <button className="landing-cta" onClick={onEnter}>
            立即体验 →
          </button>
          <a className="landing-cta-secondary" href="#features">
            了解核心亮点
          </a>
        </div>
      </section>

      {/* 今日课程预览（借鉴 StudyAI"今日任务"的进度感） */}
      <section className="landing-today">
        <div className="today-card">
          <div className="today-header">
            <span>📅 {today.label}的课程（{today.day}）</span>
            <span className="today-meta">
              {coursesData.major} · {today.courses.length} 门
            </span>
          </div>
          <div className="today-list">
            {today.courses.map((c, i) => (
              <div key={i} className="today-item">
                <span className="today-time">{c.time}</span>
                <span className="today-name">{c.course}</span>
                <span className="today-room">{c.room}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 四大核心亮点 */}
      <section className="landing-features" id="features">
        <h2 className="section-title">核心亮点</h2>
        <div className="features-grid">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="feature-card">
              <div className="feature-icon">{h.icon}</div>
              <div className="feature-title">{h.title}</div>
              <div className="feature-desc">{h.desc}</div>
              <div className="feature-tag">{h.tag}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 三步使用流程 */}
      <section className="landing-steps">
        <h2 className="section-title">使用流程</h2>
        <div className="steps-row">
          {STEPS.map((s, i) => (
            <div key={s.title} className="step-card">
              <div className="step-number">{i + 1}</div>
              <div className="step-icon">{s.icon}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="landing-footer">
        <button className="landing-cta" onClick={onEnter}>
          进入智能助手 →
        </button>
        <p className="landing-footer-note">
          技术栈：React · TypeScript · Vite · DeepSeek Function Calling · 自实现 BM25 RAG
        </p>
      </section>
    </div>
  );
}

export default LandingPage;
