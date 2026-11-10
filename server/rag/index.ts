/**
 * RAG 检索入口：把"切片 + 检索引擎"组装成知识库
 *
 * 完整 RAG 流程回顾：
 *   文档 → 切片(chunker) → 建索引(BM25) → 检索(searchPolicies)
 *   → 相关切片塞进大模型的上下文 → 大模型基于真实条款回答并引用出处
 */

import { chunkAll, type Chunk, type RawDoc } from './chunker';
import { BM25 } from './bm25';
// JSON 静态导入：打包部署时数据随代码一起走，线上不会丢文件
import policiesJson from '../data/policies.json';

// ========== 启动时建索引（只做一次）==========

const policies: RawDoc[] = policiesJson;

// 切片时把关键词也拼进文本，提升标题/关键词的命中权重
const chunks: Chunk[] = chunkAll(policies).map((c) => ({
  ...c,
  text: `${c.docTitle} ${c.text}`,
}));

const bm25 = new BM25(chunks);

console.log(`[RAG] 知识库就绪：${policies.length} 份制度文档 → ${chunks.length} 个切片`);

// ========== 对外接口 ==========

/** 一条检索结果（带引用出处） */
export interface RetrievalResult {
  docTitle: string; // 来源文档，如《学生请假管理办法》
  section: string;  // 来源小节，如"二、审批权限"
  text: string;     // 切片内容
  score: number;    // 相关度得分
}

/**
 * 在制度知识库中检索最相关的切片
 * @param query 用户的问题（原样传入即可，不用提取关键词）
 * @param k     返回几片（默认 2，多了浪费 token）
 */
export function searchPolicies(query: string, k = 2): RetrievalResult[] {
  return bm25.search(query, k).map(({ doc, score }) => ({
    docTitle: doc.docTitle,
    section: doc.section,
    // 去掉拼接的标题前缀，还原纯正文
    text: doc.text.replace(`${doc.docTitle} `, ''),
    score: Math.round(score * 100) / 100,
  }));
}
