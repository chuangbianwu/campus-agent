/**
 * 引用来源抽屉（RAG 引用溯源 UI）
 *
 * AI 回复制度类内容后，气泡底部出现"来源"Tag；
 * 点击弹出右侧抽屉（shadcn Sheet），展示条款原文和小节出处。
 * 数据来自后端 RAG 检索的 citations 事件——真数据，不是装饰。
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

export interface Citation {
  title: string;   // 来源文档名，如《学生请假管理办法》
  section: string; // 小节，如"三、请假流程"
  text: string;    // 条款原文
}

function CitationDrawer({
  citations,
  open,
  onClose,
}: {
  citations: Citation[];
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>引用来源</SheetTitle>
          <SheetDescription>
            以下内容来自校园制度知识库的 RAG 检索结果，为条款原文。
          </SheetDescription>
        </SheetHeader>
        {citations.map((c, i) => (
          <div key={i}>
            <div className="citation-doc-title">📚 《{c.title}》</div>
            <div className="citation-doc-section">{c.section}</div>
            <div className="citation-doc-text">{c.text}</div>
          </div>
        ))}
      </SheetContent>
    </Sheet>
  );
}

export default CitationDrawer;
