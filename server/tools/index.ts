/**
 * 工具注册中心（Tool Registry）
 *
 * 作用：统一管理 Agent 可以调用的所有工具。
 * 每个工具包含两部分：
 *   1. definition —— 给大模型看的"使用说明书"（OpenAI Function Calling 格式）
 *   2. execute    —— 真正干活的函数，大模型说要调用时，由后端执行它
 *
 * 新增工具的步骤（以后扩展时照做）：
 *   1. 在 tools 数组里加一个对象，写好 definition 和 execute
 *   2. 搞定！调度 Agent 会自动发现它
 */

import { searchPolicies } from '../rag/index';
// 用 JSON 静态导入而不是 readFileSync：
// 部署到 Vercel 时打包器会自动把数据文件打包进去，
// 不存在"线上找不到文件"的问题；本地开发两种环境（tsx / Vite）也都支持
import coursesDataJson from '../data/courses.json';
import freeRoomsDataJson from '../data/free_rooms.json';
import leaveRequestsJson from '../data/leave_requests.json';

// 制度文档不再整篇加载到工具里，改由 server/rag 模块切片建索引后按需检索

/** 课表数据结构（JSON 导入默认是字面量类型，断言成可索引的结构） */
interface CourseItem {
  time: string;
  course: string;
  teacher: string;
  room: string;
  type: string;
}
const coursesData = coursesDataJson as {
  student: string;
  major: string;
  grade: string;
  semester: string;
  schedule: Record<string, CourseItem[]>;
};

// ========== 类型定义 ==========

/** 用户角色：学生 / 辅导员（登录页选择，随请求体传给后端） */
export type Role = 'student' | 'counselor';

/** 工具执行结果 */
export interface ToolResult {
  /** 给大模型看的数据（JSON 字符串会放进对话历史） */
  data: string;
  /** 给前端用户看的简短摘要（用于"思考过程可视化"） */
  summary: string;
  /**
   * 可选：给前端渲染的结构化卡片数据（生成式 UI）
   * 大模型负责组织文字，卡片由前端组件渲染——
   * 数据准确、样式统一，还不会浪费 token 让大模型画表格
   */
  card?: {
    type: 'courses' | 'free_rooms' | 'leave_form' | 'approvals'; // 卡片类型，前端按类型选组件
    data: unknown;
  };
  /**
   * 可选：RAG 引用溯源数据（来源引用 UI）
   * 前端在气泡底部渲染"来源"Tag，点击弹出右侧抽屉显示原文
   */
  citations?: Array<{
    title: string;   // 来源文档名
    section: string; // 小节
    text: string;    // 条款原文
  }>;
}

/** 工具对象的结构 */
export interface Tool {
  /** OpenAI Function Calling 格式的工具定义 */
  definition: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
      };
    };
  };
  /** 工具的中文名，用于界面展示 */
  label: string;
  /** 真正执行的函数：接收大模型给的参数，返回执行结果 */
  execute: (args: Record<string, unknown>) => ToolResult;
}

// ========== 工具 1：课表查询 ==========

/**
 * 把"今天/明天"这类相对说法转换成星期几
 */
function resolveDay(day: string): string {
  if (day === '今天' || day === '明天' || day === '后天') {
    const offset = day === '今天' ? 0 : day === '明天' ? 1 : 2;
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekDays[date.getDay()];
  }
  return day;
}

const courseScheduleTool: Tool = {
  label: '课表查询',
  definition: {
    type: 'function',
    function: {
      name: 'get_course_schedule',
      // description 是大模型判断"该不该用这个工具"的唯一依据，要写清楚
      description: '查询学生的课程表，可以查询某一天（如"周一""周二"）或"今天""明天"的课程安排',
      parameters: {
        type: 'object',
        properties: {
          day: {
            type: 'string',
            description: '要查询的日期，如"周一"~"周五"，或"今天""明天""后天"',
          },
        },
        required: ['day'],
      },
    },
  },
  execute: (args) => {
    const day = resolveDay(String(args.day || ''));
    const courses = coursesData.schedule[day];

    if (!courses || courses.length === 0) {
      return {
        data: JSON.stringify({ day, courses: [], message: `${day}没有课` }),
        summary: `查询了${day}的课表：没有课`,
      };
    }

    return {
      data: JSON.stringify({
        day,
        student: coursesData.student,
        major: coursesData.major,
        courses,
      }),
      summary: `查询了${day}的课表：共 ${courses.length} 门课`,
      // 结构化卡片：前端收到后渲染成课程卡片（生成式 UI）
      card: { type: 'courses', data: { day, courses } },
    };
  },
};

