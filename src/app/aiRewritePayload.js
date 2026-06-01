const MAX_FIELD_CONTEXT_CHARS = 1800;

export function estimateAIRewriteMaxTokens(fields) {
  const fieldCount = Math.max(Array.isArray(fields) ? fields.length : 0, 1);
  if (fieldCount === 1) return 240;
  return Math.min(1800, Math.max(240, 160 + fieldCount * 140));
}

export function buildAIRewriteFieldContext(template, fields) {
  const text = String(template || '').trim();
  const patterns = (fields || [])
    .map(field => String(field || '').trim())
    .filter(Boolean)
    .map(field => new RegExp(`\\{\\s*\\{\\s*${escapeRegExp(field)}\\s*\\}\\s*\\}`));

  if (!text || patterns.length === 0) return text.slice(0, MAX_FIELD_CONTEXT_CHARS);

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const matchedLines = [];
  const seen = new Set();
  for (const line of lines) {
    if (!patterns.some(pattern => pattern.test(line))) continue;
    const compact = compactContextLine(line, patterns);
    if (seen.has(compact)) continue;
    seen.add(compact);
    matchedLines.push(compact);
  }

  const context = (matchedLines.length > 0 ? matchedLines.join('\n') : text)
    .slice(0, MAX_FIELD_CONTEXT_CHARS);
  return context;
}

export function buildAIRewritePayload({ model, title, template, fields, brief }) {
  const fieldList = (fields || []).map(field => String(field || '').trim()).filter(Boolean);
  const fieldContext = buildAIRewriteFieldContext(template, fieldList);
  return {
    model,
    temperature: 0.2,
    max_tokens: estimateAIRewriteMaxTokens(fieldList),
    messages: [
      {
        role: 'system',
        content: [
          '你把用户输入改写成 Prompt 模板字段值。',
          '只返回 JSON 对象；key 必须严格等于字段名，value 只写要填入字段的内容。',
          '所有字段必须返回非空值；用户没有明确提供的信息，要结合 Prompt 名称、字段上下文和已有输入合理推断。',
          '不要返回空字符串、null、未知、待补充、用户未提供等占位内容。',
          '不要解释，不要 Markdown，不要复述字段名，不要添加“用户输入：”“主题：”等前缀。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Prompt 名称：${title}`,
          `字段列表：${fieldList.join('、')}`,
          `字段上下文：\n${fieldContext}`,
          `用户输入：\n${String(brief || '').trim()}`,
          '请返回一个 JSON 对象，每个字段都要返回非空值。',
          '即使用户输入没有直接覆盖某个字段，也必须按上下文推断填入，后续用户可以自行修改。',
        ].join('\n\n'),
      },
    ],
  };
}

function compactContextLine(line, patterns) {
  if (line.length <= 520) return line;
  const firstIndex = patterns
    .map(pattern => line.search(pattern))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, firstIndex - 180);
  const end = Math.min(line.length, firstIndex + 340);
  return `${start > 0 ? '...' : ''}${line.slice(start, end)}${end < line.length ? '...' : ''}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
