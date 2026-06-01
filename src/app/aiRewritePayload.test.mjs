import assert from 'node:assert/strict';
import {
  buildAIRewriteFieldContext,
  buildAIRewritePayload,
  estimateAIRewriteMaxTokens,
} from './aiRewritePayload.js';

const longTemplate = [
  '前置说明：这段很长，只是执行规则，不需要发送给 AI 改写字段。'.repeat(40),
  '账号模式：{ {账号模式} }；发布平台：{ {发布平台} }；内容模块：{ {内容模块} }。',
  '输出要求：这段也很长，和字段含义无关。'.repeat(40),
].join('\n');

const fieldContext = buildAIRewriteFieldContext(longTemplate, ['账号模式', '发布平台', '内容模块']);
assert.match(fieldContext, /账号模式/);
assert.match(fieldContext, /发布平台/);
assert.match(fieldContext, /内容模块/);
assert.ok(fieldContext.length < longTemplate.length / 3);
assert.doesNotMatch(fieldContext, /前置说明/);

assert.equal(estimateAIRewriteMaxTokens(['账号模式']), 240);
assert.equal(estimateAIRewriteMaxTokens(['a', 'b', 'c', 'd', 'e']), 860);

const payload = buildAIRewritePayload({
  model: 'deepseek-v4-pro',
  title: '生成选题',
  template: longTemplate,
  fields: ['账号模式', '发布平台', '内容模块'],
  brief: '医美美女',
});

assert.equal(payload.temperature, 0.2);
assert.equal(payload.max_tokens, 580);
assert.equal(payload.messages.length, 2);
assert.match(payload.messages[0].content, /只返回 JSON 对象/);
assert.match(payload.messages[0].content, /所有字段必须返回非空值/);
assert.match(payload.messages[0].content, /合理推断/);
assert.match(payload.messages[0].content, /不要返回空字符串/);
assert.match(payload.messages[1].content, /字段上下文/);
assert.match(payload.messages[1].content, /医美美女/);
assert.match(payload.messages[1].content, /即使用户输入没有直接覆盖某个字段，也必须按上下文推断填入/);
assert.doesNotMatch(payload.messages[1].content, /完整模板/);
assert.ok(payload.messages[1].content.length < longTemplate.length / 2);