// ========== 工具 2：校园制度问答（RAG 版）==========

const campusPolicyTool: Tool = {
  label: '制度问答',
  definition: {
    type: 'function',
    function: {
      name: 'query_campus_policy',
      description:
        '在校园规章制度知识库中检索相关条款，覆盖：请假流程与审批、图书馆借阅规则、奖学金评定办法、宿舍管理规定。当用户询问办事流程、规则、规定时使用。返回带出处（文档名+小节）的相关条款原文，回答时必须依据检索结果并注明出处',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: '用户的原始问题或主题，如"请假三天找谁批""借书逾期怎么收费"',
          },
        },
        required: ['topic'],
      },
    },
  },
  execute: (args) => {
    const topic = String(args.topic || '');

    // RAG 检索：从切片知识库里找最相关的 2 个条款片段
    const results = searchPolicies(topic, 2);

    if (results.length === 0) {
      return {
        data: JSON.stringify({
          found: false,
          message: '知识库中没有相关制度，现有范围：请假、图书馆借阅、奖学金、宿舍管理',
        }),
        summary: `未找到"${topic}"相关的制度`,
      };
    }

    // 给大模型的数据：相关条款 + 明确出处，方便它组织带引用的回答
    const payload: ToolResult = {
      data: JSON.stringify({
        found: true,
        passages: results.map((r) => ({
          source: `《${r.docTitle}》${r.section}`,
          content: r.text,
        })),
        instruction: '请依据以上条款回答，并在回答中注明出处（书名+小节）',
      }),
      // 给前端的摘要：展示检索到了哪些出处（引用溯源可视化）
      summary: `检索到 ${results.length} 条相关条款：${results.map((r) => `《${r.docTitle}》`).join('、')}`,
      // 引用原文：前端"来源"Tag + 抽屉展示用
      citations: results.map((r) => ({
        title: r.docTitle,
        section: r.section,
        text: r.text,
      })),
    };

    // 命中请假制度 → 附带"请假申请表"卡片，前端可一键生成预填的 .docx（对话即办事）
    const leaveHits = results.filter((r) => r.docTitle.includes('请假'));
    if (leaveHits.length > 0) {
      payload.card = {
        type: 'leave_form',
        data: {
          student: coursesData.student,
          major: coursesData.major,
          grade: coursesData.grade,
          basis: leaveHits.map((r) => `《${r.docTitle}》${r.section}`).join('；'),
          rules: leaveHits.map((r) => r.text),
        },
      };
    }

    return payload;
  },
};

// ========== 工具 3：空闲教室查询 ==========

interface FreeRoom {
  id: string;
  building: string;
  room: string;
  capacity: number;
  facilities: string[];
  free: Record<string, string[]>;
}
const freeRoomsData = freeRoomsDataJson as { note: string; rooms: FreeRoom[] };

