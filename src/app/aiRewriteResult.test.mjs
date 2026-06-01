import assert from 'node:assert/strict';
import {
  completeAIRewriteValues,
  extractAIRewriteValues,
  hasFilledAIRewriteValues,
} from './aiRewriteResult.js';

assert.deepEqual(
  extractAIRewriteValues('{"主题":"医美痘坑","优先选题":"痘坑修复避坑"}', ['主题', '优先选题']),
  { 主题: '医美痘坑', 优先选题: '痘坑修复避坑' },
);

assert.deepEqual(
  extractAIRewriteValues('{"字段":{"主题方向":"医美痘坑","资料依据：":"客户疑虑和复盘"}}', ['主题', '资料依据']),
  { 主题: '医美痘坑', 资料依据: '客户疑虑和复盘' },
);

assert.deepEqual(
  extractAIRewriteValues('```json\n{"主题 ：":"医美创业"}\n```', ['主题']),
  { 主题: '医美创业' },
);

assert.deepEqual(
  completeAIRewriteValues({
    values: {
      账号模式: '医美',
      发布平台: '',
      内容模块: '',
      主题方向: '痘坑',
      已有资料: '',
      客户问题或案例: '',
      核心判断: '',
      风险边界: '',
    },
    fields: ['账号模式', '发布平台', '内容模块', '主题方向', '已有资料', '客户问题或案例', '核心判断', '风险边界'],
    brief: '医美 痘坑',
    title: '生成选题',
    template: '$topic-generator 账号模式：{{账号模式}}；发布平台：{{发布平台}}；内容模块：{{内容模块}}',
  }),
  {
    账号模式: '医美科普个人IP',
    发布平台: '小红书',
    内容模块: '医美科普',
    主题方向: '痘坑',
    已有资料: '医美痘坑相关经验、案例观察和公开科普资料',
    客户问题或案例: '用户关心痘坑成因、改善方式、恢复周期、费用和风险边界',
    核心判断: '痘坑内容应以理性科普和风险提示为主，先建立认知，再给出选择建议',
    风险边界: '不承诺具体医疗效果，不引导过度消费，不发布违规医美广告内容',
  },
);

assert.deepEqual(
  completeAIRewriteValues({
    values: {},
    fields: ['目标用户', '内容形式', '优先选题'],
    brief: '长期主义 个人成长',
    title: '内容大纲',
    template: '',
  }),
  {
    目标用户: '关注长期主义个人成长并需要实用建议的用户',
    内容形式: '图文笔记',
    优先选题: '长期主义个人成长避坑指南',
  },
);

assert.equal(hasFilledAIRewriteValues({ 主题: '', 资料依据: '' }), false);
assert.equal(hasFilledAIRewriteValues({ 主题: '医美创业', 资料依据: '' }), true);
