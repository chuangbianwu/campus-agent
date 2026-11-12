/**
 * 课程卡片组件（生成式 UI）
 *
 * Agent 调用工具拿到结构化数据后，由前端直接渲染成卡片——
 * 数据 100% 准确、样式统一、省 token。
 * 视觉上是全场唯一的"重"元素：琥珀微光 + 分层阴影（设计系统的焦点位）。
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

function CourseCard({ data }: { data: CourseCardData }) {
  return (
    <div className="course-card">
      <div className="course-card-header">
        <span>{data.day}课表</span>
        <span className="course-card-count">{data.courses.length} 门课</span>
      </div>
      <div className="course-card-body">
        {data.courses.map((c, i) => (
          <div key={i} className="course-item">
            <div className="course-time">
              {c.time.split('-').map((t, j) => (
                <span key={j}>{t}<br /></span>
              ))}
            </div>
            <div className="course-info">
              <div className="course-name-row">
                <span className="course-name">{c.course}</span>
                <span className={`course-type-badge ${c.type === '必修' ? 'req' : ''}`}>
                  {c.type}
                </span>
              </div>
              <div className="course-meta">{c.teacher} · {c.room}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CourseCard;
