/**
 * RAG 第二步：BM25 检索引擎
 *
 * BM25 是搜索引擎用了几十年的经典排序算法（Elasticsearch 的默认算法），
 * 核心思想一句话：一个切片里命中的查询词越多、这些词在全体文档里越稀有，得分越高。
 *
 * 为什么用它而不是向量检索（Embedding）？
 * - 零依赖、零 API 费用、毫秒级响应，制度文档这种小规模知识库完全够用
 * - 中文向量模型需要额外接入（硅基流动/智谱），架构上本模块可随时替换：
 *   只要同样实现 search(query, k) 返回带分数的切片即可
 *
 * 中文分词怎么做？—— 二元组（bigram）：
 * "请假流程" → ["请假", "假流", "流程"]
 * 不需要安装任何分词库，对中文检索效果已经不错，是工业界常用的保底方案。
 */

/**
 * 中文二元组分词
 * - 连续的中文/英文/数字切成二元组
 * - 英文单词整体保留
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // 把文本按"中文块"和"英文数字块"分开处理
  const segments = text.toLowerCase().match(/[一-龥]+|[a-z0-9]+/g) || [];

  for (const seg of segments) {
    if (/[一-龥]/.test(seg)) {
      // 中文：单字 + 相邻两字的组合（单字保证单字查询也能命中）
      for (let i = 0; i < seg.length; i++) {
        tokens.push(seg[i]);
        if (i < seg.length - 1) tokens.push(seg.slice(i, i + 2));
      }
    } else {
      // 英文/数字：整个词作为一个 token
      tokens.push(seg);
    }
  }
  return tokens;
}

/** 被索引的文档（切片）需要满足的最小结构 */
export interface BM25Doc {
  id: string;
  text: string;
}

/**
 * BM25 检索器
 * 用法：const bm25 = new BM25(chunks);  bm25.search("逾期费用", 3)
 */
export class BM25<T extends BM25Doc> {
  // BM25 的两个经典参数（经验值，不用改）
  private readonly k1 = 1.5;  // 词频饱和度：同一个词出现再多次，加分会递减
  private readonly b = 0.75;  // 长度归一化：长文档天然词多，要压一压

  private docs: T[] = [];
  private docTokens: string[][] = [];       // 每篇文档的 token 列表
  private docFreq = new Map<string, number>(); // 每个 token 出现在多少篇文档里
  private avgLen = 0;                        // 平均文档长度

  /** 建索引：一次性把所有切片喂进来 */
  constructor(docs: T[]) {
    this.docs = docs;
    this.docTokens = docs.map((d) => tokenize(d.text));

    // 统计文档频率（df）：每个 token 出现在几篇文档中
    for (const tokens of this.docTokens) {
      const unique = new Set(tokens);
      for (const token of unique) {
        this.docFreq.set(token, (this.docFreq.get(token) || 0) + 1);
      }
    }

    // 平均文档长度
    const totalLen = this.docTokens.reduce((sum, t) => sum + t.length, 0);
    this.avgLen = docs.length > 0 ? totalLen / docs.length : 1;
  }

  /**
   * 检索：返回得分最高的前 k 篇
   */
  search(query: string, k = 3): Array<{ doc: T; score: number }> {
    const queryTokens = tokenize(query);
    const N = this.docs.length;
    const results: Array<{ doc: T; score: number }> = [];

    for (let i = 0; i < N; i++) {
      const tokens = this.docTokens[i];
      const docLen = tokens.length;
      let score = 0;

      for (const qt of queryTokens) {
        const df = this.docFreq.get(qt) || 0;
        if (df === 0) continue; // 查询词在整个知识库里不存在，跳过

        // IDF：词越稀有，权重越高（log 平滑）
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

        // TF：词在本文档出现的次数
        const tf = tokens.filter((t) => t === qt).length;
        if (tf === 0) continue;

        // BM25 核心公式
        const tfNorm = (tf * (this.k1 + 1)) / (tf + this.k1 * (1 - this.b + (this.b * docLen) / this.avgLen));
        score += idf * tfNorm;
      }

      if (score > 0) {
        results.push({ doc: this.docs[i], score });
      }
    }

    // 按得分从高到低排序，取前 k 个
    return results.sort((a, b) => b.score - a.score).slice(0, k);
  }
}
