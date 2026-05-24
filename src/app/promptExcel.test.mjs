import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import readXlsxFile from 'read-excel-file/node';
import {
  buildPromptHistoryRows,
  buildPromptTemplateRows,
  createPromptWorkbookBytes,
} from './promptExcel.js';
import { normalizeImportedPromptRows, tableRowsToObjects } from './promptTemplate.js';

assert.deepEqual(buildPromptTemplateRows(), [
  ['分类', '标题', '简介', 'Prompt内容'],
  [
    '填写所属分类，必填；不存在时导入会自动新建。',
    '填写 Prompt 名称，必填。',
    '一句话说明用途，可选。',
    '填写完整 Prompt，可使用 {{字段名}} 作为调用前需要填写的占位符。',
  ],
  [
    '自媒体',
    '公众号文章优化',
    '根据主题、读者和原文生成优化建议',
    '请优化以下公众号文章。\n\n文章主题：{{文章主题}}\n目标读者：{{目标读者}}\n原文内容：{{原文内容}}\n\n要求：\n1. 优化标题\n2. 调整段落结构\n3. 提炼金句\n4. 保持亲和、清晰的语气',
  ],
]);

const bytes = createPromptWorkbookBytes(buildPromptTemplateRows());
const files = unzipSync(bytes);
assert.ok(files['xl/workbook.xml']);
assert.ok(files['xl/worksheets/sheet1.xml']);

const sheetXml = strFromU8(files['xl/worksheets/sheet1.xml']);
assert.match(sheetXml, /公众号文章优化/);
assert.match(sheetXml, /填写完整 Prompt，可使用 \{\{字段名\}\}/);
assert.match(sheetXml, /文章主题：\{\{文章主题\}\}/);
assert.match(sheetXml, /&#10;原文内容：\{\{原文内容\}\}/);
assert.match(sheetXml, /<autoFilter ref="A1:D3"\/>/);
assert.doesNotMatch(sheetXml, /标签/);
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
        },
      ],
    },
  ),
  [
    ['分类', '标题', '简介', 'Prompt内容'],
    ['自媒体', '文章优化', '润色公众号文章', '请优化：{{原文内容}}'],
    ['Coding', 'Bug 分析', '', '错误：{{错误信息}}'],
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
      variables: ['原文内容'],
    },
  ],
);
