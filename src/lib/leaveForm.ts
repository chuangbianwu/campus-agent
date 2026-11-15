/**
 * 请假申请表生成器（浏览器端合成 .docx）
 *
 * 为什么在前端生成而不是后端？
 * 数据已经在卡片里了，浏览器本地合成 + 下载，
 * 后端零改动、零传输，答辩断网也能演示。
 */

import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType,
} from 'docx';

export interface LeaveFormData {
  student: string;  // 姓名（从课表数据预填）
  major: string;    // 专业
  grade: string;    // 年级
  basis: string;    // 制度依据，如"《学生请假管理办法》三、请假流程"
  rules: string[];  // 相关条款原文（附在表末供辅导员参考）
}

/** 表格里一个"标签 + 填写区"的行 */
function fieldRow(label: string, value: string, hint = '') {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 22, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 21 })] })],
      }),
      new TableCell({
        width: { size: 78, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [
            new TextRun({ text: value, size: 21 }),
            ...(hint ? [new TextRun({ text: `    ${hint}`, size: 18, color: '888888' })] : []),
          ],
        })],
      }),
    ],
  });
}

/** 生成 .docx 并触发浏览器下载 */
export async function downloadLeaveForm(data: LeaveFormData) {
  const today = new Date().toLocaleDateString('zh-CN');

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: '学生请假申请表', bold: true, size: 32 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [new TextRun({ text: `（由"校园百事通"智能助手预填 · ${today}）`, size: 18, color: '888888' })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            fieldRow('姓    名', data.student),
            fieldRow('专业年级', `${data.major} · ${data.grade}`),
            fieldRow('请假类型', '', '事假 / 病假 / 其他'),
            fieldRow('请假时间', '', '起：____年__月__日    止：____年__月__日'),
            fieldRow('请假事由', '\n\n'),
            fieldRow('证明材料', '', '如有，请附后'),
          ],
        }),
        new Paragraph({
          spacing: { before: 320 },
          children: [new TextRun({ text: '制度依据', bold: true, size: 21 })],
        }),
        new Paragraph({
          spacing: { after: 160 },
          children: [new TextRun({ text: data.basis, size: 20, color: '444444' })],
        }),
        ...data.rules.map((r) => new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: r.trim(), size: 18, color: '666666' })],
        })),
        new Paragraph({
          spacing: { before: 480 },
          children: [new TextRun({ text: '申请人签字：______________        辅导员意见：________________', size: 21 })],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const fileName = `请假申请表-${data.student}-${today.replaceAll('/', '-')}.docx`;
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return fileName;
}
