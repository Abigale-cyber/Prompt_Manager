import assert from 'node:assert/strict';
import {
  extractTemplateFields,
  fillPromptTemplate,
  mergeImportedPromptRows,
  moveItemById,
  normalizeImportedPromptRows,
  parseCsvRows,
  tableRowsToObjects,
} from './promptTemplate.js';

assert.deepEqual(
  extractTemplateFields('主题：{{文章主题}}\n原文：{{ 原文内容 }}\n再次：{{文章主题}}'),
  ['文章主题', '原文内容'],
);

assert.deepEqual(
  extractTemplateFields('请重构以下代码：\n[在此粘贴代码]\n输出 Markdown 链接：[文档](https://example.com)'),
  ['在此粘贴代码'],
);

assert.equal(
  fillPromptTemplate('主题：{{文章主题}}\n原文：{{ 原文内容 }}', {
    文章主题: '效率工具',
    原文内容: '原始正文',
  }),
  '主题：效率工具\n原文：原始正文',
);

assert.equal(
  fillPromptTemplate('请重构以下代码：\n[在此粘贴代码]\n保留链接：[文档](https://example.com)', {
    在此粘贴代码: 'const value = 1;',
  }),
  '请重构以下代码：\nconst value = 1;\n保留链接：[文档](https://example.com)',
);

assert.deepEqual(
  moveItemById(
    [{ id: 1, title: 'A' }, { id: 2, title: 'B' }, { id: 3, title: 'C' }],
    3,
    1,
  ).map(item => item.id),
  [3, 1, 2],
);

assert.deepEqual(
  moveItemById(
    [{ id: 1, title: 'A' }, { id: 2, title: 'B' }, { id: 3, title: 'C' }],
    1,
    3,
  ).map(item => item.id),
  [2, 3, 1],
);

assert.deepEqual(
  normalizeImportedPromptRows([
    {
      分类: '填写所属分类，必填；不存在时导入会自动新建。',
      标题: '填写 Prompt 名称，必填。',
      简介: '一句话说明用途，可选。',
      Prompt内容: '填写完整 Prompt，可使用 {{字段名}} 作为调用前需要填写的占位符。',
    },
    {
      category: '自媒体',
      title: '文章优化',
      description: '优化公众号文章',
      prompt: '请优化：{{原文内容}}',
      tags: '公众号, 润色',
      output_mode: 'insert',
      enabled: 'true',
    },
    {
      分类: 'Coding',
      标题: '无效行',
      Prompt: '',
    },
    {
      分类: 'Coding',
      标题: 'Bug 分析',
      描述: '定位问题',
      Prompt: '错误：{{错误信息}}',
      启用: '否',
    },
  ]),
  [
    {
      category: '自媒体',
      title: '文章优化',
      description: '优化公众号文章',
      prompt: '请优化：{{原文内容}}',
      variables: ['原文内容'],
    },
    {
      category: 'Coding',
      title: 'Bug 分析',
      description: '定位问题',
      prompt: '错误：{{错误信息}}',
      variables: ['错误信息'],
    },
  ],
);

assert.deepEqual(
  tableRowsToObjects([
    ['category', 'title', 'prompt'],
    ['PM', '用户故事', '需求：{{需求描述}}'],
  ]),
  [{ category: 'PM', title: '用户故事', prompt: '需求：{{需求描述}}' }],
);

assert.deepEqual(
  tableRowsToObjects([
    {
      sheet: 'Prompt导入模板',
      data: [
        ['分类', '标题', 'Prompt内容'],
        ['自媒体', '标题生成', '主题：{{主题}}'],
      ],
    },
  ]),
  [{ 分类: '自媒体', 标题: '标题生成', Prompt内容: '主题：{{主题}}' }],
);

assert.deepEqual(
  parseCsvRows('category,title,prompt\n自媒体,标题生成,"主题：{{主题}}"'),
  [{ category: '自媒体', title: '标题生成', prompt: '主题：{{主题}}' }],
);

assert.deepEqual(
  mergeImportedPromptRows({
    categories: [{ id: 'media', label: '自媒体', visible: true }],
    prompts: {
      media: [{ id: 1, title: '已有 Prompt', description: '', prompt: '旧内容' }],
    },
    rows: [
      {
        category: '自媒体',
        title: '新增文章优化',
        description: '追加到已有分类',
        prompt: '原文：{{原文内容}}',
        variables: ['原文内容'],
      },
      {
        category: 'PM',
        title: '新增需求拆解',
        description: '',
        prompt: '需求：{{需求描述}}',
        variables: ['需求描述'],
      },
    ],
    now: 100,
  }),
  {
    categories: [
      { id: 'media', label: '自媒体', visible: true },
      { id: 'pm', label: 'PM', visible: true },
    ],
    prompts: {
      media: [
        { id: 1, title: '已有 Prompt', description: '', prompt: '旧内容' },
        {
          id: 100,
          title: '新增文章优化',
          description: '追加到已有分类',
          prompt: '原文：{{原文内容}}',
          tags: [],
          outputMode: 'copy',
          enabled: true,
          variables: ['原文内容'],
          usageCount: 0,
          createdAt: 100,
          updatedAt: 100,
        },
      ],
      pm: [
        {
          id: 101,
          title: '新增需求拆解',
          description: '导入的 Prompt',
          prompt: '需求：{{需求描述}}',
          tags: [],
          outputMode: 'copy',
          enabled: true,
          variables: ['需求描述'],
          usageCount: 0,
          createdAt: 100,
          updatedAt: 100,
        },
      ],
    },
  },
);
