const FIELD_PATTERN = /\{\{\s*([^{}\n]+?)\s*\}\}/g;
const LEGACY_FIELD_PATTERN = /\[\s*([^\[\]\n]+?)\s*\](?!\()/g;

const COLUMN_ALIASES = {
  category: ['category', '分类'],
  title: ['title', '标题', '名称', 'prompt名称', 'prompt_name'],
  description: ['description', '描述', '简介', '说明'],
  prompt: ['prompt', 'Prompt', 'prompt内容', 'Prompt内容', '正文', '内容'],
  tags: ['tags', '标签'],
  outputMode: ['output_mode', 'outputMode', '输出模式', '调用模式'],
  enabled: ['enabled', '启用', '是否启用'],
};

export function extractTemplateFields(prompt) {
  const fields = [];
  const seen = new Set();
  collectTemplateFields(String(prompt || ''), FIELD_PATTERN, fields, seen);
  collectTemplateFields(String(prompt || ''), LEGACY_FIELD_PATTERN, fields, seen);
  return fields;
}

export function fillPromptTemplate(prompt, values) {
  const replaceField = (_match, rawName) => {
    const name = String(rawName || '').trim();
    return values?.[name] ?? '';
  };
  return String(prompt || '')
    .replace(FIELD_PATTERN, replaceField)
    .replace(LEGACY_FIELD_PATTERN, replaceField);
}

function collectTemplateFields(prompt, pattern, fields, seen) {
  for (const match of prompt.matchAll(pattern)) {
    const name = match[1].trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    fields.push(name);
  }
}

export function moveItemById(items, sourceId, targetId) {
  if (sourceId === targetId) return Array.isArray(items) ? [...items] : [];
  const next = Array.isArray(items) ? [...items] : [];
  const sourceIndex = next.findIndex((item) => item?.id === sourceId);
  const targetIndex = next.findIndex((item) => item?.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return next;
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export function normalizeImportedPromptRows(rows) {
  return rows
    .map((row) => {
      const category = readColumn(row, 'category').trim();
      const title = readColumn(row, 'title').trim();
      const description = readColumn(row, 'description').trim();
      const prompt = readColumn(row, 'prompt').trim();
      if (isTemplateInstructionRow({ category, title, description, prompt })) return null;
      if (!category || !title || !prompt) return null;

      return {
        category,
        title,
        description,
        prompt,
        tags: splitTags(readColumn(row, 'tags')),
        outputMode: normalizeOutputMode(readColumn(row, 'outputMode')),
        enabled: normalizeEnabled(readColumn(row, 'enabled')),
        variables: extractTemplateFields(prompt),
      };
    })
    .filter(Boolean);
}

export function tableRowsToObjects(rows) {
  const normalizedRows = Array.isArray(rows?.[0]?.data) ? rows[0].data : rows;
  const [headerRow, ...dataRows] = normalizedRows || [];
  const headers = (headerRow || []).map((header) => String(header || '').trim());
  if (!headers.length) return [];

  return dataRows
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row?.[index] ?? ''])))
    .filter((row) => Object.values(row).some((value) => String(value || '').trim()));
}

export function parseCsvRows(text) {
  return tableRowsToObjects(parseCsv(text));
}

export function mergeImportedPromptRows({ categories, prompts, rows, now = Date.now() }) {
  const nextCategories = (categories || []).map((category) => ({ ...category }));
  const nextPrompts = Object.fromEntries(
    Object.entries(prompts || {}).map(([categoryId, list]) => [categoryId, Array.isArray(list) ? [...list] : []]),
  );
  const usedIds = new Set(nextCategories.map((category) => category.id));
  const categoryIdByLabel = new Map(
    nextCategories.map((category) => [String(category.label || '').toLowerCase(), category.id]),
  );

  (rows || []).forEach((row, index) => {
    const label = row.category;
    let categoryId = categoryIdByLabel.get(String(label || '').toLowerCase());
    if (!categoryId) {
      categoryId = createCategoryId(label, usedIds);
      nextCategories.push({ id: categoryId, label, visible: true });
      categoryIdByLabel.set(String(label || '').toLowerCase(), categoryId);
    }

    nextPrompts[categoryId] = [
      ...(nextPrompts[categoryId] || []),
      {
        id: now + index,
        title: row.title,
        description: row.description || '导入的 Prompt',
        prompt: row.prompt,
        tags: row.tags || [],
        outputMode: row.outputMode || 'copy',
        enabled: row.enabled !== false,
        variables: row.variables || extractTemplateFields(row.prompt),
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
  });

  return { categories: nextCategories, prompts: nextPrompts };
}

function isTemplateInstructionRow({ category, title, description, prompt }) {
  return (
    category.startsWith('填写所属分类') &&
    title.startsWith('填写 Prompt 名称') &&
    description.startsWith('一句话说明用途') &&
    prompt.startsWith('填写完整 Prompt')
  );
}

function readColumn(row, key) {
  const aliases = COLUMN_ALIASES[key] || [key];
  for (const alias of aliases) {
    if (row?.[alias] !== undefined && row?.[alias] !== null) {
      return String(row[alias]);
    }
  }

  const normalizedEntries = Object.entries(row || {}).map(([column, value]) => [
    normalizeColumnName(column),
    value,
  ]);
  for (const alias of aliases) {
    const found = normalizedEntries.find(([column]) => column === normalizeColumnName(alias));
    if (found?.[1] !== undefined && found?.[1] !== null) return String(found[1]);
  }
  return '';
}

function normalizeColumnName(name) {
  return String(name || '').replace(/\s|_|-/g, '').toLowerCase();
}

function splitTags(raw) {
  return String(raw || '')
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeOutputMode(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return ['copy', 'insert', 'ai'].includes(value) ? value : 'copy';
}

function normalizeEnabled(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return true;
  return !['false', '0', 'no', 'n', '否', '不启用', '停用'].includes(value);
}

function createCategoryId(label, usedIds) {
  const known = {
    coding: 'coding',
    自媒体: 'media',
    media: 'media',
    pm: 'pm',
    product: 'pm',
  };
  const raw = String(label || '').trim();
  const knownId = known[raw.toLowerCase()] || known[raw];
  let id = knownId || raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `cat_${usedIds.size + 1}`;
  let index = 2;
  const base = id;
  while (usedIds.has(id)) {
    id = `${base}_${index}`;
    index += 1;
  }
  usedIds.add(id);
  return id;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < String(text || '').length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => String(value || '').trim()));
}
