import { useState, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import { Search, Sparkles, Code2, Megaphone, ClipboardList, Folder, Rows3, Columns2, Send, Settings, X, Check, Plus, Pencil, Trash2, Undo2, ChevronDown, ChevronUp } from 'lucide-react';
import { buildPromptTemplateRows, createPromptWorkbookBlob } from './promptExcel.js';
import { extractTemplateFields, fillPromptTemplate, mergeImportedPromptRows, moveItemById, normalizeImportedPromptRows, parseCsvRows, tableRowsToObjects } from './promptTemplate.js';
import appIconUrl from '../../tools/prompt-manager-mac/Assets/PromptManager.svg';

type Prompt = {
  id: number;
  title: string;
  description: string;
  prompt: string;
  tags?: string[];
  outputMode?: 'copy' | 'insert' | 'ai';
  enabled?: boolean;
  variables?: string[];
  usageCount?: number;
  createdAt?: number;
  updatedAt?: number;
};
type Category = { id: string; label: string; icon: any; visible: boolean };
type Layout = 'one' | 'two';
type StoredCategory = { id: string; label: string; visible: boolean };
type AIProviderConfig = { model: string; apiKey: string; baseUrl: string };
type StoredState = {
  categories?: StoredCategory[];
  prompts?: Record<string, Prompt[]>;
  layout?: Layout;
  aiEnabled?: boolean;
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  providerConfigs?: Record<string, AIProviderConfig>;
  lastRewriteValues?: Record<string, Record<string, string>>;
};
type ImportedPrompt = {
  category: string;
  title: string;
  description: string;
  prompt: string;
  tags: string[];
  outputMode: 'copy' | 'insert' | 'ai';
  enabled: boolean;
  variables: string[];
};
type ChatCompletionPayload = {
  model: string;
  temperature: number;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
};
type NativeAIResult = {
  requestId: string;
  ok: boolean;
  status?: number;
  body?: string;
  message?: string;
};

const initialCategories: Category[] = [
  { id: 'coding', label: 'Coding', icon: Code2, visible: true },
  { id: 'media',  label: '自媒体', icon: Megaphone, visible: true },
  { id: 'pm',     label: 'PM',     icon: ClipboardList, visible: true },
];

const initialPrompts: Record<string, Prompt[]> = {
  coding: [
    { id: 1, title: "代码重构助手", description: "帮助重构代码，提升代码质量和可维护性",
      prompt: "请帮我重构以下代码，要求：1. 提升可读性 2. 优化性能 3. 遵循最佳实践\n\n代码：\n[在此粘贴代码]" },
    { id: 2, title: "Bug 调试专家", description: "快速定位和修复代码中的问题",
      prompt: "我遇到了一个 bug，请帮我分析原因并提供解决方案：\n\n问题描述：[描述问题]\n错误信息：[粘贴错误]\n相关代码：[粘贴代码]" },
    { id: 3, title: "API 文档生成", description: "自动生成清晰的 API 文档",
      prompt: "请为以下 API 生成详细的文档，包括：参数说明、返回值、示例代码、注意事项\n\nAPI 代码：\n[粘贴 API 代码]" },
    { id: 4, title: "单元测试编写", description: "生成全面的单元测试用例",
      prompt: "请为以下函数/组件编写完整的单元测试，覆盖边界情况和异常场景：\n\n代码：\n[粘贴代码]" },
  ],
  media: [
    { id: 5, title: "小红书爆款标题", description: "生成吸引人的小红书标题",
      prompt: "请为以下内容生成 10 个小红书风格的标题，要求：\n1. 包含emoji\n2. 激发好奇心\n3. 突出价值点\n\n内容主题：[描述主题]" },
    { id: 6, title: "视频脚本创作", description: "创作短视频脚本和分镜",
      prompt: "请为以下主题创作一个 60 秒短视频脚本，包括：\n1. 开场吸引\n2. 内容展开\n3. 行动号召\n\n主题：[输入主题]" },
    { id: 7, title: "公众号推文优化", description: "优化公众号文章，提升阅读体验",
      prompt: "请优化以下公众号文章，要求：\n1. 提升标题吸引力\n2. 优化段落结构\n3. 增加金句\n4. 调整语气更亲和\n\n原文：\n[粘贴原文]" },
  ],
  pm: [
    { id: 8, title: "需求文档生成", description: "快速生成规范的 PRD 文档",
      prompt: "请根据以下信息生成产品需求文档(PRD)：\n\n产品概述：[描述产品]\n目标用户：[用户画像]\n核心功能：[列出功能]\n\n请包含：背景、目标、用户故事、功能清单、交互说明" },
    { id: 9, title: "用户故事拆解", description: "将需求拆解为可执行的用户故事",
      prompt: "请将以下需求拆解为用户故事，使用格式：作为[角色]，我想要[功能]，以便[价值]\n\n需求描述：[输入需求]" },
    { id: 10, title: "竞品分析报告", description: "生成结构化的竞品分析",
      prompt: "请对以下产品进行竞品分析：\n\n我的产品：[产品描述]\n竞品：[竞品名称]\n\n请从以下维度分析：\n1. 核心功能对比\n2. 用户体验\n3. 商业模式\n4. 优劣势\n5. 差异化机会" },
    { id: 11, title: "功能优先级评估", description: "使用 RICE 模型评估功能优先级",
      prompt: "请使用 RICE 模型（Reach, Impact, Confidence, Effort）评估以下功能的优先级：\n\n功能列表：\n[列出功能]" },
  ],
};

const PROVIDERS = [
  { id: 'openai',    label: 'OpenAI',    placeholder: 'gpt-4o-mini' },
  { id: 'anthropic', label: 'Anthropic', placeholder: 'claude-sonnet-4' },
  { id: 'deepseek',  label: 'DeepSeek',  placeholder: 'deepseek-v4-pro' },
  { id: 'custom',    label: '自定义',     placeholder: 'model-name' },
];

const createDefaultProviderConfigs = () => Object.fromEntries(
  PROVIDERS.map(provider => [provider.id, { model: '', apiKey: '', baseUrl: '' }]),
) as Record<string, AIProviderConfig>;

const inferLegacyProvider = (stored: StoredState) => {
  const baseUrl = String(stored.baseUrl || '').toLowerCase();
  if (baseUrl.includes('deepseek')) return 'deepseek';
  if (baseUrl.includes('anthropic')) return 'anthropic';
  return stored.provider || 'openai';
};

const restoreProviderConfigs = (stored: StoredState) => {
  const next = createDefaultProviderConfigs();
  if (stored.providerConfigs && typeof stored.providerConfigs === 'object') {
    Object.entries(stored.providerConfigs).forEach(([id, config]) => {
      if (!next[id]) return;
      next[id] = {
        model: config?.model || '',
        apiKey: config?.apiKey || '',
        baseUrl: config?.baseUrl || '',
      };
    });
    return next;
  }

  if (stored.model || stored.apiKey || stored.baseUrl) {
    const providerId = inferLegacyProvider(stored);
    if (next[providerId]) {
      next[providerId] = {
        model: stored.provider === providerId ? (stored.model || '') : '',
        apiKey: stored.apiKey || '',
        baseUrl: stored.baseUrl || '',
      };
    }
  }
  return next;
};

const STORAGE_KEY = 'prompt-management-tool:v1';

const categoryIconFor = (id: string) => {
  if (id === 'coding') return Code2;
  if (id === 'media') return Megaphone;
  if (id === 'pm') return ClipboardList;
  return Folder;
};

const readStoredState = (): StoredState => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const restoreCategories = (stored?: StoredCategory[]) => {
  if (!stored?.length) return initialCategories;
  return stored.map((category) => ({
    ...category,
    icon: categoryIconFor(category.id),
  }));
};

const normalizePrompts = (stored?: Record<string, Prompt[]>) => {
  if (!stored || typeof stored !== 'object') return initialPrompts;
  return stored;
};

const parseImportedTable = async (file: File) => {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return parseCsvRows(await file.text()) as Record<string, unknown>[];
  }

  const readXlsxFile = (await import('read-excel-file/browser')).default;
  const rows = await readXlsxFile(file);
  return tableRowsToObjects(rows) as Record<string, unknown>[];
};

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    resolve(result.includes(',') ? result.split(',')[1] : result);
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

const categoriesWithIcons = (items: Category[]) => items.map(category => ({
  ...category,
  icon: categoryIconFor(category.id),
}));

const findCategoryIdByLabel = (items: { id: string; label: string }[], label: string) => (
  items.find(category => category.label.toLowerCase() === label.toLowerCase())?.id
);

