import assert from 'node:assert/strict';
import { unzipSync, strFromU8, strToU8, zipSync } from 'fflate';
import readXlsxFile from 'read-excel-file/node';
import {
  buildPromptHistoryRows,
  buildPromptTemplateRows,
  createPromptWorkbookBytes,
} from './promptExcel.js';
import { normalizeImportedPromptRows, tableRowsToObjects } from './promptTemplate.js';

assert.deepEqual(buildPromptTemplateRows(), [
  ['分类', '标题', '简介', '复用Prompt', '定制Prompt'],
  [
    '填写所属分类，必填；不存在时导入会自动新建。',
    '填写 Prompt 名称，必填。',
    '一句话说明用途，可选。',
    '上下文充足时直接调用完整 Prompt，不使用占位符；仅定制可留空。',
    '需要手动填写时使用，用 {{字段名}} 标记，例如 {{主题}}；仅复用可留空。',
  ],
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
]);

const bytes = createPromptWorkbookBytes(buildPromptTemplateRows());
const files = unzipSync(bytes);
assert.ok(files['xl/workbook.xml']);
assert.ok(files['xl/worksheets/sheet1.xml']);

const sheetXml = strFromU8(files['xl/worksheets/sheet1.xml']);
assert.match(sheetXml, /发布包整理/);
assert.match(sheetXml, /复用Prompt/);
assert.match(sheetXml, /定制Prompt/);
assert.match(sheetXml, /复用Prompt[\s\S]*不使用占位符/);
assert.match(sheetXml, /例如 \{\{主题\}\}/);
assert.doesNotMatch(sheetXml, /上一步文件名/);
assert.match(sheetXml, /<autoFilter ref="A1:E5"\/>/);
assert.doesNotMatch(sheetXml, /Prompt内容/);
assert.doesNotMatch(sheetXml, />标签</);
assert.doesNotMatch(sheetXml, /调用模式/);
assert.doesNotMatch(sheetXml, /启用/);
assert.doesNotMatch(sheetXml, /Bug 调试专家/);

assert.deepEqual(
  buildPromptHistoryRows(
    [
      { id: 'media', label: '自媒体' },
      { id: 'coding', label: 'Coding' },
    ],
    {
      media: [
        {
          title: '文章优化',
          description: '润色公众号文章',
          prompt: '请优化：{{原文内容}}',
          customPrompt: '请优化：{{原文内容}}',
          tags: ['旧字段不导出'],
          outputMode: 'insert',
          enabled: false,
        },
      ],
      coding: [
        {
          title: 'Bug 分析',
          description: '',
          prompt: '错误：{{错误信息}}',
          reusePrompt: '读取上一份错误日志并定位问题',
          customPrompt: '错误：{{错误信息}}',
        },
      ],
    },
  ),
  [
    ['分类', '标题', '简介', '复用Prompt', '定制Prompt'],
    ['自媒体', '文章优化', '润色公众号文章', '', '请优化：{{原文内容}}'],
    ['Coding', 'Bug 分析', '', '读取上一份错误日志并定位问题', '错误：{{错误信息}}'],
  ],
);

const historyWorkbookBytes = createPromptWorkbookBytes(buildPromptHistoryRows(
  [{ id: 'media', label: '自媒体', visible: true }],
  {
    media: [
      {
        title: '文章优化',
        description: '润色公众号文章',
        prompt: '请优化：{{原文内容}}',
        customPrompt: '请优化：{{原文内容}}',
      },
    ],
  },
));
const historyRows = await readXlsxFile(new Blob([historyWorkbookBytes]));
assert.deepEqual(
  normalizeImportedPromptRows(tableRowsToObjects(historyRows)),
  [
    {
      category: '自媒体',
      title: '文章优化',
      description: '润色公众号文章',
      prompt: '请优化：{{原文内容}}',
      reusePrompt: '',
      customPrompt: '请优化：{{原文内容}}',
      variables: ['原文内容'],
    },
  ],
);

const wpsRows = await readXlsxFile(new Blob([createWpsStylePromptWorkbookBytes()]), { trim: false });
assert.deepEqual(
  normalizeImportedPromptRows(tableRowsToObjects(wpsRows)),
  [
    {
      category: '自媒体系统',
      title: '系统导航',
      description: '判断当前处在哪个阶段，并推荐下一步 Skill',
      prompt: '$self-media-system\n请先读取前文，推荐下一步 Skill。',
      reusePrompt: '$self-media-system\n请先读取前文，推荐下一步 Skill。',
      customPrompt: '',
      variables: [],
    },
  ],
);

function createWpsStylePromptWorkbookBytes() {
  const worksheet = `<?xml version="1.0" encoding="utf-8"?>
<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <x:sheetData>
    <x:row r="1">
      <x:c r="A1" t="inlineStr"><x:is><x:t xml:space="preserve">分类</x:t></x:is></x:c>
      <x:c r="B1" t="inlineStr"><x:is><x:t xml:space="preserve">标题</x:t></x:is></x:c>
      <x:c r="C1" t="inlineStr"><x:is><x:t xml:space="preserve">简介</x:t></x:is></x:c>
      <x:c r="D1" t="inlineStr"><x:is><x:t xml:space="preserve">复用Prompt</x:t></x:is></x:c>
      <x:c r="E1" t="inlineStr"><x:is><x:t xml:space="preserve">定制Prompt</x:t></x:is></x:c>
    </x:row>
    <x:row r="2">
      <x:c r="A2" t="str"><x:v>自媒体系统</x:v></x:c>
      <x:c r="B2" t="str"><x:v>系统导航</x:v></x:c>
      <x:c r="C2" t="str"><x:v>判断当前处在哪个阶段，并推荐下一步 Skill</x:v></x:c>
      <x:c r="D2" t="str"><x:v>$self-media-system&#10;请先读取前文，推荐下一步 Skill。</x:v></x:c>
      <x:c r="E2" t="str"/>
    </x:row>
  </x:sheetData>
</x:worksheet>`;

  return zipSync({
    '[Content_Types].xml': xlsxXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`),
    '_rels/.rels': xlsxXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    'xl/workbook.xml': xlsxXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <x:sheets>
    <x:sheet name="Prompt导出" sheetId="1" r:id="rId1"/>
  </x:sheets>
</x:workbook>`),
    'xl/_rels/workbook.xml.rels': xlsxXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`),
    'xl/sharedStrings.xml': xlsxXml(`<?xml version="1.0" encoding="utf-8"?>
<x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>`),
    'xl/worksheets/sheet1.xml': xlsxXml(worksheet),
  }, { level: 6 });
}

function xlsxXml(xml) {
  return strToU8(xml);
}
