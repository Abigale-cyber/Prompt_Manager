const FIELD_PATTERN = /\{\s*\{\s*([^{}\n]+?)\s*\}\s*\}/g;
const LEGACY_FIELD_PATTERN = /\[\s*([^\[\]\n]+?)\s*\](?!\()/g;

const COLUMN_ALIASES = {
  category: ['category', '分类'],
  title: ['title', '标题', '名称', 'prompt名称', 'prompt_name'],
  description: ['description', '描述', '简介', '说明'],
  reusePrompt: ['reusePrompt', 'reuse_prompt', '复用Prompt', '复用 prompt', '复用提示词', '复用'],
  customPrompt: ['customPrompt', 'custom_prompt', '定制Prompt', '定制 prompt', '定制提示词', '自定义Prompt', '自定义提示词', '定制'],
  prompt: ['prompt', 'Prompt', 'prompt内容', 'Prompt内容', '正文', '内容'],
};

const CONTEXT_FIELD_NAMES = new Set([
  '上一步文件名',
  '上一步文件名称',
  '上一步文件',
  '上一步文档',
  '上一步内容',
  '上一步输出',
  '上一步结果',
  '上游文件名',
  '上游文件名称',
  '上游文档',
  '上游内容',
  '上游输出',
  '前置文件名',
  '前置文档',
  '前置输出',
]);

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

export function isContextTemplateField(field) {
  const normalized = String(field || '').replace(/\s+/g, '');
  if (CONTEXT_FIELD_NAMES.has(normalized)) return true;
  return /^(上一步|上游|前置|前一步|前序|上个Skill|上一Skill)/.test(normalized)
    && /(文件|文档|内容|输出|结果|名称|路径|资料)/.test(normalized);
}

export function extractManualTemplateFields(prompt) {
  return extractTemplateFields(prompt).filter((field) => !isContextTemplateField(field));
}

export function shouldOpenPromptFillDialog({ mode, template }) {
  if (mode !== 'custom') return false;
  return Boolean(String(template || '').trim());
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
      let reusePrompt = readColumn(row, 'reusePrompt').trim();
      let customPrompt = readColumn(row, 'customPrompt').trim();
      const legacyPrompt = readColumn(row, 'prompt').trim();
      if (isTemplateInstructionRow({ category, title, description, prompt: legacyPrompt, reusePrompt, customPrompt })) return null;

      if (!reusePrompt && !customPrompt && legacyPrompt) {
        if (extractManualTemplateFields(legacyPrompt).length > 0) {
          customPrompt = legacyPrompt;
        } else {
          reusePrompt = legacyPrompt;
        }
      }

      const prompt = customPrompt || reusePrompt;
      if (!category || !title || !prompt) return null;

      return {
        category,
        title,
        description,
        prompt,
        reusePrompt,
        customPrompt,
        variables: extractTemplateFields(customPrompt),
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

export function countImportedPromptConflicts({ categories, prompts, rows }) {
  const categoryIdByLabel = new Map(
    (categories || []).map((category) => [String(category.label || '').toLowerCase(), category.id]),
  );
  return (rows || []).filter((row) => {
    const categoryId = categoryIdByLabel.get(String(row.category || '').toLowerCase());
    if (!categoryId) return false;
    const normalizedTitle = normalizePromptTitle(row.title);
    return (prompts?.[categoryId] || []).some((prompt) => normalizePromptTitle(prompt.title) === normalizedTitle);
  }).length;
}

export function mergeImportedPromptRows({ categories, prompts, rows, now = Date.now(), duplicateStrategy = 'append' }) {
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

    const promptList = nextPrompts[categoryId] || [];
    const duplicateIndex = promptList.findIndex((prompt) => normalizePromptTitle(prompt.title) === normalizePromptTitle(row.title));
    if (duplicateIndex >= 0) {
      if (duplicateStrategy === 'skip') return;
      if (duplicateStrategy === 'replace') {
        const targetList = [...promptList];
        targetList[duplicateIndex] = createImportedPrompt(row, now + index, now, targetList[duplicateIndex]);
        nextPrompts[categoryId] = targetList;
        return;
      }
    }

    const nextRow = duplicateIndex >= 0 && duplicateStrategy === 'copy'
      ? { ...row, title: createPromptCopyTitle(row.title, promptList) }
      : row;
    nextPrompts[categoryId] = [
      ...promptList,
      createImportedPrompt(nextRow, now + index, now),
    ];
  });

  return { categories: nextCategories, prompts: nextPrompts };
}

function createImportedPrompt(row, id, now, existing) {
  return {
    ...existing,
    id: existing?.id ?? id,
    title: row.title,
    description: row.description || '导入的 Prompt',
    prompt: row.prompt,
    reusePrompt: row.reusePrompt || undefined,
    customPrompt: row.customPrompt || undefined,
    tags: row.tags || existing?.tags || [],
    outputMode: row.outputMode || existing?.outputMode || 'copy',
    enabled: row.enabled !== undefined ? row.enabled !== false : (existing?.enabled ?? true),
    variables: row.variables || extractTemplateFields(row.customPrompt || row.prompt),
    usageCount: existing?.usageCount ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function createPromptCopyTitle(title, prompts) {
  const baseTitle = String(title || '').trim() || '未命名 Prompt';
  const usedTitles = new Set((prompts || []).map((prompt) => normalizePromptTitle(prompt.title)));
  let copyTitle = `${baseTitle}（副本）`;
  let index = 2;
  while (usedTitles.has(normalizePromptTitle(copyTitle))) {
    copyTitle = `${baseTitle}（副本 ${index}）`;
    index += 1;
  }
  return copyTitle;
}

function isTemplateInstructionRow({ category, title, description, prompt, reusePrompt, customPrompt }) {
  return (
    category.startsWith('填写所属分类') &&
    title.startsWith('填写 Prompt 名称') &&
    description.startsWith('一句话说明用途') &&
    (
      prompt.startsWith('填写完整 Prompt') ||
      reusePrompt.startsWith('上下文充足时直接调用') ||
      customPrompt.startsWith('需要手动填写时使用')
    )
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

function normalizePromptTitle(title) {
  return String(title || '').trim().toLowerCase();
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
