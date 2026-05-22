import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import {
  buildPromptTemplateRows,
  createPromptWorkbookBytes,
} from './promptExcel.js';

assert.deepEqual(buildPromptTemplateRows(), [
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
assert.doesNotMatch(sheetXml, /Bug 调试专家/);
