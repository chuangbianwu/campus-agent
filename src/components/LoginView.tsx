/**
 * 登录页（角色选择）
 *
 * Mock 登录：不做真实鉴权，选择身份即进入对应视图。
 * 差异化不止于皮肤——角色会随请求传给后端：
 * 系统提示词、可用工具集、执行层权限拦截，三处都不同。
 *
 * 演示动线：先用学生身份问课表/请假 → 切换辅导员身份 →
 * 问"有哪些请假待审批" → 学生身份再问一次，展示权限拦截。
 */

export type RoleKey = 'student' | 'counselor';

export const ROLE_INFO: Record<RoleKey, { name: string; title: string; desc: string }> = {
  student: {
    name: '曹博文',
    title: '学生 · 软件工程 大二',
    desc: '查课表、问制度、找自习教室、生成请假表',
  },
  counselor: {
    name: '李老师',
    title: '辅导员 · 软件工程专业',
    desc: '审批请假申请、查制度、看学生课表',
  },
};

function LoginView({ onSelect }: { onSelect: (role: RoleKey) => void }) {
  return (
    <div className="login">
      <div className="login-inner">
        <div className="hero-logo">勤</div>
        <div className="login-title">校园百事通</div>
        <div className="login-sub">校园智能办事 Agent · 请选择你的身份</div>

        <div className="login-cards">
          {(Object.keys(ROLE_INFO) as RoleKey[]).map((key) => {
            const r = ROLE_INFO[key];
            return (
              <button key={key} className="login-card" onClick={() => onSelect(key)}>
                <div className="login-card-avatar">{r.name[0]}</div>
                <div className="login-card-name">{r.name}</div>
                <div className="login-card-title">{r.title}</div>
                <div className="login-card-desc">{r.desc}</div>
                <div className="login-card-enter">进入 →</div>
              </button>
            );
          })}
        </div>

        <div className="login-note">
          演示环境 · Mock 登录（不校验密码）· 不同角色对应不同的 Agent 工具集与权限
        </div>
      </div>
    </div>
  );
}

export default LoginView;
