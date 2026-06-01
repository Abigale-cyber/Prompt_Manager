import assert from 'node:assert/strict';
import {
  aiCompletionEndpoint,
  buildAIRequestConfig,
  parseAICompletionText,
  resolveAIRequestProvider,
} from './aiProviderRequest.js';

const chatPayload = {
  model: 'claude-opus-4-7',
  temperature: 0.2,
  max_tokens: 384,
  messages: [
    { role: 'system', content: '只返回 JSON 对象' },
    { role: 'user', content: '用户输入：医美创业' },
  ],
};

assert.equal(
  aiCompletionEndpoint('anthropic', ''),
  'https://api.anthropic.com/v1/messages',
);
assert.equal(
  aiCompletionEndpoint('anthropic', 'https://api.anthropic.com/v1/'),
  'https://api.anthropic.com/v1/messages',
);
assert.equal(
  aiCompletionEndpoint('anthropic', 'https://router.storyclaw.com'),
  'https://router.storyclaw.com/v1/messages',
);
assert.equal(
  aiCompletionEndpoint('anthropic', 'https://router.storyclaw.com/v1'),
  'https://router.storyclaw.com/v1/messages',
);
assert.equal(
  aiCompletionEndpoint('openai', 'https://api.openai.com/v1'),
  'https://api.openai.com/v1/chat/completions',
);

const anthropicRequest = buildAIRequestConfig({
  provider: 'anthropic',
  apiKey: 'sk-ant-test',
  body: chatPayload,
});

assert.equal(anthropicRequest.headers['x-api-key'], 'sk-ant-test');
assert.equal(anthropicRequest.headers['anthropic-version'], '2023-06-01');
assert.equal(anthropicRequest.headers.Authorization, undefined);
assert.equal(anthropicRequest.body.model, 'claude-opus-4-7');
assert.equal(anthropicRequest.body.max_tokens, 384);
assert.equal(anthropicRequest.body.system, '只返回 JSON 对象');
assert.deepEqual(anthropicRequest.body.messages, [
  { role: 'user', content: '用户输入：医美创业' },
]);
assert.equal(anthropicRequest.body.temperature, undefined);

const storyClawRequest = buildAIRequestConfig({
  provider: 'anthropic',
  apiKey: 'sk-storyclaw-test',
  baseUrl: 'https://router.storyclaw.com',
  body: chatPayload,
});

assert.equal(storyClawRequest.headers.Authorization, 'Bearer sk-storyclaw-test');
assert.equal(storyClawRequest.headers['x-api-key'], undefined);
assert.equal(storyClawRequest.headers['anthropic-version'], undefined);
assert.equal(storyClawRequest.body.model, 'claude-opus-4-7');
assert.deepEqual(storyClawRequest.body.messages, [
  { role: 'user', content: '用户输入：医美创业' },
]);

const openAIRequest = buildAIRequestConfig({
  provider: 'openai',
  apiKey: 'sk-openai-test',
  body: chatPayload,
});
assert.equal(openAIRequest.headers.Authorization, 'Bearer sk-openai-test');
assert.equal(openAIRequest.body, chatPayload);

assert.equal(
  resolveAIRequestProvider({
    provider: 'openai',
    model: 'claude-opus-4-7',
    baseUrl: 'https://router.storyclaw.com',
  }),
  'anthropic',
);
assert.equal(
  resolveAIRequestProvider({
    provider: 'openai',
    model: 'claude-opus-4-7',
    baseUrl: 'https://openrouter.ai/api/v1',
  }),
  'openai',
);

assert.equal(
  parseAICompletionText('anthropic', {
    content: [
      { type: 'text', text: '{"主题":"医美创业"}' },
    ],
  }),
  '{"主题":"医美创业"}',
);
assert.equal(
  parseAICompletionText('openai', {
    choices: [
      { message: { content: '{"主题":"医美创业"}' } },
    ],
  }),
  '{"主题":"医美创业"}',
);
