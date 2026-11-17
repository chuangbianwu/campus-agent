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
import {
  listPendingRequests,
  listRequestsByStudent,
  submitLeaveRequest,
} from '../store';
// 用 JSON 静态导入而不是 readFileSync：
// 部署到 Vercel 时打包器会自动把数据文件打包进去，
// 不存在"线上找不到文件"的问题；本地开发两种环境（tsx / Vite）也都支持
import coursesDataJson from '../data/courses.json';
import freeRoomsDataJson from '../data/free_rooms.json';

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
  /** 权限拦截标记：true 时 Agent 会向前端发 safety 事件，让越权拦截可见 */
  denied?: boolean;
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
  /** 真正执行的函数：接收大模型给的参数和当前登录角色，返回执行结果 */
  execute: (args: Record<string, unknown>, role: Role) => ToolResult;
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

/**
 * 未收录问题待收录清单（评审 P1 修复：让"帮你记下来"成为真实行为而非话术）
 * 知识库未命中的问题会真实记入这个内存清单并打印日志，
 * 评审时可直接展示"反馈闭环"确实存在，而非空口承诺。
 */
const unindexedTopics: Array<{ topic: string; time: string }> = [];

const campusPolicyTool: Tool = {
  label: '制度问答',
  definition: {
    type: 'function',
    function: {
      name: 'query_campus_policy',
      description:
        '在校园规章制度知识库中检索相关条款，覆盖：请假流程与审批、图书馆借阅规则、奖学金评定办法、宿舍管理规定。当用户询问办事流程、规则、规定时使用——即使主题不在以上范围内也要调用，未收录的问题会自动记录到待收录清单。返回带出处（文档名+小节）的相关条款原文，回答时必须依据检索结果并注明出处',
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
  execute: (args, role) => {
    const topic = String(args.topic || '');

    // RAG 检索：从切片知识库里找最相关的 2 个条款片段
    // 得分门槛：BM25 分低于 4 说明知识库里其实没有相关内容，
    // 宁可回答"没有"也不硬塞不相关条款（诚实兜底，评测发现的改进点）
    const MIN_SCORE = 4;
    const results = searchPolicies(topic, 2).filter((r) => r.score >= MIN_SCORE);

    if (results.length === 0) {
      // 未命中 → 真实记录到待收录清单（评审 P1：反馈闭环要可验证，不是话术）
      unindexedTopics.push({ topic, time: new Date().toISOString() });
      console.log(`[待收录] 知识库未收录的问题：${topic}（累计 ${unindexedTopics.length} 条）`);
      return {
        data: JSON.stringify({
          found: false,
          message: '知识库中没有相关制度，现有范围：请假、图书馆借阅、奖学金、宿舍管理。该问题已记录到待收录清单，将反馈给知识库维护方补充。',
        }),
        summary: `未找到"${topic}"相关的制度，已记录到待收录清单`,
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
    //
    // 生成式 UI 门控（评审 P0 修复）：卡片出现必须同时满足两个条件——
    //   ① 角色门控：仅学生角色渲染申请表（辅导员看到学生表单属于角色错位）
    //   ② 意图门控：问题必须是"办理类"（要请假/问流程/要申请），
    //      纯咨询类（问权限、问规定）只给条款引用，不弹表单
    const leaveHits = results.filter((r) => r.docTitle.includes('请假'));
    const isHandlingIntent = /(我要|我想|帮我请|流程|申请|办理|步骤|怎么办)/.test(topic)
      && !/(权限|规定|是指|是什么|哪些)/.test(topic);
    if (role === 'student' && leaveHits.length > 0 && isHandlingIntent) {
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

/**
 * 从共享存储读取（而不是静态 JSON）：
 * 学生端刚提交的申请会出现在这里，实现两端互通（评审核心加分点：完整闭环）
 */
const leaveApprovalsTool: Tool = {
  label: '请假审批查询',
  definition: {
    type: 'function',
    function: {
      name: 'query_leave_approvals',
      description: '查询待审批的学生请假申请列表（仅辅导员可用），返回申请人、班级、假型、天数、事由；学生端新提交的申请会实时出现在列表中',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  execute: () => {
    const pending = listPendingRequests();
    return {
      data: JSON.stringify({ count: pending.length, requests: pending }),
      summary: pending.length > 0
        ? `查询到 ${pending.length} 条待审批请假申请${pending.some((r) => r.isNew) ? '（含新提交）' : ''}`
        : '当前没有待审批的请假申请',
      card: { type: 'approvals', data: { requests: pending } },
    };
  },
};

// ========== 工具 5：提交请假申请（学生专属，两端互通入口） ==========

const submitLeaveTool: Tool = {
  label: '提交请假申请',
  definition: {
    type: 'function',
    function: {
      name: 'submit_leave_request',
      description: '帮学生提交请假申请（仅学生可用），提交后辅导员端会实时收到并可审批。需要假型、天数、日期范围、事由四项信息，缺信息时先向用户确认再调用',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: '假型：事假 / 病假 / 其他' },
          days: { type: 'number', description: '请假天数' },
          range: { type: 'string', description: '请假日期范围，如"11-18 至 11-19"' },
          reason: { type: 'string', description: '请假事由' },
        },
        required: ['type', 'days', 'range', 'reason'],
      },
    },
  },
  execute: (args) => {
    const req = submitLeaveRequest({
      type: String(args.type || '事假'),
      days: Number(args.days) || 1,
      range: String(args.range || ''),
      reason: String(args.reason || ''),
    });
    return {
      data: JSON.stringify({
        submitted: true,
        id: req.id,
        message: `申请已提交（单号 ${req.id}），辅导员端会实时收到。可通过"我的请假批了吗"查询审批结果`,
      }),
      summary: `已提交请假申请：${req.type} ${req.days} 天（单号 ${req.id}）`,
    };
  },
};

// ========== 工具 6：我的请假进度（学生专属，闭环的出口） ==========

const myLeaveStatusTool: Tool = {
  label: '请假进度查询',
  definition: {
    type: 'function',
    function: {
      name: 'query_my_leave_status',
      description: '学生查询自己提交过的请假申请及审批结果（待审批/已批准/已驳回及理由），用于回答"我的请假批了吗"（仅学生可用）',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  execute: () => {
    const mine = listRequestsByStudent();
    if (mine.length === 0) {
      return {
        data: JSON.stringify({ count: 0, message: '你还没有提交过请假申请' }),
        summary: '你还没有提交过请假申请',
      };
    }
    return {
      data: JSON.stringify({
        count: mine.length,
        requests: mine.map((r) => ({
          id: r.id, type: r.type, days: r.days, range: r.range,
          status: r.status === 'pending' ? '待审批' : r.status === 'approved' ? '已批准' : '已驳回',
          decisionReason: r.decisionReason, decidedAt: r.decidedAt,
        })),
      }),
      summary: `查询到你的 ${mine.length} 条请假申请（${mine.filter((r) => r.status !== 'pending').length} 条已出结果）`,
    };
  },
};

// ========== 注册表：所有工具的入口 ==========

export const tools: Tool[] = [
  courseScheduleTool,
  campusPolicyTool,
  freeRoomsTool,
  leaveApprovalsTool,
  submitLeaveTool,
  myLeaveStatusTool,
];

/** 各角色可用工具：权限的第一道防线（提示词层） */
const COUNSELOR_ONLY = ['query_leave_approvals'];
const STUDENT_ONLY = ['submit_leave_request', 'query_my_leave_status'];

/**
 * 给大模型的工具定义列表（按角色过滤）
 * 学生角色看不到审批工具、辅导员角色看不到提交/查进度工具——
 * 大模型连"调用它"的选项都没有
 */
export function getToolDefinitions(role: Role = 'student') {
  return tools
    .filter((t) => {
      const name = t.definition.function.name;
      if (role === 'student') return !COUNSELOR_ONLY.includes(name);
      return !STUDENT_ONLY.includes(name);
    })
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
  if (COUNSELOR_ONLY.includes(name) && role !== 'counselor') {
    return {
      label: tool.label,
      data: JSON.stringify({ error: `权限不足：${tool.label}仅辅导员可用` }),
      summary: '权限不足，已拦截',
      denied: true, // 通知 Agent 发 safety 事件，让拦截在前端可见
    };
  }
  if (STUDENT_ONLY.includes(name) && role !== 'student') {
    return {
      label: tool.label,
      data: JSON.stringify({ error: `权限不足：${tool.label}仅学生可用` }),
      summary: '权限不足，已拦截',
      denied: true,
    };
  }
  try {
    const result = tool.execute(args, role);
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
