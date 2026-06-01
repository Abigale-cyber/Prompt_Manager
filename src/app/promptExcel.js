import { strToU8, zipSync } from 'fflate';
import { extractManualTemplateFields } from './promptTemplate.js';

const HEADERS = ['分类', '标题', '简介', '复用Prompt', '定制Prompt'];
const INSTRUCTION_ROW = [
  '填写所属分类，必填；不存在时导入会自动新建。',
  '填写 Prompt 名称，必填。',
  '一句话说明用途，可选。',
  '上下文充足时直接调用完整 Prompt，不使用占位符；仅定制可留空。',
  '需要手动填写时使用，用 {{字段名}} 标记，例如 {{主题}}；仅复用可留空。',
];
const EXAMPLE_ROWS = [
  [
    '自媒体',
    '发布包整理',
    '直接承接上一篇文章生成发布素材',
    '请基于上一篇文章整理发布包，输出标题、封面文案、摘要、标签和评论引导。',
    '',
  ],
  [
    '自媒体',
    '内容大纲',
    '可承接选题，也可手动填写主题',
    '请读取上一轮生成的候选选题，选择最适合发布的一条，生成公众号文章大纲。',
    '请围绕 {{主题}} 生成一份公众号文章大纲，包含标题、开头、3 个小节和结尾。',
  ],
  [
    '自媒体',
    '短视频选题',
    '根据主题生成选题',
    '',
    '请围绕主题 {{主题}} 生成 5 个适合自媒体发布的选题，每个选题用一句话说明亮点。',
  ],
];

export function buildPromptTemplateRows() {
  return [HEADERS, INSTRUCTION_ROW, ...EXAMPLE_ROWS];
}

export function buildPromptHistoryRows(categories = [], prompts = {}) {
  const rows = [HEADERS];
  const knownCategoryIds = new Set();

  (categories || []).forEach((category) => {
    const categoryId = String(category?.id || '');
    knownCategoryIds.add(categoryId);
    appendPromptRows(rows, category?.label || categoryId, prompts?.[categoryId]);
  });

  Object.entries(prompts || {}).forEach(([categoryId, promptList]) => {
    if (knownCategoryIds.has(categoryId)) return;
    appendPromptRows(rows, categoryId, promptList);
  });

  return rows;
}

export function createPromptWorkbookBytes(rows) {
  const files = {
    '[Content_Types].xml': xmlFile(contentTypesXml()),
    '_rels/.rels': xmlFile(rootRelationshipsXml()),
    'xl/workbook.xml': xmlFile(workbookXml()),
    'xl/_rels/workbook.xml.rels': xmlFile(workbookRelationshipsXml()),
    'xl/styles.xml': xmlFile(stylesXml()),
    'xl/worksheets/sheet1.xml': xmlFile(worksheetXml(rows)),
  };

  return zipSync(files, { level: 6 });
}

export function createPromptWorkbookBlob(rows) {
  return new Blob([createPromptWorkbookBytes(rows)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function appendPromptRows(rows, categoryLabel, promptList) {
  (Array.isArray(promptList) ? promptList : []).forEach((prompt) => {
    const { reusePrompt, customPrompt } = promptModeColumns(prompt);
    rows.push([
      categoryLabel,
      prompt?.title || '',
      prompt?.description || '',
      reusePrompt,
      customPrompt,
    ]);
  });
}

function promptModeColumns(prompt) {
  const reusePrompt = String(prompt?.reusePrompt || '').trim();
  const customPrompt = String(prompt?.customPrompt || '').trim();
  if (reusePrompt || customPrompt) return { reusePrompt, customPrompt };

  const legacyPrompt = String(prompt?.prompt || '').trim();
  if (!legacyPrompt) return { reusePrompt: '', customPrompt: '' };
  return extractManualTemplateFields(legacyPrompt).length > 0
    ? { reusePrompt: '', customPrompt: legacyPrompt }
    : { reusePrompt: legacyPrompt, customPrompt: '' };
}

function xmlFile(xml) {
  return strToU8(xml);
}

function worksheetXml(rows) {
  const columnWidths = [14, 24, 34, 80, 80];
  const cols = columnWidths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const sheetData = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          const ref = `${columnName(colIndex + 1)}${rowIndex + 1}`;
          const style = rowIndex === 0 ? 1 : 2;
          return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      const height = rowIndex === 0 ? 24 : rowIndex === 1 ? 56 : 132;
      return `<row r="${rowIndex + 1}" ht="${height}" customHeight="1">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <cols>${cols}</cols>
  <sheetData>${sheetData}</sheetData>
  <autoFilter ref="A1:${columnName(columnWidths.length)}${Math.max(rows.length, 1)}"/>
  <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
  <selection pane="bottomLeft"/>
</worksheet>`;
}

function columnName(number) {
  let name = '';
  let current = number;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\n/g, '&#10;');
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function rootRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Prompt导出" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function workbookRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}
