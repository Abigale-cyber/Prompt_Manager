import assert from 'node:assert/strict';
import {
  extractTemplateFields,
  fillPromptTemplate,
  mergeImportedPromptRows,
  moveItemById,
  normalizeImportedPromptRows,
  parseCsvRows,
  tableRowsToObjects,
  shouldOpenPromptFillDialog,
} from './promptTemplate.js';

assert.deepEqual(
  extractTemplateFields('主题：{{文章主题}}\n原文：{{ 原文内容 }}\n再次：{{文章主题}}'),
  ['文章主题', '原文内容'],
);

assert.deepEqual(
  extractTemplateFields('请重构以下代码：\n[在此粘贴代码]\n输出 Markdown 链接：[文档](https://example.com)'),
  ['在此粘贴代码'],
);

assert.deepEqual(
  extractTemplateFields('账号模式：{ {账号模式} }\n发布平台：{ { 发布平台 } }'),
  ['账号模式', '发布平台'],
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

assert.equal(
  fillPromptTemplate('账号模式：{ {账号模式} }\n发布平台：{ { 发布平台 } }', {
    账号模式: '个人号',
    发布平台: '小红书',
  }),
  '账号模式：个人号\n发布平台：小红书',
);

assert.equal(
  shouldOpenPromptFillDialog({ mode: 'custom', template: '请按固定流程输出完整结果。' }),
  true,
);

assert.equal(
  shouldOpenPromptFillDialog({ mode: 'reuse', template: '请读取上一轮输出继续处理。' }),
  false,
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
      复用Prompt: '上下文充足时直接调用完整 Prompt，不使用占位符；仅定制可留空。',
      定制Prompt: '需要手动填写时使用，用 {{字段名}} 标记，例如 {{主题}}；仅复用可留空。',
    },
    {
      category: '自媒体',
      title: '文章优化',
      description: '优化公众号文章',
      复用Prompt: '',
      定制Prompt: '请优化：{{原文内容}}',
      tags: '公众号, 润色',
      output_mode: 'insert',
      enabled: 'true',
    },
    {
      分类: '自媒体',
      标题: '发布包整理',
      简介: '承接上一步文章',
      复用Prompt: '请基于上一篇文章整理发布包',
      定制Prompt: '',
    },
    {
      分类: '自媒体',
      标题: '纯复用示例',
      简介: '即使文本里有大括号也不要求填写',
      复用Prompt: '请按 {{现有上下文}} 继续处理',
      定制Prompt: '',
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
      reusePrompt: '',
      customPrompt: '请优化：{{原文内容}}',
      variables: ['原文内容'],
    },
    {
      category: '自媒体',
      title: '发布包整理',
      description: '承接上一步文章',
      prompt: '请基于上一篇文章整理发布包',
      reusePrompt: '请基于上一篇文章整理发布包',
      customPrompt: '',
      variables: [],
    },
    {
      category: '自媒体',
      title: '纯复用示例',
      description: '即使文本里有大括号也不要求填写',
      prompt: '请按 {{现有上下文}} 继续处理',
      reusePrompt: '请按 {{现有上下文}} 继续处理',
      customPrompt: '',
      variables: [],
    },
    {
      category: 'Coding',
      title: 'Bug 分析',
      description: '定位问题',
      prompt: '错误：{{错误信息}}',
      reusePrompt: '',
      customPrompt: '错误：{{错误信息}}',
      variables: ['错误信息'],
    },
  ],
);

assert.deepEqual(
  tableRowsToObjects([
    ['category', 'title', 'reusePrompt', 'customPrompt'],
    ['PM', '用户故事', '请基于上一轮需求继续拆解', '需求：{{需求描述}}'],
  ]),
  [{ category: 'PM', title: '用户故事', reusePrompt: '请基于上一轮需求继续拆解', customPrompt: '需求：{{需求描述}}' }],
);

assert.deepEqual(
  tableRowsToObjects([
    {
      sheet: 'Prompt导入模板',
      data: [
        ['分类', '标题', '复用Prompt', '定制Prompt'],
        ['自媒体', '标题生成', '', '主题：{{主题}}'],
      ],
    },
  ]),
  [{ 分类: '自媒体', 标题: '标题生成', 复用Prompt: '', 定制Prompt: '主题：{{主题}}' }],
);

assert.deepEqual(
  parseCsvRows('category,title,reusePrompt,customPrompt\n自媒体,标题生成,,"主题：{{主题}}"'),
  [{ category: '自媒体', title: '标题生成', reusePrompt: '', customPrompt: '主题：{{主题}}' }],
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
        reusePrompt: '',
        customPrompt: '原文：{{原文内容}}',
        variables: ['原文内容'],
      },
      {
        category: 'PM',
        title: '新增需求拆解',
        description: '',
        prompt: '需求：{{需求描述}}',
        reusePrompt: '请读取上一轮需求继续拆解',
        customPrompt: '需求：{{需求描述}}',
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
          reusePrompt: undefined,
          customPrompt: '原文：{{原文内容}}',
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
          reusePrompt: '请读取上一轮需求继续拆解',
          customPrompt: '需求：{{需求描述}}',
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

const duplicateImportState = {
  categories: [{ id: 'media', label: '自媒体', visible: true }],
  prompts: {
    media: [
      {
        id: 1,
        title: '内容大纲',
        description: '旧简介',
        prompt: '旧 Prompt',
        reusePrompt: '旧复用',
        usageCount: 7,
        createdAt: 10,
      },
      { id: 2, title: '发布包整理', description: '', prompt: '发布包' },
    ],
  },
  rows: [
    {
      category: '自媒体',
      title: '内容大纲',
      description: '新简介',
      prompt: '新 Prompt',
      reusePrompt: '新复用',
      customPrompt: '',
      variables: [],
    },
  ],
  now: 200,
};

assert.deepEqual(
  mergeImportedPromptRows({ ...duplicateImportState, duplicateStrategy: 'replace' }).prompts.media.map(item => ({
    id: item.id,
    title: item.title,
    prompt: item.prompt,
    description: item.description,
    reusePrompt: item.reusePrompt,
    usageCount: item.usageCount,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })),
  [
    {
      id: 1,
      title: '内容大纲',
      prompt: '新 Prompt',
      description: '新简介',
      reusePrompt: '新复用',
      usageCount: 7,
      createdAt: 10,
      updatedAt: 200,
    },
    {
      id: 2,
      title: '发布包整理',
      prompt: '发布包',
      description: '',
      reusePrompt: undefined,
      usageCount: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    },
  ],
);

assert.deepEqual(
  mergeImportedPromptRows({ ...duplicateImportState, duplicateStrategy: 'skip' }).prompts.media.map(item => item.prompt),
  ['旧 Prompt', '发布包'],
);

assert.deepEqual(
  mergeImportedPromptRows({ ...duplicateImportState, duplicateStrategy: 'copy' }).prompts.media.map(item => ({
    title: item.title,
    prompt: item.prompt,
  })),
  [
    { title: '内容大纲', prompt: '旧 Prompt' },
    { title: '发布包整理', prompt: '发布包' },
    { title: '内容大纲（副本）', prompt: '新 Prompt' },
  ],
);