const defaultAIBaseUrl = (provider: string) => {
  if (provider === 'deepseek') return 'https://api.deepseek.com';
  if (provider === 'openai') return 'https://api.openai.com/v1';
  return '';
};

const chatCompletionEndpoint = (provider: string, baseUrl: string) => {
  const root = (baseUrl.trim() || defaultAIBaseUrl(provider)).replace(/\/+$/, '');
  if (!root) return '';
  return root.endsWith('/chat/completions') ? root : `${root}/chat/completions`;
};

const modelForProvider = (provider: string, model: string) => {
  const trimmed = model.trim();
  const compact = trimmed.toLowerCase().replace(/\s+/g, '');
  if (provider === 'deepseek' && compact === 'deepseek-4.0pro') return 'deepseek-v4-pro';
  if (provider === 'deepseek' && compact === 'deepseek-4.0flash') return 'deepseek-v4-flash';
  return trimmed;
};

const promptHistoryKey = (prompt: Prompt, categoryId: string) => `${categoryId}:${prompt.id}`;

const parseJSONObject = (content: string) => {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
};

const parseAIErrorBody = (body: string) => {
  const trimmed = body.trim();
  if (!trimmed) return '';
  try {
    const data = JSON.parse(trimmed);
    return String(data?.error?.message || data?.message || trimmed);
  } catch {
    return trimmed;
  }
};

const formatHTTPError = (status: number | undefined, body: string) => {
  const message = parseAIErrorBody(body);
  const prefix = status ? `HTTP ${status}` : '请求失败';
  return message ? `${prefix}：${message}` : prefix;
};

const parseAIResponseJSON = (body: string, status?: number) => {
  const trimmed = body.trim();
  if (!trimmed) throw new Error(status ? `接口返回空内容（HTTP ${status}）` : '接口返回空内容');
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(status ? `接口返回不是 JSON（HTTP ${status}）` : '接口返回不是 JSON');
  }
};

const formatAIErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '请求失败');
  return message.length > 80 ? `${message.slice(0, 77)}...` : message;
};