const freeRoomsTool: Tool = {
  label: '空闲教室查询',
  definition: {
    type: 'function',
    function: {
      name: 'query_free_rooms',
      // 典型触发："明天下午没课，去哪自习？"——大模型会先查课表再调这个工具（多轮工具链）
      description: '查询某一天某个时段的空闲教室/自习场所，可用来回答"没课的时候能去哪自习"。支持按时段（上午/下午/晚上）筛选',
      parameters: {
        type: 'object',
        properties: {
          day: {
            type: 'string',
            description: '要查询的日期，如"周一"~"周五"，或"今天""明天""后天"',
          },
          period: {
            type: 'string',
            description: '可选，时段筛选："上午"、"下午"或"晚上"；不传则返回全天有空闲的场所',
          },
        },
        required: ['day'],
      },
    },
  },
  execute: (args) => {
    const day = resolveDay(String(args.day || ''));
    const period = args.period ? String(args.period) : '';

    if (day === '周六' || day === '周日') {
      return {
        data: JSON.stringify({ day, rooms: [], message: `${day}是周末，教室全部开放，不需要查询` }),
        summary: `${day}是周末，教室全开放`,
      };
    }

    // 筛选：该天有空闲，且（若指定时段）该时段空闲
    const matched = freeRoomsData.rooms
      .map((r) => {
        const freePeriods = r.free[day] ?? [];
        const hit = period ? freePeriods.includes(period) : freePeriods.length > 0;
        return { room: r, freePeriods, hit };
      })
      .filter((x) => x.hit)
      // 容量大的排前面，自习体验更好
      .sort((a, b) => b.room.capacity - a.room.capacity);

    if (matched.length === 0) {
      return {
        data: JSON.stringify({ day, period, rooms: [], message: `${day}${period || '全天'}没有空闲教室` }),
        summary: `${day}${period}没有查到空闲教室`,
      };
    }

    const rooms = matched.map(({ room, freePeriods }) => ({
      building: room.building,
      room: room.room,
      capacity: room.capacity,
      facilities: room.facilities,
      freePeriods,
    }));

    return {
      data: JSON.stringify({ day, period: period || '全天', rooms }),
      summary: `查询了${day}${period || '全天'}的空闲教室：共 ${rooms.length} 处`,
      // 结构化卡片：前端渲染空闲教室列表
      card: { type: 'free_rooms', data: { day, period: period || '全天', rooms } },
    };
  },
};

// ========== 工具 4：待审批请假列表（辅导员专属） ==========

interface LeaveRequest {
  id: string;
  student: string;
  className: string;
  type: string;
  days: number;
  range: string;
  reason: string;
  submitted: string;
}
const leaveRequests = (leaveRequestsJson as { requests: LeaveRequest[] }).requests;

const leaveApprovalsTool: Tool = {
  label: '请假审批查询',
  definition: {
    type: 'function',
    function: {
      name: 'query_leave_approvals',
      description: '查询待审批的学生请假申请列表（仅辅导员可用），返回申请人、班级、假型、天数、事由',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  execute: () => {
    return {
      data: JSON.stringify({ count: leaveRequests.length, requests: leaveRequests }),
      summary: `查询到 ${leaveRequests.length} 条待审批请假申请`,
      card: { type: 'approvals', data: { requests: leaveRequests } },
    };
  },
};

// ========== 注册表：所有工具的入口 ==========

export const tools: Tool[] = [courseScheduleTool, campusPolicyTool, freeRoomsTool, leaveApprovalsTool];

/**
 * 给大模型的工具定义列表（按角色过滤）
 * 学生角色看不到审批工具——大模型连"调用它"的选项都没有，
 * 这是第一道权限防线（提示词层）
 */
export function getToolDefinitions(role: Role = 'student') {
  return tools
    .filter((t) => role === 'counselor' || t.definition.function.name !== 'query_leave_approvals')
    .map((t) => t.definition);
}

/**
 * 按名字找到工具并执行
 * 找不到时返回错误信息，不让程序崩掉（错误兜底，评分点之一）
 * 角色权限在这里做第二道防线（执行层）：即使提示词被绕过，
 * 学生角色执行审批工具也会被直接拦截
 */
export function executeTool(name: string, args: Record<string, unknown>, role: Role = 'student'): ToolResult & { label: string } {
  const tool = tools.find((t) => t.definition.function.name === name);
  if (!tool) {
    return {
      label: name,
      data: JSON.stringify({ error: `工具 ${name} 不存在` }),
      summary: `工具 ${name} 不存在`,
    };
  }
  if (name === 'query_leave_approvals' && role !== 'counselor') {
    return {
      label: tool.label,
      data: JSON.stringify({ error: '权限不足：请假审批查询仅辅导员可用' }),
      summary: '权限不足，已拦截',
    };
  }
  try {
    const result = tool.execute(args);
    return { label: tool.label, ...result };
  } catch (error) {
    // 工具执行出错也不能让对话中断，把错误告诉大模型，让它跟用户解释
    return {
      label: tool.label,
      data: JSON.stringify({ error: `工具执行失败: ${String(error)}` }),
      summary: `${tool.label}执行失败`,
    };
  }
}
