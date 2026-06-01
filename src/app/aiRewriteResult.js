export function extractAIRewriteValues(content, fields) {
  const parsed = parseJSONContent(content);
  const source = findValueObject(parsed);
  const entries = Object.entries(source);

  return Object.fromEntries((fields || []).map((field) => {
    const value = findFieldValue(field, entries);
    return [field, value];
  }));
}

export function hasFilledAIRewriteValues(values) {
  return Object.values(values || {}).some(value => String(value || '').trim());
}

export function completeAIRewriteValues({ values = {}, fields = [], brief = '', title = '', template = '' }) {
  const context = buildInferenceContext({ brief, title, template });
  return Object.fromEntries((fields || []).map((field) => {
    const currentValue = cleanValue(values[field]);
    if (currentValue && !shouldReplaceWeakValue(field, currentValue, context)) {
      return [field, currentValue];
    }

    return [field, inferFieldValue(field, context)];
  }));
}

function parseJSONContent(content) {
  const trimmed = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    try {
      return match ? JSON.parse(match[0]) : {};
    } catch {
      return {};
    }
  }
}

function findValueObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const nestedKeys = ['fields', '字段', 'result', '结果', 'data', 'values'];
  for (const key of nestedKeys) {
    const nested = value[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested;
    }
  }
  return value;
}

function findFieldValue(field, entries) {
  const exact = entries.find(([key]) => key === field);
  if (exact) return cleanValue(exact[1]);

  const normalizedField = normalizeKey(field);
  const normalized = entries.find(([key]) => normalizeKey(key) === normalizedField);
  if (normalized) return cleanValue(normalized[1]);

  const partial = entries.find(([key]) => {
    const normalizedKey = normalizeKey(key);
    return normalizedKey.includes(normalizedField) || normalizedField.includes(normalizedKey);
  });
  return partial ? cleanValue(partial[1]) : '';
}

function normalizeKey(value) {
  return String(value || '')
    .replace(/[\s:："'“”‘’`，,。.;；()（）［\]\[\]{}【】《》<>]/g, '')
    .toLowerCase();
}

function cleanValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
}

function buildInferenceContext({ brief, title, template }) {
  const briefText = cleanValue(brief);
  const allText = [briefText, title, template].map(cleanValue).join(' ');
  const tokens = briefText.split(/[\s,，、;；。|/]+/).map(item => item.trim()).filter(Boolean);
  const compactBrief = tokens.join('') || briefText || cleanValue(title) || '当前主题';
  const domain = detectDomain(allText, tokens);
  const topic = detectTopic({ allText, tokens, compactBrief, domain });
  const platform = detectPlatform(allText);

  return {
    allText,
    briefText,
    compactBrief,
    domain,
    topic,
    platform,
    module: detectModule(allText, domain, topic),
  };
}

function detectDomain(allText, tokens) {
  if (/医美|痘坑|抗衰|水光|皮肤|祛斑|热玛吉|光子嫩肤|玻尿酸|美容|整形/.test(allText)) return '医美';
  if (/创业|获客|商业|复盘/.test(allText)) return '创业';
  if (/成长|长期主义|认知|自律|个人/.test(allText)) return '个人成长';
  return tokens[0] || '';
}

function detectTopic({ allText, tokens, compactBrief, domain }) {
  if (/痘坑/.test(allText)) return '痘坑';
  if (/长期主义/.test(allText) && /个人成长|成长/.test(allText)) return '长期主义个人成长';
  const meaningfulTokens = tokens.filter(token => token !== domain && token !== '医美');
  return meaningfulTokens.join('') || compactBrief || domain || '当前主题';
}

function detectPlatform(allText) {
  if (/小红书/.test(allText)) return '小红书';
  if (/视频号/.test(allText)) return '视频号';
  if (/公众号|微信/.test(allText)) return '公众号';
  if (/抖音/.test(allText)) return '抖音';
  if (/知乎/.test(allText)) return '知乎';
  return '小红书';
}

function detectModule(allText, domain, topic) {
  if (domain === '医美') return '医美科普';
  if (/创业|获客|商业|复盘/.test(allText)) return '创业经验';
  if (/成长|长期主义|认知|自律/.test(allText)) return '个人成长心得';
  return `${topic}科普`;
}

function shouldReplaceWeakValue(field, value, context) {
  const normalizedField = normalizeKey(field);
  const normalizedValue = normalizeKey(value);
  if (!normalizedValue || /未知|未提供|待补充|null|none|空/.test(normalizedValue)) return true;

  if ((normalizedField.includes('账号模式') || normalizedField.includes('账号定位')) &&
      [context.domain, context.topic, context.compactBrief].map(normalizeKey).includes(normalizedValue)) {
    return true;
  }
  if ((normalizedField.includes('内容模块') || normalizedField.includes('发布平台')) &&
      [context.domain, context.topic].map(normalizeKey).includes(normalizedValue)) {
    return true;
  }
  return false;
}

function inferFieldValue(field, context) {
  const normalizedField = normalizeKey(field);
  const topic = context.topic || context.compactBrief || '当前主题';
  const compact = context.compactBrief || topic;

  if (normalizedField.includes('账号模式') || normalizedField.includes('账号定位')) {
    return context.domain === '医美' ? '医美科普个人IP' : '个人IP';
  }
  if (normalizedField.includes('发布平台') || normalizedField === '平台') {
    return context.platform;
  }
  if (normalizedField.includes('内容模块') || normalizedField.includes('内容方向') || normalizedField === '模块') {
    return context.module;
  }
  if (normalizedField.includes('主题方向') || normalizedField === '主题' || normalizedField === '方向') {
    return topic;
  }
  if (normalizedField.includes('已有资料') || normalizedField.includes('资料依据') || normalizedField === '资料') {
    return context.domain === '医美'
      ? `${compact}相关经验、案例观察和公开科普资料`
      : `${compact}相关资料、个人经验和案例观察`;
  }
  if (normalizedField.includes('客户问题') || normalizedField.includes('客户案例') || normalizedField.includes('案例')) {
    return context.domain === '医美'
      ? `用户关心${topic}成因、改善方式、恢复周期、费用和风险边界`
      : `用户围绕${topic}的真实疑问、常见误区和决策难点`;
  }
  if (normalizedField.includes('核心判断') || normalizedField.includes('核心观点') || normalizedField === '判断') {
    return `${topic}内容应以理性科普和风险提示为主，先建立认知，再给出选择建议`;
  }
  if (normalizedField.includes('风险边界') || normalizedField.includes('合规') || normalizedField.includes('风险')) {
    return context.domain === '医美'
      ? '不承诺具体医疗效果，不引导过度消费，不发布违规医美广告内容'
      : '不夸大效果，不制造焦虑，不替代专业判断';
  }
  if (normalizedField.includes('目标用户') || normalizedField.includes('目标受众') || normalizedField === '用户') {
    return `关注${compact}并需要实用建议的用户`;
  }
  if (normalizedField.includes('内容形式') || normalizedField === '形式') {
    return context.platform === '小红书' ? '图文笔记' : '图文内容';
  }
  if (normalizedField.includes('优先选题') || normalizedField === '选题') {
    return `${compact}避坑指南`;
  }
  if (normalizedField.includes('输出数量') || normalizedField.includes('数量')) {
    return '5 个候选选题，推荐 Top 3';
  }

  return `${topic}相关${field}`;
}