const requestNativeChatCompletion = (
  endpoint: string,
  apiKey: string,
  body: ChatCompletionPayload,
) => new Promise<unknown>((resolve, reject) => {
  const handler = (window as any).webkit?.messageHandlers?.aiChatCompletion;
  if (!handler) {
    reject(new Error('当前环境不支持原生 AI 请求'));
    return;
  }

  const requestId = `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const cleanup = () => {
    window.clearTimeout(timeoutId);
    window.removeEventListener('prompt-manager-ai-result', onResult);
  };
  const onResult = (event: Event) => {
    const detail = (event as CustomEvent<NativeAIResult>).detail;
    if (!detail || detail.requestId !== requestId) return;

    cleanup();
    if (!detail.ok) {
      reject(new Error(detail.body ? formatHTTPError(detail.status, detail.body) : (detail.message || 'AI 请求失败')));
      return;
    }
    try {
      resolve(parseAIResponseJSON(detail.body || '', detail.status));
    } catch (error) {
      reject(error);
    }
  };
  const timeoutId = window.setTimeout(() => {
    cleanup();
    reject(new Error('AI 请求超时'));
  }, 60000);

  window.addEventListener('prompt-manager-ai-result', onResult);
  try {
    handler.postMessage({ requestId, endpoint, apiKey: apiKey.trim(), body });
  } catch (error) {
    cleanup();
    reject(error);
  }
});

const requestChatCompletion = async (
  endpoint: string,
  apiKey: string,
  body: ChatCompletionPayload,
) => {
  if ((window as any).webkit?.messageHandlers?.aiChatCompletion) {
    return requestNativeChatCompletion(endpoint, apiKey, body);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(formatHTTPError(response.status, text));
  return parseAIResponseJSON(text, response.status);
};

export default function App() {
  const storedState = readStoredState();
  const [categories, setCategories] = useState<Category[]>(() => restoreCategories(storedState.categories));
  const [prompts, setPrompts] = useState<Record<string, Prompt[]>>(() => normalizePrompts(storedState.prompts));
  const [activeTab, setActiveTab] = useState<string>('coding');
  const [searchQuery, setSearchQuery] = useState('');
  const [layout, setLayout] = useState<Layout>(storedState.layout === 'one' ? 'one' : 'two');
  const [calledId, setCalledId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [tabsOverflowing, setTabsOverflowing] = useState(false);
  const [tabsExpanded, setTabsExpanded] = useState(false);
  const [draggingPromptId, setDraggingPromptId] = useState<number | null>(null);
  const [dragOverPromptId, setDragOverPromptId] = useState<number | null>(null);
  const [promptDragActive, setPromptDragActive] = useState(false);
  const [promptDragOffset, setPromptDragOffset] = useState({ x: 0, y: 0 });
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const draggingCategoryIdRef = useRef<string | null>(null);
  const draggingPromptIdRef = useRef<number | null>(null);
  const promptDragStartRef = useRef({ x: 0, y: 0 });
  const suppressCategoryClickRef = useRef(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addPromptOpen, setAddPromptOpen] = useState(false);
  const [callPromptOpen, setCallPromptOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(activeTab);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [aiRewriteInput, setAiRewriteInput] = useState('');
  const [aiRewriting, setAiRewriting] = useState(false);
  const [rewriteHistory, setRewriteHistory] = useState<Record<string, string>[]>([]);
  const [rewriteHistoryIndex, setRewriteHistoryIndex] = useState(-1);
  const [lastRewriteValues, setLastRewriteValues] = useState<Record<string, Record<string, string>>>(() => storedState.lastRewriteValues || {});

  const [aiEnabled, setAiEnabled] = useState(Boolean(storedState.aiEnabled));
  const [provider, setProvider] = useState(storedState.providerConfigs ? (storedState.provider || 'openai') : inferLegacyProvider(storedState));
  const [providerConfigs, setProviderConfigs] = useState<Record<string, AIProviderConfig>>(() => restoreProviderConfigs(storedState));
  const [callProvider, setCallProvider] = useState('');
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);

  // add prompt form
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formCategory, setFormCategory] = useState(activeTab);
  const currentProviderConfig = providerConfigs[provider] || createDefaultProviderConfigs()[provider] || { model: '', apiKey: '', baseUrl: '' };
  const configuredProviders = PROVIDERS.filter(item => providerConfigs[item.id]?.apiKey.trim());
  const activeCallProvider = callProvider || configuredProviders[0]?.id || provider;
  const activeCallConfig = providerConfigs[activeCallProvider] || currentProviderConfig;

  useEffect(() => {
    const cur = categories.find(c => c.id === activeTab && c.visible);
    if (!cur) {
      const next = categories.find(c => c.visible);
      if (next) setActiveTab(next.id);
    }
  }, [categories, activeTab]);

  useEffect(() => {
    const state: StoredState = {
      categories: categories.map(({ id, label, visible }) => ({ id, label, visible })),
      prompts,
      layout,
      aiEnabled,
      provider,
      providerConfigs,
      lastRewriteValues,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [categories, prompts, layout, aiEnabled, provider, providerConfigs, lastRewriteValues]);

  useEffect(() => {
    if (!configuredProviders.length) {
      setCallProvider('');
      return;
    }
    if (!configuredProviders.some(item => item.id === callProvider)) {
      setCallProvider(configuredProviders[0].id);
    }
  }, [configuredProviders, callProvider]);

  useEffect(() => {
    const list = tabListRef.current;
    if (!list) return;

    const updateOverflow = () => {
      setTabsOverflowing(categories.filter(category => category.visible).length > 4);
    };

    updateOverflow();
    window.addEventListener('resize', updateOverflow);
    const ResizeObserverCtor = window.ResizeObserver;
    const observer = ResizeObserverCtor ? new ResizeObserverCtor(updateOverflow) : null;
    observer?.observe(list);
    return () => {
      window.removeEventListener('resize', updateOverflow);
      observer?.disconnect();
    };
  }, [categories]);

  useEffect(() => {
    if (!tabsOverflowing) setTabsExpanded(false);
  }, [tabsOverflowing]);

  useEffect(() => {
    if (!promptDragActive) return;
    const previousUserSelect = document.body.style.userSelect;
    const previousWebkitUserSelect = document.body.style.webkitUserSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.cursor = 'grabbing';
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.webkitUserSelect = previousWebkitUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [promptDragActive]);

  useEffect(() => {
    const onExportResult = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) showToast(detail.message);
    };
    window.addEventListener('prompt-manager-export-result', onExportResult);
    return () => window.removeEventListener('prompt-manager-export-result', onExportResult);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const undoLastCall = () => {
    if (rewriteHistory.length > 0 && rewriteHistoryIndex > 0) {
      const nextIndex = rewriteHistoryIndex - 1;
      setRewriteHistoryIndex(nextIndex);
      setTemplateValues(prev => ({ ...prev, ...rewriteHistory[nextIndex] }));
      showToast('已恢复上一次 AI 改写');
      return;
    }

    const lastValues = selectedPrompt ? lastRewriteValues[promptHistoryKey(selectedPrompt, selectedCategoryId)] : undefined;
    if (!lastValues || Object.values(lastValues).every(value => !value.trim())) {
      showToast('没有上一次 AI 改写');
      return;
    }

    setTemplateValues(prev => ({ ...prev, ...lastValues }));
    setRewriteHistory([lastValues]);
    setRewriteHistoryIndex(0);
    showToast('已恢复上一次 AI 改写');
  };

  const finishCall = async (prompt: string, id: number, categoryId = activeTab) => {
    setCalledId(id);
    setTimeout(() => setCalledId(null), 1200);
    setPrompts(prev => ({
      ...prev,
      [categoryId]: (prev[categoryId] || []).map(item =>
        item.id === id ? { ...item, usageCount: (item.usageCount || 0) + 1, updatedAt: Date.now() } : item
      ),
    }));
    const webkit = (window as any).webkit;
    const sourcePrompt = (prompts[categoryId] || []).find(item => item.id === id);
    if (webkit?.messageHandlers?.usePrompt) {
      webkit.messageHandlers.usePrompt.postMessage({
        id,
        title: sourcePrompt?.title || 'Prompt',
        description: sourcePrompt?.description || '',
        prompt,
        categoryId,
        ai: aiEnabled ? {
          provider: activeCallProvider,
          model: activeCallConfig.model || PROVIDERS.find(item => item.id === activeCallProvider)?.placeholder || '',
          apiKey: activeCallConfig.apiKey,
          baseUrl: activeCallConfig.baseUrl,
        } : undefined,
      });
      showToast('Prompt 已调用');
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      showToast('Prompt 已复制');
    } catch { showToast('调用失败'); }
  };

  const handleCall = async (prompt: Prompt, categoryId = activeTab) => {
    const fields = extractTemplateFields(prompt.prompt);
    if (fields.length > 0) {
      setSelectedPrompt(prompt);
      setSelectedCategoryId(categoryId);
      setTemplateValues(Object.fromEntries(fields.map(field => [field, ''])));
      setAiRewriteInput('');
      setRewriteHistory([]);
      setRewriteHistoryIndex(-1);
      setCallPromptOpen(true);
      return;
    }
    await finishCall(prompt.prompt, prompt.id, categoryId);
  };

  const rewriteTemplateWithAI = async () => {
    if (!selectedPrompt) return;
    const fields = extractTemplateFields(selectedPrompt.prompt);
    const brief = aiRewriteInput.trim();
    if (!brief) {
      showToast('请先输入要改写的关键词或句子');
      return;
    }
    if (!activeCallConfig.apiKey.trim()) {
      showToast('请先在设置里配置 API Key');
      return;
    }
    const endpoint = chatCompletionEndpoint(activeCallProvider, activeCallConfig.baseUrl);
    if (!endpoint) {
      showToast('请先配置兼容 /chat/completions 的 Base URL');
      return;
    }

    setAiRewriting(true);
    try {
      const rawModel = activeCallConfig.model || PROVIDERS.find(item => item.id === activeCallProvider)?.placeholder || '';
      const data = await requestChatCompletion(endpoint, activeCallConfig.apiKey, {
        model: modelForProvider(activeCallProvider, rawModel),
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: [
              '你是 Prompt 优化大师，擅长把用户的关键词或短句改写成可直接填入 Prompt 模板字段的内容。',
              '你要基于原始输入材料、Prompt 名称、完整模板和字段名，判断每个字段真正需要的信息。',
              '输出要简洁、直白、具体，避免空话、套话和过度包装。',
              '字段值只能写最终要填入模板的内容，不要在字段值里添加“用户输入：”“选题来源：”“主题：”等说明性前缀。',
              '不要复述字段名，不要解释生成过程，不要 Markdown。',
              '只输出 JSON 对象。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `Prompt 名称：${selectedPrompt.title}`,
              `需要填写的字段：${fields.join('、')}`,
              `完整模板：\n${selectedPrompt.prompt}`,
              `原始输入材料：\n${brief}`,
              '请返回一个 JSON 对象，key 必须使用上面的字段名，value 是适合填入该字段的中文内容。每个字段都要返回。',
              'value 里不要出现“用户输入：”“原始输入材料：”“字段名：”这类标签，只写内容本身。',
            ].join('\n\n'),
          },
        ],
      });
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('empty response');
      const parsed = parseJSONObject(String(content));
      const nextValues = Object.fromEntries(fields.map(field => [field, String(parsed[field] || '').trim()]));
      const baseHistory = rewriteHistoryIndex >= 0 ? rewriteHistory.slice(0, rewriteHistoryIndex + 1) : [];
      const nextHistory = [...baseHistory, nextValues];
      setRewriteHistory(nextHistory);
      setRewriteHistoryIndex(nextHistory.length - 1);
      setLastRewriteValues(prev => ({ ...prev, [promptHistoryKey(selectedPrompt, selectedCategoryId)]: nextValues }));
      setTemplateValues(prev => ({ ...prev, ...nextValues }));
      showToast('AI 已改写并填入');
    } catch (error) {
      console.error(error);
      showToast(`AI 改写失败：${formatAIErrorMessage(error)}`);
    } finally {
      setAiRewriting(false);
    }
  };

  const submitTemplateCall = async () => {
    if (!selectedPrompt) return;
    const fields = extractTemplateFields(selectedPrompt.prompt);
    const missingField = fields.find(field => !templateValues[field]?.trim());
    if (missingField) {
      showToast(`请填写：${missingField}`);
      return;
    }
    await finishCall(fillPromptTemplate(selectedPrompt.prompt, templateValues), selectedPrompt.id, selectedCategoryId);
    setCallPromptOpen(false);
    setSelectedPrompt(null);
    setSelectedCategoryId(activeTab);
    setTemplateValues({});
    setRewriteHistory([]);
    setRewriteHistoryIndex(-1);
  };

  const importPromptFile = async (file: File) => {
    try {
      const isJson = file.name.toLowerCase().endsWith('.json');
      if (isJson) {
        const parsed = JSON.parse(await file.text()) as StoredState | Record<string, unknown>[];
        if (Array.isArray(parsed)) {
          const importedRows = normalizeImportedPromptRows(parsed) as ImportedPrompt[];
          if (!importedRows.length) {
            showToast('导入失败：未找到有效的 Prompt 行');
            return;
          }
          const next = mergeImportedPromptRows({ categories, prompts, rows: importedRows });
          setCategories(categoriesWithIcons(next.categories as Category[]));
          setPrompts(next.prompts as Record<string, Prompt[]>);
          setActiveTab(findCategoryIdByLabel(next.categories, importedRows[0].category) || activeTab);
          showToast(`已新增 ${importedRows.length} 条 Prompt`);
          return;
        }
        const nextCategories = restoreCategories(parsed.categories);
        const nextPrompts = normalizePrompts(parsed.prompts);
        setCategories(nextCategories);
        setPrompts(nextPrompts);
        const firstVisible = nextCategories.find(category => category.visible);
        if (firstVisible) setActiveTab(firstVisible.id);
        showToast(`已导入：${file.name}`);
      } else {
        const importedRows = normalizeImportedPromptRows(await parseImportedTable(file)) as ImportedPrompt[];
        if (!importedRows.length) {
          showToast('导入失败：表格需包含 category/title/prompt 列');
          return;
        }
        const next = mergeImportedPromptRows({ categories, prompts, rows: importedRows });
        setCategories(categoriesWithIcons(next.categories as Category[]));
        setPrompts(next.prompts as Record<string, Prompt[]>);
        setActiveTab(findCategoryIdByLabel(next.categories, importedRows[0].category) || activeTab);
        showToast(`已新增 ${importedRows.length} 条 Prompt`);
      }
    } catch {
      showToast('导入失败，请检查文件格式和表头');
    }
  };

  const importNativeFilePayload = async (detail: { filename?: string; base64?: string }) => {
    try {
      if (!detail?.base64 || !detail?.filename) {
        showToast('导入失败：文件数据无效');
        return;
      }
      const binary = atob(detail.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const lowerName = detail.filename.toLowerCase();
      const type = lowerName.endsWith('.xlsx')
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : lowerName.endsWith('.xls')
          ? 'application/vnd.ms-excel'
          : lowerName.endsWith('.csv')
            ? 'text/csv'
            : lowerName.endsWith('.json')
              ? 'application/json'
              : 'application/octet-stream';
      const blob = new Blob([bytes], { type });
      await importPromptFile(Object.assign(blob, { name: detail.filename }) as File);
    } catch {
      showToast('导入失败，请检查文件格式和表头');
    }
  };

  const handleImport = () => {
    const webkit = (window as any).webkit;
    if (webkit?.messageHandlers?.importFile) {
      (window as any).__promptManagerImportFile = importNativeFilePayload;
      webkit.messageHandlers.importFile.postMessage({});
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.xlsx,.xls,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await importPromptFile(file);
    };
    input.click();
  };
  const handleExport = async () => {
    const rows = buildPromptTemplateRows();
    const blob = createPromptWorkbookBlob(rows);
    const filename = `prompt-library-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const webkit = (window as any).webkit;

    if (webkit?.messageHandlers?.exportExcel) {
      const base64 = await blobToBase64(blob);
      webkit.messageHandlers.exportExcel.postMessage({ filename, base64 });
      showToast('请选择 Excel 保存位置');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    showToast('已导出 Excel');
  };

  const openAddPrompt = () => {
    setFormTitle(''); setFormDesc(''); setFormPrompt(''); setFormCategory(activeTab);
    setEditingPromptId(null);
    setAddPromptOpen(true);
  };

  const openEditPrompt = (prompt: Prompt) => {
    setFormTitle(prompt.title);
    setFormDesc(prompt.description);
    setFormPrompt(prompt.prompt);
    setFormCategory(activeTab);
    setEditingPromptId(prompt.id);
    setAddPromptOpen(true);
  };

  const submitPromptForm = () => {
    if (!formTitle.trim() || !formPrompt.trim()) {
      showToast('请填写标题和 Prompt 内容');
      return;
    }
    if (editingPromptId) {
      setPrompts(prev => {
        const next = { ...prev };
        const existing = Object.values(next).flat().find(prompt => prompt.id === editingPromptId);
        Object.keys(next).forEach(categoryId => {
          next[categoryId] = next[categoryId].filter(prompt => prompt.id !== editingPromptId);
        });
        const updated: Prompt = {
          ...existing,
          id: editingPromptId,
          title: formTitle.trim(),
          description: formDesc.trim() || '自定义 Prompt',
          prompt: formPrompt.trim(),
          updatedAt: Date.now(),
        };
        next[formCategory] = [...(next[formCategory] || []), updated];
        return next;
      });
      showToast('已保存 Prompt');
    } else {
      const now = Date.now();
      const newP: Prompt = { id: now, title: formTitle.trim(),
        description: formDesc.trim() || '自定义 Prompt', prompt: formPrompt.trim(), usageCount: 0, createdAt: now, updatedAt: now };
      setPrompts(prev => ({ ...prev, [formCategory]: [...(prev[formCategory] || []), newP] }));
      showToast('已添加新 Prompt');
    }
    setAddPromptOpen(false);
    setActiveTab(formCategory);
  };

  const deletePrompt = (id: number) => {
    const ok = window.confirm('确定删除这个 Prompt 吗？');
    if (!ok) return;
    setPrompts(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter(prompt => prompt.id !== id),
    }));
    showToast('已删除 Prompt');
  };

  const updateCategory = (id: string, patch: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };
  const updateProviderConfig = (id: string, patch: Partial<AIProviderConfig>) => {
    setProviderConfigs(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || createDefaultProviderConfigs()[id] || { model: '', apiKey: '', baseUrl: '' }),
        ...patch,
      },
    }));
  };
  const addCategory = () => {
    const id = 'cat_' + Date.now();
    setCategories(prev => [...prev, { id, label: '新分类', icon: Folder, visible: true }]);
    setPrompts(prev => ({ ...prev, [id]: [] }));
  };
  const deleteCategory = (id: string) => {
    if (categories.length <= 1) { showToast('至少保留一个分类'); return; }
    setCategories(prev => prev.filter(c => c.id !== id));
    setPrompts(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const reorderCategories = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setCategories(prev => {
      const sourceIndex = prev.findIndex(category => category.id === sourceId);
      const targetIndex = prev.findIndex(category => category.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setActiveTab(sourceId);
    showToast('分类顺序已更新');
  };

  const getCategoryIdAtPoint = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y);
    if (!(target instanceof HTMLElement)) return null;
    return target.closest<HTMLElement>('[data-category-tab-id]')?.dataset.categoryTabId || null;
  };

  const clearCategoryDrag = () => {
    draggingCategoryIdRef.current = null;
    setDraggingCategoryId(null);
    setDragOverCategoryId(null);
  };

  const handleCategoryPointerDown = (event: PointerEvent<HTMLButtonElement>, categoryId: string) => {
    if (event.button !== 0) return;
    draggingCategoryIdRef.current = categoryId;
    setDraggingCategoryId(categoryId);
    setDragOverCategoryId(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCategoryPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const sourceId = draggingCategoryIdRef.current;
    if (!sourceId) return;
    const targetId = getCategoryIdAtPoint(event.clientX, event.clientY);
    setDragOverCategoryId(targetId && targetId !== sourceId ? targetId : null);
    if (targetId && targetId !== sourceId) suppressCategoryClickRef.current = true;
  };

  const handleCategoryPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const sourceId = draggingCategoryIdRef.current;
    const targetId = getCategoryIdAtPoint(event.clientX, event.clientY);
    if (sourceId && targetId && sourceId !== targetId) reorderCategories(sourceId, targetId);
    clearCategoryDrag();
  };

  const handleCategoryClickCapture = (event: MouseEvent<HTMLButtonElement>) => {
    if (!suppressCategoryClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressCategoryClickRef.current = false;
  };

  const getPromptIdAtPoint = (x: number, y: number, excludeId?: number) => {
    const targets = document.elementsFromPoint(x, y);
    for (const target of targets) {
      if (!(target instanceof HTMLElement)) continue;
      const value = target.closest<HTMLElement>('[data-prompt-card-id]')?.dataset.promptCardId;
      if (!value) continue;
      const promptId = Number(value);
      if (promptId !== excludeId) return promptId;
    }
    return null;
  };

  const clearPromptDrag = () => {
    draggingPromptIdRef.current = null;
    setDraggingPromptId(null);
    setDragOverPromptId(null);
    setPromptDragActive(false);
    setPromptDragOffset({ x: 0, y: 0 });
  };

  const handlePromptPointerDown = (event: PointerEvent<HTMLDivElement>, promptId: number) => {
    if (event.button !== 0 || searchQuery.trim()) return;
    if ((event.target as HTMLElement).closest('[data-no-prompt-drag]')) return;
    event.preventDefault();
    draggingPromptIdRef.current = promptId;
    setDraggingPromptId(promptId);
    setDragOverPromptId(null);
    setPromptDragActive(false);
    setPromptDragOffset({ x: 0, y: 0 });
    promptDragStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePromptPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const sourceId = draggingPromptIdRef.current;
    if (!sourceId) return;
    event.preventDefault();
    const offset = {
      x: event.clientX - promptDragStartRef.current.x,
      y: event.clientY - promptDragStartRef.current.y,
    };
    const distance = Math.hypot(
      offset.x,
      offset.y,
    );
    if (!promptDragActive && distance < 8) return;
    if (!promptDragActive) setPromptDragActive(true);
    setPromptDragOffset(offset);
    const targetId = getPromptIdAtPoint(event.clientX, event.clientY, sourceId);
    setDragOverPromptId(targetId && targetId !== sourceId ? targetId : null);
  };

  const handlePromptPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const sourceId = draggingPromptIdRef.current;
    const targetId = getPromptIdAtPoint(event.clientX, event.clientY, sourceId || undefined);
    if (promptDragActive && sourceId && targetId && sourceId !== targetId) {
      setPrompts(prev => ({
        ...prev,
        [activeTab]: moveItemById(prev[activeTab] || [], sourceId, targetId) as Prompt[],
      }));
      showToast('Prompt 顺序已更新');
    }
    clearPromptDrag();
  };

  const list = (prompts[activeTab] || []).filter(prompt => prompt.enabled !== false);
  const filteredPrompts = list.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const visibleCats = categories.filter(c => c.visible);
  const displayCats = tabsOverflowing && !tabsExpanded ? visibleCats.slice(0, 4) : visibleCats;
  const isLauncherMode = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('mode') === 'launcher' ||
    window.location.hash === '#launcher' ||
    window.location.pathname.endsWith('/launcher.html')
  );
  const launcherItems = visibleCats.flatMap(category =>
    (prompts[category.id] || [])
      .filter(prompt => prompt.enabled !== false)
      .map(prompt => ({ prompt, category }))
  ).filter(({ prompt, category }) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [prompt.title, prompt.description, prompt.prompt, category.label]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const callLauncherPrompt = async (prompt: Prompt, categoryId: string) => {
    await handleCall(prompt, categoryId);
  };

  const launcherFillTemplateDialog = (
    <Dialog.Root open={callPromptOpen} onOpenChange={setCallPromptOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50"
          style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }} />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[560px] max-w-[92vw] rounded-3xl border"
          style={{ background: '#fff', borderColor: '#e2e8f0',
            boxShadow: '0 24px 60px rgba(15,23,42,0.18)' }}>
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b" style={{ borderColor: '#f1f5f9' }}>
            <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
              {selectedPrompt?.title || '填写 Prompt'}
            </Dialog.Title>
            <Dialog.Close className="grid place-items-center rounded-full hover:bg-slate-100"
              style={{ width: 32, height: 32, color: '#64748b' }}>
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedPrompt && extractTemplateFields(selectedPrompt.prompt).map(field => (
              <div key={field}>
                <label style={{ fontSize: 11, color: '#64748b' }}>{field}</label>
                <textarea
                  value={templateValues[field] || ''}
                  onChange={(e) => setTemplateValues(prev => ({ ...prev, [field]: e.target.value }))}
                  placeholder={`填写${field}`}
                  rows={field.includes('内容') || field.includes('代码') || field.includes('原文') ? 5 : 2}
                  className="w-full mt-1.5 rounded-lg border px-3 py-2 focus:outline-none focus:border-[#0f172a] resize-none"
                  style={{ fontSize: 13, borderColor: '#e2e8f0', lineHeight: 1.6 }}
                />
              </div>
            ))}
            {selectedPrompt && (
              <div className="rounded-xl border px-3 py-2" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>生成预览</div>
                <pre className="whitespace-pre-wrap break-words max-h-36 overflow-auto"
                  style={{ fontSize: 12, color: '#334155', lineHeight: 1.55, fontFamily: 'ui-monospace, monospace' }}>
                  {selectedPrompt ? fillPromptTemplate(selectedPrompt.prompt, templateValues) : ''}
                </pre>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: '#f1f5f9' }}>
            <Dialog.Close
              className="rounded-full border px-5 py-2 transition-colors hover:bg-slate-50"
              style={{ fontSize: 13, borderColor: '#e2e8f0', color: '#475569' }}>
              取消
            </Dialog.Close>
            <button onClick={submitTemplateCall}
              className="inline-flex items-center justify-center gap-1.5 rounded-full text-white px-5 py-2 transition-all hover:-translate-y-0.5"
              style={{ fontSize: 13, background: 'linear-gradient(135deg,#3b63ff,#6366f1)',
                boxShadow: '0 4px 14px rgba(59,99,255,0.28)' }}>
              <Send className="w-3.5 h-3.5 shrink-0" />调用
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  if (isLauncherMode) {
    return (
      <>
        <div className="size-full overflow-hidden relative" style={{ background: 'transparent' }}>
          <style>{`
            body { background: transparent; }
            @keyframes launcherIn { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
          `}</style>
          <div className="absolute inset-0 p-5">
            <div className="size-full rounded-[28px] border overflow-hidden"
              style={{ animation: 'launcherIn .16s ease-out both',
                background: 'linear-gradient(135deg, rgba(248,250,252,.96), rgba(239,246,255,.94) 48%, rgba(245,243,255,.94))',
                borderColor: 'rgba(226,232,240,.9)',
                boxShadow: '0 28px 80px rgba(15,23,42,.24), inset 0 1px 0 rgba(255,255,255,.85)' }}>
              <div className="px-5 pt-5 pb-3">
                <div className="h-14 rounded-2xl border flex items-center gap-3 px-4"
                  style={{ background: 'rgba(255,255,255,.82)', borderColor: '#dbe3ef',
                    boxShadow: '0 6px 22px rgba(15,23,42,.05)' }}>
                  <Search className="w-5 h-5 shrink-0" style={{ color: '#64748b' }} />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        (window as any).webkit?.messageHandlers?.closeLauncher?.postMessage({});
                      }
                      if (event.key === 'Enter' && launcherItems[0]) {
                        callLauncherPrompt(launcherItems[0].prompt, launcherItems[0].category.id);
                      }
                    }}
                    placeholder="搜索 Prompt 名称或描述..."
                    className="flex-1 min-w-0 bg-transparent outline-none"
                    style={{ fontSize: 18, fontWeight: 600, color: '#0f172a' }}
                  />
                </div>
              </div>

              <div className="px-5 pb-5 h-[calc(100%-92px)] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  {launcherItems.map(({ prompt, category }) => {
                    const called = calledId === prompt.id;
                    return (
                      <button key={`${category.id}-${prompt.id}`}
                        onClick={() => callLauncherPrompt(prompt, category.id)}
                        className="group text-left rounded-2xl border px-5 py-4 flex items-center gap-4 transition-all active:scale-[.99] hover:-translate-y-0.5"
                        style={{ background: called ? 'rgba(239,246,255,.96)' : 'rgba(255,255,255,.86)',
                          borderColor: called ? '#3b63ff' : 'rgba(226,232,240,.9)',
                          boxShadow: called ? '0 8px 24px rgba(59,99,255,.16)' : '0 5px 18px rgba(15,23,42,.05)' }}>
                        <div className="min-w-0 flex-1">
                          <div className="truncate" style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                            {prompt.title}
                          </div>
                          <div className="truncate mt-1" style={{ fontSize: 12.5, color: '#64748b' }}>
                            {prompt.description}
                          </div>
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                            style={{ background: 'rgba(241,245,249,.85)', color: '#64748b', fontSize: 11, fontWeight: 600 }}>
                            <span>{category.label}</span>
                            <span>·</span>
                            <span>已用 {prompt.usageCount || 0} 次</span>
                          </div>
                        </div>
                        <div className="shrink-0 grid place-items-center rounded-full"
                          style={{ width: 38, height: 38, color: '#fff',
                            background: called
                              ? 'linear-gradient(135deg,#10b981,#059669)'
                              : 'linear-gradient(135deg,#3b63ff,#6366f1)',
                            boxShadow: '0 6px 18px rgba(59,99,255,.24)' }}>
                          {called ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {launcherItems.length === 0 && (
                  <div className="h-full grid place-items-center rounded-2xl border mt-2"
                    style={{ background: 'rgba(255,255,255,.62)', borderColor: '#e2e8f0', color: '#94a3b8', fontSize: 14 }}>
                    未找到匹配的 Prompt
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {launcherFillTemplateDialog}
      </>
    );
  }

  return (
    <div className="size-full overflow-auto flex flex-col relative" style={{ background: '#f3f5f8' }}>
      <style>{`
        @keyframes auraDrift1 { 0%,100% { transform: translate3d(0,0,0) scale(1);} 35% { transform: translate3d(4vw,3vh,0) scale(1.06);} 70% { transform: translate3d(-2vw,5vh,0) scale(0.98);} }
        @keyframes auraDrift2 { 0%,100% { transform: translate3d(0,0,0) scale(1);} 40% { transform: translate3d(-4vw,-3vh,0) scale(1.08);} 75% { transform: translate3d(3vw,-5vh,0) scale(0.96);} }
        @keyframes auraDrift3 { 0%,100% { transform: translate3d(0,0,0) scale(1);} 50% { transform: translate3d(2vw,-4vh,0) scale(1.05);} }
        @keyframes settingsSpin { from { transform: rotate(0); } to { transform: rotate(90deg); } }
        .aura-blob-1 { animation: auraDrift1 26s ease-in-out infinite; }
        .aura-blob-2 { animation: auraDrift2 32s ease-in-out infinite; }
        .aura-blob-3 { animation: auraDrift3 30s ease-in-out infinite; }
        .settings-btn:hover svg { animation: settingsSpin 0.4s ease forwards; }
      `}</style>
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="aura-blob-1 absolute" style={{ top:'-12%', left:'-12%', width:'52vw', height:'52vw', borderRadius:'50%', background:'rgba(191,219,254,0.35)', filter:'blur(120px)' }} />
        <div className="aura-blob-2 absolute" style={{ top:'18%', right:'-15%', width:'46vw', height:'46vw', borderRadius:'50%', background:'rgba(216,180,254,0.28)', filter:'blur(120px)' }} />
        <div className="aura-blob-3 absolute" style={{ bottom:'-15%', left:'20%', width:'40vw', height:'40vw', borderRadius:'50%', background:'rgba(199,210,254,0.30)', filter:'blur(110px)' }} />
      </div>

      <div className="relative z-10 flex flex-col size-full">
        {/* Nav */}
        <div className="px-6 pt-4 pb-2 sticky top-0 z-40">
          <nav className="mx-auto max-w-[1100px] flex items-center justify-between rounded-2xl border px-3 py-2 pl-5"
            style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.9)',
              boxShadow: '0 4px 24px rgba(15,23,42,0.06)' }}>
            <div className="flex items-center gap-2.5">
              <img src={appIconUrl} alt="" className="w-11 h-11 shrink-0" />
              <div className="leading-tight">
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Prompt Manager</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>AI Prompt Library</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleImport}
                className="inline-flex items-center rounded-full border transition-all hover:bg-[#f8faff]"
                style={{ padding: '8px 16px', fontSize: 13, borderColor: '#e2e8f0', color: '#0f172a' }}>
                导入
              </button>
              <button onClick={handleExport}
                className="inline-flex items-center rounded-full text-white transition-all hover:-translate-y-0.5"
                style={{ padding: '8px 18px', fontSize: 13, background: '#0f172a',
                  boxShadow: '0 4px 14px rgba(15,23,42,0.18)' }}>
                导出 Excel
              </button>
              <button onClick={() => setSettingsOpen(true)}
                className="settings-btn grid place-items-center rounded-full border transition-all hover:bg-[#f8faff]"
                style={{ width: 36, height: 36, borderColor: '#e2e8f0', color: '#475569' }} title="设置">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </nav>
        </div>

        {/* Main */}
        <div className="flex-1 max-w-[1100px] w-full mx-auto px-6 pt-6 pb-16">
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col mb-5 gap-3">
              <div className="relative">
              <Tabs.List ref={tabListRef}
                  className={`flex w-full rounded-2xl border ${tabsExpanded ? 'flex-wrap overflow-visible' : 'flex-nowrap overflow-hidden'}`}
                  style={{ background: 'rgba(255,255,255,0.7)', borderColor: '#e2e8f0',
                    boxShadow: '0 4px 14px rgba(15,23,42,0.04)',
                    padding: tabsOverflowing ? '4px 56px 4px 4px' : 4 }}>
                {displayCats.map((cat) => {
                  const Icon = cat.icon;
                  const active = activeTab === cat.id;
                  const count = (prompts[cat.id] || []).length;
                  return (
                    <Tabs.Trigger key={cat.id} value={cat.id}
                      data-category-tab-id={cat.id}
                      onPointerDown={(event) => handleCategoryPointerDown(event, cat.id)}
                      onPointerMove={handleCategoryPointerMove}
                      onPointerUp={handleCategoryPointerUp}
                      onPointerCancel={clearCategoryDrag}
                      onClickCapture={handleCategoryClickCapture}
                      title="拖动可调整分类位置"
                      className="inline-flex shrink-0 items-center gap-2 rounded-full transition-all cursor-grab active:cursor-grabbing select-none"
                      style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500,
                        color: active ? '#fff' : '#475569',
                        background: active ? '#0f172a' : 'transparent',
                        boxShadow: active ? '0 4px 14px rgba(15,23,42,0.2)' : 'none',
                        opacity: draggingCategoryId === cat.id ? 0.55 : 1,
                        outline: dragOverCategoryId === cat.id ? '2px solid #3b63ff' : 'none',
                        outlineOffset: 2 }}>
                      <Icon className="w-3.5 h-3.5" />
                      {cat.label}
                      <span className="rounded-full px-1.5"
                        style={{ fontSize: 11,
                          background: active ? 'rgba(255,255,255,0.18)' : '#eef2ff',
                          color: active ? '#fff' : '#3b63ff' }}>
                        {count}
                      </span>
                    </Tabs.Trigger>
                  );
                })}
              </Tabs.List>
              {tabsOverflowing && (
                <>
                  <button type="button"
                    onClick={() => setTabsExpanded(value => !value)}
                    className="absolute right-3 top-3 z-10 grid place-items-center rounded-full transition-all active:scale-95"
                    style={{ width: 32, height: 32, color: '#0f172a', background: 'transparent' }}
                    title={tabsExpanded ? '收起分类' : '显示更多分类'}>
                    {tabsExpanded
                      ? <ChevronUp className="w-5 h-5" strokeWidth={2.4} />
                      : <ChevronDown className="w-5 h-5" strokeWidth={2.4} />}
                  </button>
                </>
              )}
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="relative rounded-2xl border"
                  style={{ background: 'rgba(255,255,255,0.9)', borderColor: '#e2e8f0',
                    boxShadow: '0 4px 20px rgba(15,23,42,0.04)' }}>
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94a3b8' }} />
                  <input type="text" placeholder="搜索 Prompt 名称或描述..."
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent focus:outline-none"
                    style={{ padding: '12px 20px 12px 48px', fontSize: 14, color: '#0f172a' }} />
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={openAddPrompt}
                    className="grid place-items-center rounded-full transition-all active:scale-95 hover:-translate-y-0.5"
                    style={{ width: 36, height: 36, color: '#fff',
                      background: 'linear-gradient(135deg,#3b63ff,#6366f1)',
                      boxShadow: '0 4px 14px rgba(59,99,255,0.32)' }}
                    title="新增 Prompt">
                    <Plus className="w-4 h-4" />
                  </button>
                  <div className="inline-flex p-1 rounded-2xl border"
                    style={{ background: 'rgba(255,255,255,0.7)', borderColor: '#e2e8f0' }}>
                    <button onClick={() => setLayout('one')}
                      className="rounded-full transition-all grid place-items-center"
                      style={{ width: 32, height: 32,
                        background: layout === 'one' ? '#0f172a' : 'transparent',
                        color: layout === 'one' ? '#fff' : '#64748b' }} title="单列">
                      <Rows3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setLayout('two')}
                      className="rounded-full transition-all grid place-items-center"
                      style={{ width: 32, height: 32,
                        background: layout === 'two' ? '#0f172a' : 'transparent',
                        color: layout === 'two' ? '#fff' : '#64748b' }} title="双列">
                      <Columns2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <Tabs.Content value={activeTab}>
              <div className={`grid gap-3 ${layout === 'two' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {filteredPrompts.map((prompt) => {
                  const called = calledId === prompt.id;
                  const variableCount = extractTemplateFields(prompt.prompt).length;
                  const isDraggingPrompt = promptDragActive && draggingPromptId === prompt.id;
                  const isPromptDropTarget = promptDragActive && dragOverPromptId === prompt.id;
                  return (
	                    <div key={prompt.id}
                        data-prompt-card-id={prompt.id}
                        onPointerDown={(event) => handlePromptPointerDown(event, prompt.id)}
                        onPointerMove={handlePromptPointerMove}
                        onPointerUp={handlePromptPointerUp}
                        onPointerCancel={clearPromptDrag}
	                      className={`group relative rounded-2xl border px-5 py-4 flex items-start gap-4 ${isDraggingPrompt ? 'opacity-90 z-20' : 'transition-all hover:-translate-y-0.5'} ${isPromptDropTarget ? 'ring-2 ring-[#3b63ff]/35' : ''}`}
	                      style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)',
	                        borderColor: isPromptDropTarget || isDraggingPrompt ? '#3b63ff' : called ? '#3b63ff' : 'rgba(226,232,240,0.8)',
	                        boxShadow: isDraggingPrompt
                            ? '0 22px 42px rgba(59,99,255,0.32)'
                            : called ? '0 8px 28px rgba(59,99,255,0.22)' : '0 4px 16px rgba(15,23,42,0.04)',
                          cursor: searchQuery.trim() ? 'default' : isDraggingPrompt ? 'grabbing' : 'grab',
                          transform: isDraggingPrompt
                            ? `translate3d(${promptDragOffset.x}px, ${promptDragOffset.y}px, 0) scale(1.02)`
                            : undefined,
                          transition: isDraggingPrompt ? 'box-shadow 120ms ease, opacity 120ms ease' : undefined,
                          willChange: isDraggingPrompt ? 'transform' : undefined,
                          pointerEvents: isDraggingPrompt ? 'none' : undefined,
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          touchAction: 'none' }}>
                        {isPromptDropTarget && (
                          <div className="pointer-events-none absolute -top-2 left-5 right-5 flex items-center gap-2">
                            <span className="h-1.5 flex-1 rounded-full" style={{ background: 'linear-gradient(90deg,#3b63ff,#6366f1)' }} />
                            <span className="rounded-full px-2 py-0.5 text-white"
                              style={{ fontSize: 10, fontWeight: 700, background: '#3b63ff',
                                boxShadow: '0 6px 14px rgba(59,99,255,0.25)' }}>
                              放到这里
                            </span>
                          </div>
                        )}
                        {isDraggingPrompt && (
                          <div className="pointer-events-none absolute -right-2 -top-2 rounded-full px-2.5 py-1 text-white"
                            style={{ fontSize: 10, fontWeight: 700, background: '#0f172a',
                              boxShadow: '0 8px 18px rgba(15,23,42,0.18)' }}>
                            正在移动
                          </div>
                        )}
	                      <div className="flex-1 min-w-0">
	                        <h3 className="line-clamp-2 mb-1" style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', lineHeight: 1.35 }}>
	                          {prompt.title}
	                        </h3>
	                        <p className="line-clamp-2" style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.45 }}>
	                          {prompt.description}
	                        </p>
                        {(prompt.usageCount || 0) > 0 && (
                          <p className="mt-1" style={{ fontSize: 11, color: '#94a3b8' }}>
                            已使用 {prompt.usageCount} 次
                          </p>
                        )}
                        {variableCount > 0 && (
                          <p className="mt-1" style={{ fontSize: 11, color: '#3b63ff' }}>
                            调用前填写 {variableCount} 项
                          </p>
                        )}
                      </div>
	                      <div className="shrink-0 flex flex-col items-center gap-2" data-no-prompt-drag>
	                        <button onClick={() => handleCall(prompt)}
	                          className="inline-flex items-center gap-1.5 rounded-full transition-all active:scale-95 hover:-translate-y-0.5"
	                          style={{ padding: '8px 14px', fontSize: 12.5, fontWeight: 500, color: '#fff',
	                            background: called
	                              ? 'linear-gradient(135deg,#10b981,#059669)'
	                              : 'linear-gradient(135deg,#3b63ff,#6366f1)',
	                            boxShadow: called
	                              ? '0 6px 18px rgba(16,185,129,0.35)'
	                              : '0 4px 14px rgba(59,99,255,0.28)',
	                            transform: called ? 'scale(1.04)' : undefined }}>
	                          {called ? (<><Check className="w-3.5 h-3.5" />已调用</>) : (<><Send className="w-3.5 h-3.5" />调用</>)}
	                        </button>
	                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
	                          <button onClick={() => openEditPrompt(prompt)}
	                            className="grid place-items-center rounded-full hover:bg-slate-100"
	                            style={{ width: 30, height: 30, color: '#64748b' }}
	                            title="编辑 Prompt">
	                            <Pencil className="w-3.5 h-3.5" />
	                          </button>
	                          <button onClick={() => deletePrompt(prompt.id)}
	                            className="grid place-items-center rounded-full hover:bg-red-50"
	                            style={{ width: 30, height: 30, color: '#94a3b8' }}
	                            title="删除 Prompt">
	                            <Trash2 className="w-3.5 h-3.5" />
	                          </button>
	                        </div>
	                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredPrompts.length === 0 && (
                <div className="text-center py-16 rounded-2xl border"
                  style={{ background: 'rgba(255,255,255,0.6)', borderColor: '#e2e8f0',
                    color: '#94a3b8', fontSize: 14 }}>
                  {searchQuery ? '未找到匹配的 Prompt ✨' : '当前分类还没有 Prompt，点击右上 + 添加一个'}
                </div>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 top-8 z-[60] rounded-full px-5 py-2.5 border"
          style={{ background: 'rgba(15,23,42,0.92)', color: '#fff', fontSize: 13,
            borderColor: 'rgba(255,255,255,0.1)', boxShadow: '0 8px 28px rgba(15,23,42,0.25)' }}>
          {toast}
        </div>
      )}

      {/* Add Prompt Dialog */}
      <Dialog.Root open={addPromptOpen} onOpenChange={setAddPromptOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50"
            style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }} />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] max-w-[92vw] rounded-3xl border"
            style={{ background: '#fff', borderColor: '#e2e8f0',
              boxShadow: '0 24px 60px rgba(15,23,42,0.18)' }}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b" style={{ borderColor: '#f1f5f9' }}>
              <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
                {editingPromptId ? '编辑 Prompt' : '新增 Prompt'}
              </Dialog.Title>
              <Dialog.Close className="grid place-items-center rounded-full hover:bg-slate-100"
                style={{ width: 32, height: 32, color: '#64748b' }}>
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label style={{ fontSize: 11, color: '#64748b' }}>分类</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {categories.map(c => (
                    <button key={c.id} onClick={() => setFormCategory(c.id)}
                      className="rounded-full border transition-all"
                      style={{ padding: '6px 12px', fontSize: 12,
                        borderColor: formCategory === c.id ? '#0f172a' : '#e2e8f0',
                        background: formCategory === c.id ? '#0f172a' : '#fff',
                        color: formCategory === c.id ? '#fff' : '#475569' }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748b' }}>标题</label>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="例如：代码重构助手"
                  className="w-full mt-1.5 rounded-lg border px-3 py-2 focus:outline-none focus:border-[#0f172a]"
                  style={{ fontSize: 13, borderColor: '#e2e8f0' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748b' }}>简介</label>
                <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="一句话说明这个 Prompt 的用途"
                  className="w-full mt-1.5 rounded-lg border px-3 py-2 focus:outline-none focus:border-[#0f172a]"
                  style={{ fontSize: 13, borderColor: '#e2e8f0' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748b' }}>Prompt 内容</label>
                <textarea value={formPrompt} onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="输入完整的 Prompt 内容..."
                  rows={6}
                  className="w-full mt-1.5 rounded-lg border px-3 py-2 focus:outline-none focus:border-[#0f172a] resize-none"
                  style={{ fontSize: 13, borderColor: '#e2e8f0', fontFamily: 'ui-monospace, monospace', lineHeight: 1.6 }} />
                <div className="mt-1.5" style={{ fontSize: 11, color: '#94a3b8' }}>
                  每次调用都要填写的内容，用 {'{{字段名}}'} 标记，例如 {'{{原文内容}}'}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: '#f1f5f9' }}>
              <Dialog.Close
                className="rounded-full border px-5 py-2 transition-colors hover:bg-slate-50"
                style={{ fontSize: 13, borderColor: '#e2e8f0', color: '#475569' }}>
                取消
              </Dialog.Close>
              <button onClick={submitPromptForm}
                className="rounded-full text-white px-5 py-2 transition-all hover:-translate-y-0.5"
                style={{ fontSize: 13, background: 'linear-gradient(135deg,#3b63ff,#6366f1)',
                  boxShadow: '0 4px 14px rgba(59,99,255,0.28)' }}>
                {editingPromptId ? '保存' : '添加'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Fill Template Dialog */}
      <Dialog.Root open={callPromptOpen} onOpenChange={setCallPromptOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50"
            style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }} />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[560px] max-w-[92vw] max-h-[calc(100vh-48px)] overflow-hidden flex flex-col rounded-3xl border"
            style={{ background: '#fff', borderColor: '#e2e8f0',
              boxShadow: '0 24px 60px rgba(15,23,42,0.18)' }}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b" style={{ borderColor: '#f1f5f9' }}>
              <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
                {selectedPrompt?.title || '填写 Prompt'}
              </Dialog.Title>
              <Dialog.Close className="grid place-items-center rounded-full hover:bg-slate-100"
                style={{ width: 32, height: 32, color: '#64748b' }}>
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>
            <div className="px-6 py-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
              {selectedPrompt && (
                <div className="rounded-2xl border px-3 py-3" style={{ borderColor: '#dbe7ff', background: '#f8fbff' }}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <label style={{ fontSize: 11, color: '#3b63ff', fontWeight: 700 }}>AI改写</label>
                    <button
                      onClick={rewriteTemplateWithAI}
                      disabled={aiRewriting}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full text-white transition-all disabled:opacity-80"
                      style={{ height: 34, padding: '0 14px', minWidth: 148, fontSize: 12, lineHeight: '16px', whiteSpace: 'nowrap', background: 'linear-gradient(135deg,#3b63ff,#6366f1)' }}>
                      {aiRewriting
                        ? <span>改写中...</span>
                        : <><Sparkles className="w-3.5 h-3.5" style={{ flexShrink: 0 }} /><span>AI填入字段</span></>}
                    </button>
                  </div>
                  <textarea
                    value={aiRewriteInput}
                    onChange={(e) => setAiRewriteInput(e.target.value)}
                    placeholder="输入几个关键词或几句话，AI 会改写成下面字段"
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:border-[#3b63ff] resize-none"
                    style={{ fontSize: 13, borderColor: '#dbe7ff', lineHeight: 1.6, background: '#fff' }}
                  />
                </div>
              )}
              {selectedPrompt && extractTemplateFields(selectedPrompt.prompt).map(field => (
                <div key={field}>
                  <label style={{ fontSize: 11, color: '#64748b' }}>{field}</label>
                  <textarea
                    value={templateValues[field] || ''}
                    onChange={(e) => setTemplateValues(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={`填写${field}`}
                    rows={field.includes('内容') || field.includes('代码') || field.includes('原文') ? 5 : 2}
                    className="w-full mt-1.5 rounded-lg border px-3 py-2 focus:outline-none focus:border-[#0f172a] resize-none"
                    style={{ fontSize: 13, borderColor: '#e2e8f0', lineHeight: 1.6 }}
                  />
                </div>
              ))}
              {selectedPrompt && (
                <div className="rounded-xl border px-3 py-2" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>生成预览</div>
                  <pre className="whitespace-pre-wrap break-words max-h-36 overflow-auto"
                    style={{ fontSize: 12, color: '#334155', lineHeight: 1.55, fontFamily: 'ui-monospace, monospace' }}>
                    {fillPromptTemplate(selectedPrompt.prompt, templateValues)}
                  </pre>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 px-6 pt-4 pb-3 border-t" style={{ borderColor: '#f1f5f9' }}>
              {configuredProviders.length > 0 && (
                <div className="relative w-[300px] max-w-full">
                  <select
                    value={activeCallProvider}
                    onChange={(event) => setCallProvider(event.target.value)}
                    className="w-full appearance-none rounded-full border focus:outline-none"
                    style={{ height: 42, padding: '0 42px 0 16px', fontSize: 13, fontWeight: 700,
                      background: '#0f172a', color: '#fff', borderColor: '#0f172a',
                      boxShadow: '0 4px 14px rgba(15,23,42,0.18)' }}>
                    {configuredProviders.map(item => {
                      const config = providerConfigs[item.id];
                      return (
                        <option key={item.id} value={item.id}>
                          {config.model || item.placeholder}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: '#fff' }} />
                </div>
              )}
              <div className="flex w-[300px] max-w-full items-center justify-between gap-2">
                <button onClick={undoLastCall}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border py-2 transition-colors hover:bg-slate-50 whitespace-nowrap"
                  style={{ width: 120, paddingLeft: 14, paddingRight: 14, fontSize: 13, borderColor: '#e2e8f0', color: '#475569' }}>
                  <Undo2 className="w-3.5 h-3.5 shrink-0" />上一次调用
                </button>
                <Dialog.Close
                  className="rounded-full border py-2 transition-colors hover:bg-slate-50 whitespace-nowrap"
                  style={{ width: 72, paddingLeft: 14, paddingRight: 14, fontSize: 13, borderColor: '#e2e8f0', color: '#475569' }}>
                  取消
                </Dialog.Close>
                <button onClick={submitTemplateCall}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full text-white py-2 transition-all hover:-translate-y-0.5 whitespace-nowrap"
                  style={{ width: 92, paddingLeft: 14, paddingRight: 14, fontSize: 13, background: 'linear-gradient(135deg,#3b63ff,#6366f1)',
                    boxShadow: '0 4px 14px rgba(59,99,255,0.28)' }}>
                  <Send className="w-3.5 h-3.5 shrink-0" />调用
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Settings Dialog */}
      <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50"
            style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }} />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] max-w-[92vw] rounded-3xl border"
            style={{ background: '#fff', borderColor: '#e2e8f0',
              boxShadow: '0 24px 60px rgba(15,23,42,0.18)' }}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b" style={{ borderColor: '#f1f5f9' }}>
              <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>设置</Dialog.Title>
              <Dialog.Close className="grid place-items-center rounded-full hover:bg-slate-100"
                style={{ width: 32, height: 32, color: '#64748b' }}>
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Categories */}
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>分类管理</div>
                  <button onClick={addCategory}
                    className="inline-flex items-center gap-1 rounded-full border transition-colors hover:bg-slate-50"
                    style={{ padding: '5px 12px', fontSize: 12, borderColor: '#e2e8f0', color: '#0f172a' }}>
                    <Plus className="w-3 h-3" />新增分类
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
                  可以编辑分类名称、控制是否显示，或新增自定义分类
                </div>
                <div className="space-y-2">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <div key={cat.id}
                        className="flex items-center gap-2 rounded-xl border px-3 py-2"
                        style={{ borderColor: '#e2e8f0' }}>
                        <Icon className="w-4 h-4 shrink-0" style={{ color: '#3b63ff' }} />
                        <input
                          value={cat.label}
                          onChange={(e) => updateCategory(cat.id, { label: e.target.value })}
                          className="flex-1 bg-transparent focus:outline-none rounded px-2 py-1 hover:bg-slate-50 focus:bg-slate-50"
                          style={{ fontSize: 13, color: '#0f172a' }}
                        />
                        <Pencil className="w-3 h-3" style={{ color: '#cbd5e1' }} />
                        <Switch.Root
                          checked={cat.visible}
                          onCheckedChange={(v) => updateCategory(cat.id, { visible: v })}
                          className="relative rounded-full transition-colors shrink-0"
                          style={{ width: 36, height: 20, background: cat.visible ? '#0f172a' : '#cbd5e1' }}>
                          <Switch.Thumb className="block rounded-full bg-white transition-transform"
                            style={{ width: 16, height: 16, transform: `translateX(${cat.visible ? 18 : 2}px) translateY(2px)`,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
                        </Switch.Root>
                        <button onClick={() => deleteCategory(cat.id)}
                          className="grid place-items-center rounded-full hover:bg-red-50 shrink-0"
                          style={{ width: 28, height: 28, color: '#94a3b8' }}
                          title="删除分类">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* AI Integration */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>接入 AI 大模型</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      启用后，"调用"按钮将直接发送到所选模型
                    </div>
                  </div>
                  <Switch.Root checked={aiEnabled} onCheckedChange={setAiEnabled}
                    className="relative rounded-full transition-colors"
                    style={{ width: 36, height: 20, background: aiEnabled ? '#0f172a' : '#cbd5e1' }}>
                    <Switch.Thumb className="block rounded-full bg-white transition-transform"
                      style={{ width: 16, height: 16, transform: `translateX(${aiEnabled ? 18 : 2}px) translateY(2px)`,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
                  </Switch.Root>
                </div>
                <div className={`space-y-3 transition-opacity ${aiEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b' }}>服务商</label>
                    <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                      {PROVIDERS.map(p => (
                        <button key={p.id} onClick={() => setProvider(p.id)}
                          className="rounded-lg border transition-all"
                          style={{ padding: '7px 8px', fontSize: 12,
                            borderColor: provider === p.id ? '#0f172a' : '#e2e8f0',
                            background: provider === p.id ? '#0f172a' : '#fff',
                            color: provider === p.id ? '#fff' : '#475569' }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b' }}>模型</label>
                    <input value={currentProviderConfig.model} onChange={(e) => updateProviderConfig(provider, { model: e.target.value })}
                      placeholder={PROVIDERS.find(item => item.id === provider)?.placeholder || 'model-name'}
                      className="w-full mt-1.5 rounded-lg border px-3 py-2 focus:outline-none focus:border-[#0f172a]"
                      style={{ fontSize: 13, borderColor: '#e2e8f0' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b' }}>API Key</label>
                    <input value={currentProviderConfig.apiKey} onChange={(e) => updateProviderConfig(provider, { apiKey: e.target.value })}
                      type="password" placeholder="sk-..."
                      className="w-full mt-1.5 rounded-lg border px-3 py-2 focus:outline-none focus:border-[#0f172a]"
                      style={{ fontSize: 13, borderColor: '#e2e8f0', fontFamily: 'ui-monospace, monospace' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b' }}>Base URL（可选）</label>
                    <input value={currentProviderConfig.baseUrl} onChange={(e) => updateProviderConfig(provider, { baseUrl: e.target.value })}
                      placeholder="https://api.example.com/v1"
                      className="w-full mt-1.5 rounded-lg border px-3 py-2 focus:outline-none focus:border-[#0f172a]"
                      style={{ fontSize: 13, borderColor: '#e2e8f0' }} />
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: '#f1f5f9' }}>
              <Dialog.Close
                className="rounded-full border px-5 py-2 transition-colors hover:bg-slate-50"
                style={{ fontSize: 13, borderColor: '#e2e8f0', color: '#475569' }}>
                取消
              </Dialog.Close>
              <button onClick={() => { setSettingsOpen(false); showToast('设置已保存'); }}
                className="rounded-full text-white px-5 py-2 transition-all hover:-translate-y-0.5"
                style={{ fontSize: 13, background: '#0f172a',
                  boxShadow: '0 4px 14px rgba(15,23,42,0.18)' }}>
                保存
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
