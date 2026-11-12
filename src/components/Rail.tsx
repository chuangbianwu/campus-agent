/**
 * 左侧导航栏
 *
 * 点击菜单切换右侧的快捷提示词（指令 3）：
 *   智能助手   → 通用问题
 *   课表查询   → "今天有课吗"等
 *   制度知识库 → "怎么请假"等
 *   关于作品   → 项目介绍 + 技术亮点
 */

export type NavKey = 'assistant' | 'schedule' | 'knowledge' | 'about';

const NAV_ITEMS: Array<{ key: NavKey; label: string; count?: number }> = [
  { key: 'assistant', label: '智能助手' },
  { key: 'schedule', label: '课表查询' },
  { key: 'knowledge', label: '制度知识库', count: 19 },
  { key: 'about', label: '关于作品' },
];

/** 每个栏目对应的快捷提示词 */
export const QUICK_PROMPTS: Record<NavKey, string[]> = {
  assistant: ['明天下午没课的话，去哪自习？', '我周二有什么课？', '请假需要什么流程？', '奖学金怎么评？'],
  schedule: ['今天有课吗？', '明天有什么课？', '周五下午有课吗？', '没课时去哪自习？'],
  knowledge: ['怎么请假？', '借书逾期怎么收费？', '奖学金加分项有哪些？', '宿舍晚上几点关门？'],
  about: [],
};

/** 每个栏目的对话区标题 */
export const NAV_TITLES: Record<NavKey, { title: string; note: string }> = {
  assistant: { title: '智能助手', note: '调度 Agent · 工具调用 · RAG 检索' },
  schedule: { title: '课表查询', note: '问"今天/明天/周几"都可以' },
  knowledge: { title: '制度知识库', note: '回答附条款级引用出处' },
  about: { title: '关于作品', note: '' },
};

function Rail({ active, onChange }: { active: NavKey; onChange: (k: NavKey) => void }) {
  return (
    <aside className="panel rail">
      <div className="brand">
        <div className="brand-mark">勤</div>
        <div>
          <div className="brand-name">校园百事通</div>
          <div className="brand-sub">智能办事助手</div>
        </div>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${active === item.key ? 'active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            {item.label}
            {item.count !== undefined && <span className="nav-count">{item.count}</span>}
          </button>
        ))}
      </nav>

      <div className="rail-foot">
        <div><span className="live-dot" />DeepSeek 已连接</div>
        <div className="tech-badges">
          <span className="tech-badge lit">DeepSeek Function Calling</span>
          <span className="tech-badge">自实现 BM25 RAG 检索</span>
          <span className="tech-badge">Agent 工具调度</span>
        </div>
      </div>
    </aside>
  );
}

export default Rail;
