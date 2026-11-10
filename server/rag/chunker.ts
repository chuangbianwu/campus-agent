/**
 * RAG 第一步：文档切片（Chunking）
 *
 * 为什么不能把整篇文档塞给大模型？
 * 1. 文档可能很长，超出上下文窗口 → 费 token、效果差
 * 2. 整篇塞进去，真正相关的那一条反而被"稀释"了
 *
 * 切片策略：按制度文档的小节标题（"一、二、三..."）切，
 * 每个切片自带"出处"（哪份文档、哪一节），这就是引用溯源的数据基础。
 */

/** 一个文档切片 */
export interface Chunk {
  id: string;        // 唯一标识：文档ID-序号
  docId: string;     // 来源文档 ID
  docTitle: string;  // 来源文档标题（引用溯源用）
  section: string;   // 小节标题，如"二、审批权限"
  text: string;      // 切片正文
}

/** 输入的原始文档结构（与 policies.json 对应） */
export interface RawDoc {
  id: string;
  title: string;
  keywords: string[];
  content: string;
}

/**
 * 把一篇制度文档切成若干小节切片
 *
 * 文档格式约定：每节以"一、""二、"等中文序号开头。
 * 如果某篇文档没有小节标记，就整篇作为一个切片（保底策略）。
 */
export function chunkDocument(doc: RawDoc): Chunk[] {
  // 按中文小节序号切分："一、" "二、" ... "十、"
  // 注意：序号必须出现在行首！否则会把正文里的"周五、"误切成新切片
  // 正则用 lookahead（?=）切分但保留序号在切片里
  const parts = doc.content.split(/(?=\n[一二三四五六七八九十]+、)/);

  const chunks: Chunk[] = parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part, index) => {
      // 提取小节标题（第一行的前 20 个字，用于展示出处）
      const firstLine = part.split('\n')[0];
      const section = firstLine.length > 20 ? firstLine.slice(0, 20) + '…' : firstLine;

      return {
        id: `${doc.id}-${index}`,
        docId: doc.id,
        docTitle: doc.title,
        section,
        text: part,
      };
    });

  return chunks;
}

/**
 * 批量切片：把整份文档库切成切片数组（即"知识库"）
 */
export function chunkAll(docs: RawDoc[]): Chunk[] {
  return docs.flatMap(chunkDocument);
}
