export const ANTHROPIC_VERSION = '2023-06-01';

export function defaultAIBaseUrl(provider) {
  if (provider === 'deepseek') return 'https://api.deepseek.com';
  if (provider === 'openai') return 'https://api.openai.com/v1';
  if (provider === 'anthropic') return 'https://api.anthropic.com/v1';
  return '';
}

export function aiCompletionEndpoint(provider, baseUrl) {
  const root = (String(baseUrl || '').trim() || defaultAIBaseUrl(provider)).replace(/\/+$/, '');
  if (!root) return '';
  if (provider === 'anthropic') {
    if (root.endsWith('/messages')) return root;
    if (root.endsWith('/v1')) return `${root}/messages`;
    return `${root}/v1/messages`;
  }
  return root.endsWith('/chat/completions') ? root : `${root}/chat/completions`;
}

export function resolveAIRequestProvider({ provider, model, baseUrl }) {
  const normalizedModel = String(model || '').trim().toLowerCase();
  const normalizedBaseUrl = String(baseUrl || '').trim().toLowerCase();
  if (normalizedBaseUrl.includes('storyclaw.com') && normalizedModel.startsWith('claude-')) {
    return 'anthropic';
  }
  return provider;
}

export function buildAIRequestConfig({ provider, apiKey, baseUrl, body }) {
  if (provider === 'anthropic') {
    if (String(baseUrl || '').toLowerCase().includes('storyclaw.com')) {
      return {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${String(apiKey || '').trim()}`,
        },
        body: toAnthropicMessagesBody(body),
      };
    }

    return {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': String(apiKey || '').trim(),
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: toAnthropicMessagesBody(body),
    };
  }

  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${String(apiKey || '').trim()}`,
    },
    body,
  };
}

export function parseAICompletionText(provider, data) {
  if (provider === 'anthropic') {
    return (data?.content || [])
      .filter(item => item?.type === 'text' && item.text)
      .map(item => item.text)
      .join('\n')
      .trim();
  }
  return data?.choices?.[0]?.message?.content;
}

function toAnthropicMessagesBody(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const system = messages
    .filter(message => message?.role === 'system')
    .map(message => String(message.content || '').trim())
    .filter(Boolean)
    .join('\n\n');
  const anthropicMessages = messages
    .filter(message => message?.role === 'user' || message?.role === 'assistant')
    .map(message => ({
      role: message.role,
      content: String(message.content || ''),
    }));

  return {
    model: body?.model,
    max_tokens: body?.max_tokens || 1024,
    ...(system ? { system } : {}),
    messages: anthropicMessages,
  };
}
