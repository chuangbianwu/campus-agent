/**
 * 课程卡片组件（生成式 UI）
 *
 * 什么是"生成式 UI"？
 * Agent 调用工具拿到结构化数据后，不让大模型用文字描述，
 * 而是由前端直接渲染成卡片组件——
 * 数据 100% 准确（大模型不会抄错数字）、样式统一、还省 token。
 * 这是比赛"创新性"维度的亮点：对话即办事，结果即界面。
 */

// 一节课的数据结构（与 server/data/courses.json 对应）
export interface Course {
  time: string;    // 上课时间段，如 "08:00-09:40"
  course: string;  // 课程名
  teacher: string; // 任课教师
  room: string;    // 教室
  type: string;    // 课程性质：必修 / 专业选修 / 实验课
}

export interface CourseCardData {
  day: string;       // 星期几
  courses: Course[]; // 当天课程列表
}

/** 课程性质对应的徽章颜色 */
const TYPE_COLORS: Record<string, string> = {
  必修: '#667eea',
  专业选修: '#f59e0b',
  实验课: '#10b981',
};

function CourseCard({ data }: { data: CourseCardData }) {
  return (
    <div className="course-card">
      {/* 卡片头部：星期 + 课程数 */}
      <div className="course-card-header">
        <span className="course-card-day">📅 {data.day}</span>
        <span className="course-card-count">{data.courses.length} 门课</span>
      </div>

      {/* 课程列表 */}
      <div className="course-card-body">
        {data.courses.map((c, i) => (
          <div key={i} className="course-item">
            {/* 左侧：时间段 */}
            <div className="course-time">
              {c.time.split('-').map((t, j) => (
                <span key={j}>{t}</span>
              ))}
            </div>

            {/* 右侧：课程信息 */}
            <div className="course-info">
              <div className="course-name-row">
                <span className="course-name">{c.course}</span>
                <span
                  className="course-type-badge"
                  style={{ background: TYPE_COLORS[c.type] || '#999' }}
                >
                  {c.type}
                </span>
              </div>
              <div className="course-meta">
                👤 {c.teacher}　📍 {c.room}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CourseCard;
