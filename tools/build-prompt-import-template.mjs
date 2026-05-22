import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = '/Users/Abigale/All_project/20260522promptmanagement/outputs/prompt-import-template';
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const template = workbook.worksheets.add('Prompt导入模板');
template.showGridLines = false;

const rows = [
  ['分类', '标题', '简介', 'Prompt内容', '标签', '调用模式', '启用'],
  [
    '填写所属分类，必填；不存在时导入会自动新建。',
    '填写 Prompt 名称，必填。',
    '一句话说明用途，可选。',
    '填写完整 Prompt，可使用 {{字段名}} 作为调用前需要填写的占位符。',
    '可选，多个标签用英文逗号分隔。',
    '可选：copy 表示复制；insert/ai 为预留。',
    '可选：true/是 启用；false/否 禁用。',
  ],
  [
    '自媒体',
    '公众号文章优化',
    '根据主题、读者和原文生成优化建议',
    '请优化以下公众号文章。\n\n文章主题：{{文章主题}}\n目标读者：{{目标读者}}\n原文内容：{{原文内容}}\n\n要求：\n1. 优化标题\n2. 调整段落结构\n3. 提炼金句\n4. 保持亲和、清晰的语气',
    '公众号,润色,文章',
    'copy',
    'true',
  ],
];

template.getRange(`A1:G${rows.length}`).values = rows;
template.freezePanes.freezeRows(1);
template.getRange('A1:G1').format.fill.color = '#0F172A';
template.getRange('A1:G1').format.font.color = '#FFFFFF';
template.getRange('A1:G1').format.font.bold = true;
template.getRange('A1:G1').format.horizontalAlignment = 'Center';
template.getRange('A1:G1').format.verticalAlignment = 'Center';
template.getRange('A1:G1').format.rowHeightPx = 32;
template.getRange('A2:G3').format.verticalAlignment = 'Top';
template.getRange('A2:G3').format.wrapText = true;
template.getRange('A:G').format.font.name = 'Arial';
template.getRange('A:G').format.font.size = 11;
template.getRange('A:A').format.columnWidthPx = 90;
template.getRange('B:B').format.columnWidthPx = 150;
template.getRange('C:C').format.columnWidthPx = 210;
template.getRange('D:D').format.columnWidthPx = 520;
template.getRange('E:E').format.columnWidthPx = 150;
template.getRange('F:F').format.columnWidthPx = 90;
template.getRange('G:G').format.columnWidthPx = 80;
template.getRange('A2:G2').format.rowHeightPx = 62;
template.getRange('A3:G3').format.rowHeightPx = 132;
template.getRange('F2:F200').dataValidation = { rule: { type: 'list', values: ['copy', 'insert', 'ai'] } };
template.getRange('G2:G200').dataValidation = { rule: { type: 'list', values: ['true', 'false', '是', '否'] } };

const guide = workbook.worksheets.add('填写说明');
guide.showGridLines = false;
const guideRows = [
  ['项目', '说明', '示例'],
  ['必填列', '分类、标题、Prompt内容。缺少任意一个，导入时会跳过该行。', '自媒体 / 公众号文章优化 / 请优化：{{原文内容}}'],
  ['占位符规则', '每次调用都需要你填写的内容，用双大括号标记。系统会自动识别并生成填写弹窗。', '{{文章主题}}、{{原文内容}}、{{错误信息}}'],
  ['固定内容', '不需要每次变化的要求，直接写在 Prompt内容 里，不要加双大括号。', '要求：输出 5 条建议；语气专业清晰'],
  ['标签', '可选，用逗号分隔，方便后续检索和管理。', '公众号,润色,文章'],
  ['调用模式', '可选，当前建议填写 copy。insert/ai 先作为预留字段。', 'copy'],
  ['启用', '可选。true/是 表示启用；false/否 表示导入后不显示在列表里。空着默认启用。', 'true'],
  ['字段顺序', 'Prompt内容 中占位符出现的顺序，就是调用弹窗里的填写顺序；重复字段只显示一次。', '{{文章主题}} 出现多次，也只填写一次'],
  ['表头兼容', '系统也支持英文表头：category、title、description、prompt、tags、output_mode、enabled。', 'category,title,prompt'],
];

guide.getRange(`A1:C${guideRows.length}`).values = guideRows;
guide.freezePanes.freezeRows(1);
guide.getRange('A1:C1').format.fill.color = '#0F172A';
guide.getRange('A1:C1').format.font.color = '#FFFFFF';
guide.getRange('A1:C1').format.font.bold = true;
guide.getRange('A:C').format.font.name = 'Arial';
guide.getRange('A:C').format.font.size = 11;
guide.getRange('A1:C9').format.wrapText = true;
guide.getRange('A1:C9').format.verticalAlignment = 'Top';
guide.getRange('A:A').format.columnWidthPx = 110;
guide.getRange('B:B').format.columnWidthPx = 460;
guide.getRange('C:C').format.columnWidthPx = 280;
guide.getRange('A2:C9').format.rowHeightPx = 58;

const inspect = await workbook.inspect({
  kind: 'table',
  range: 'Prompt导入模板!A1:G3',
  include: 'values',
  tableMaxRows: 8,
  tableMaxCols: 8,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 50 },
  summary: 'formula error scan',
});
console.log(errors.ndjson);

await workbook.render({ sheetName: 'Prompt导入模板', range: 'A1:G3', scale: 1 });
await workbook.render({ sheetName: '填写说明', range: 'A1:C9', scale: 1 });

const output = await SpreadsheetFile.exportXlsx(workbook);
const filePath = path.join(outputDir, 'Prompt导入模板示例.xlsx');
await output.save(filePath);
console.log(filePath);
