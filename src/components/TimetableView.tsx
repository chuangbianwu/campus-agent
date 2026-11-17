/**
 * 完整周课表视图（"我的课表"导航页）
 *
 * 与对话里的"课表查询"互补：对话回答某一天的问题，
 * 这个页面一眼看全一周——评委常问的"有没有完整产品形态"就靠它。
 *
 * 数据直接来自 server/data/courses.json（与 Agent 工具同源），
 * 今天所在列高亮，空时段显示为留白。
 */

import coursesDataJson from '../../server/data/courses.json';
import { Fragment } from 'react';
import type { Course } from './CourseCard';
import type { RoleKey } from './LoginView';
import { ROLE_INFO } from './LoginView';

const data = coursesDataJson as {
  student: string;
  major: string;
  grade: string;
  semester: string;
  schedule: Record<string, Course[]>;
};

const DAYS = ['周一', '周二', '周三', '周四', '周五'];

/** 所有出现过的时段（去重后按开始时间排序），作为表格的行 */
const TIME_SLOTS = Array.from(
  new Set(DAYS.flatMap((d) => (data.schedule[d] ?? []).map((c) => c.time)))
).sort();

/** 课程类型 → 配色（与设计系统一致：必修=灯光琥珀，选修=冷蓝，实验=绿） */
const TYPE_CLASS: Record<string, string> = {
  必修: 'req',
  专业选修: 'ele',
  实验课: 'lab',
};

function TimetableView({ role }: { role: RoleKey }) {
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const today = weekDays[new Date().getDay()];
  const me = ROLE_INFO[role];
  const totalCourses = DAYS.reduce((n, d) => n + (data.schedule[d] ?? []).length, 0);

  return (
    <div className="tt-view">
      <div className="tt-head">
        <div>
          <div className="tt-title">{me.name}的课表</div>
          <div className="tt-sub">{data.semester} · {data.major} {data.grade} · 本周 {totalCourses} 门课</div>
        </div>
        <div className="tt-legend">
          <span className="tt-chip req">必修</span>
          <span className="tt-chip ele">专业选修</span>
          <span className="tt-chip lab">实验课</span>
        </div>
      </div>

      <div className="tt-grid">
        <div className="tt-corner" />
        {DAYS.map((d) => (
          <div key={d} className={`tt-dayhead ${d === today ? 'today' : ''}`}>
            {d}
            {d === today && <span className="tt-today-dot">今天</span>}
          </div>
        ))}

        {TIME_SLOTS.map((slot) => (
          <Fragment key={slot}>
            <div className="tt-time">{slot}</div>
            {DAYS.map((d) => {
              const c = (data.schedule[d] ?? []).find((x) => x.time === slot);
              return (
                <div key={`${d}-${slot}`} className={`tt-cell ${d === today ? 'today' : ''}`}>
                  {c ? (
                    <div className={`tt-course ${TYPE_CLASS[c.type] ?? 'req'}`}>
                      <div className="tt-course-name">{c.course}</div>
                      <div className="tt-course-meta">{c.room}</div>
                      <div className="tt-course-meta">{c.teacher}</div>
                    </div>
                  ) : (
                    <div className="tt-free">—</div>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export default TimetableView;
