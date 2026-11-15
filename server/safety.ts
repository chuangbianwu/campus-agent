/**
 * AI 安全护栏（输入侧）
 *
 * 为什么需要它？——比赛评分表里的"AI 安全"考察三点：
 *   1. 提示词注入防护：用户假装"系统"给 AI 下新指令（套提示词、改人设）
 *   2. 敏感内容过滤：政治/暴力/色情等话题不接招
 *   3. 越权防护：助手只做校园事务，不被当成通用工具滥用
 *
 * 设计原则：命中规则 → 直接礼貌拒绝，不调用大模型
 * （响应更快、不花 API 费用、行为 100% 可控可演示）
 *
 * 注意：这是基础版规则护栏。工业界会再加一层"安全审核模型"，
 * 但规则层永远是第一道防线——架构答辩时这一点要讲清楚。
 */

export interface SafetyCheckResult {
  safe: boolean;
  /** 命中时的固定回复（礼貌拒绝 + 引导回正题） */
  reply?: string;
  /** 命中的规则名，用于日志和答辩演示 */
  rule?: string;
}

/**
 * 提示词注入特征（正则）
 * 覆盖最常见的注入话术：覆盖指令、套取提示词、篡改身份
 */
const INJECTION_PATTERNS: RegExp[] = [
  /忽略(你?之前|上述|以上|所有|先前)的?(指令|指示|命令|设定|提示)/i,
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/i,
  /(告诉|显示|输出|打印|重复|泄露)(我|给)?(你的)?(系统提示词|系统设定|system\s*prompt)/i,
  /你现在是|扮演一个|假装你是|变成.*(没有限制|不受约束)/i,
  /\bDAN\b|jailbreak|越狱/i,
  /\[system\]|<\|?(system|im_start)/i,
];

/**
 * 敏感话题关键词（基础示例清单，实际项目可接入词库服务）
 */
const SENSITIVE_KEYWORDS: string[] = [
  '炸弹', '炸药', '枪支', '毒品', '自杀', '自残',
  '色情', '赌博',
];

/**
 * 违规行为请求特征（正则）
 * 注意只拦"教人做坏事"的问法，不拦正常求助：
 *   拦："怎么用违规电器不被发现"、"帮我写骂老师的信"
 *   放行："宿舍能用吹风机吗"（正常咨询）、"老师骂我怎么办"（求助）
 */
const HARMFUL_PATTERNS: RegExp[] = [
  /不被(发现|察觉|抓到)/,                          // 逃避发现的问法
  /(绕过|逃避|躲开).{0,4}(检查|管理|监控|审批)/,     // 规避监管
  /(写|编|生成).{0,10}(骂|侮辱|诋毁)/,              // 代写攻击性内容
];

const REPLIES = {
  injection:
    '我注意到这个消息里包含试图修改我工作方式的内容，这个我不能执行哦。我是校园办事助手，课表查询、请假流程、制度咨询这些都可以帮你～',
  sensitive:
    '这个话题超出了我作为校园办事助手的服务范围，不方便讨论。如果你有课表、请假、图书馆、奖学金方面的问题，我很乐意帮忙！',
  harmful:
    '这个忙我帮不了——违反校规或伤害他人的事我不能提供方法。如果是正常的制度咨询（比如电器使用规定），可以换个问法问我～',
};

/**
 * 检查用户输入是否安全
 * @param text 用户最新消息
 */
export function checkInput(text: string): SafetyCheckResult {
  const normalized = text.trim();

  // 第一关：提示词注入
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return { safe: false, reply: REPLIES.injection, rule: 'prompt-injection' };
    }
  }

  // 第二关：敏感话题
  for (const word of SENSITIVE_KEYWORDS) {
    if (normalized.includes(word)) {
      return { safe: false, reply: REPLIES.sensitive, rule: 'sensitive-topic' };
    }
  }

  // 第三关：违规行为请求
  for (const pattern of HARMFUL_PATTERNS) {
    if (pattern.test(normalized)) {
      return { safe: false, reply: REPLIES.harmful, rule: 'harmful-behavior' };
    }
  }

  return { safe: true };
}
