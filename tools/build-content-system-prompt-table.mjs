import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = '/Users/Abigale/All_project/20260522promptmanagement/outputs/content-system-prompts';
await fs.mkdir(outputDir, { recursive: true });

const promptRows = [
  ['分类', '标题', '简介', 'Prompt内容', '标签', '调用模式', '启用'],
  [
    '选题',
    'Topic Radar：选题切口评估',
    '把热点、粗笔记或题目转成 3 个可写切口，并给出评分、结构和标题方向。',
    [
      '请基于以下原始题目或热点材料，生成候选公众号写作切口。',
      '',
      '原始主题：{{原始主题}}',
      '原始材料：{{原始材料}}',
      '',
      '要求：',
      '1. 生成 3 个候选切口。',
      '2. 每个切口必须包含：选题公式、推荐结构、时效判断、四维评分、标题方向、素材缺口。',
      '3. 四维评分包括：热爱程度、专业能力、市场需求、资源积累，每项 1-5 分。',
      '4. 优先推荐总分最高、最容易转成公众号观点文的切口。',
      '5. 输出必须能交给 content-brief-builder 继续生成 brief。',
    ].join('\n'),
    '选题,热点,上游决策',
    'copy',
    'true',
  ],
  [
    'Brief',
    'Content Brief Builder：结构化创作简报',
    '把已选题目整理成 stage-1 兼容 brief，锁定读者、核心观点、SCQA、素材和风险。',
    [
      '请把以下选题整理成结构化创作 brief，不写正文。',
      '',
      '选题来源：{{选题来源}}',
      '主要想说：{{核心判断}}',
      '目标读者：{{目标读者}}',
      '希望读者看完做什么：{{发布目标}}',
      '已有素材：{{已有素材}}',
      '',
      '要求：',
      '1. 补全背景与语境、论证方向、可用案例 / 素材。',
      '2. 角度必须是一句话、有立场、与众不同。',
      '3. 必须包含 SCQA：情境(S)、冲突(C)、问题(Q)、答案(A)。',
      '4. 素材至少 3 条，不足时标注推断或待验证。',
      '5. 必须包含明确不要写什么、风格要求、配图方向、风险提醒、素材来源可信度。',
      '6. 输出 section header 必须兼容 stage1 brief 模板。',
    ].join('\n'),
    'brief,创作简报,SCQA',
    'copy',
    'true',
  ],
  [
    '采集',
    'WeChat Collect：公众号原文转 Brief',
    '从公开公众号文章提取标题、正文、作者和链接，生成再创作 brief。',
    [
      '请基于以下公众号原文采集结果，生成可进入 stage-1 写作链路的再创作 brief。',
      '',
      '原文标题：{{原文标题}}',
      '原文作者 / 公众号：{{原文作者}}',
      '发布时间：{{发布时间}}',
      '原文链接：{{原文链接}}',
      '正文摘要段落：{{正文摘要段落}}',
      '识别到的小标题：{{小标题}}',
      '',
      '要求：',
      '1. 保留原文有价值的信息点，但不要直接照抄原文。',
      '2. 提炼核心观点、背景语境和 3 个论证方向。',
      '3. 可用素材必须包含来源链接和作者信息。',
      '4. 明确提醒不要复刻原文结构、句子、标题党和营销腔。',
      '5. 输出为 stage-1 兼容 brief。',
    ].join('\n'),
    '公众号采集,brief,再创作',
    'copy',
    'true',
  ],
  [
    '研究',
    'News Collect：资讯扫描报告',
    '把多源新闻扫描结果整理成可人工选题的报告，并补写作价值判断。',
    [
      '请把以下资讯扫描结果整理成稳定的内容选题报告。',
      '',
      '扫描主题：{{扫描主题}}',
      '扫描来源：{{扫描来源}}',
      '关键词：{{关键词}}',
      '候选条目：{{候选条目}}',
      '请求备注：{{请求备注}}',
      '',
      '要求：',
      '1. 汇总候选信息，保留标题、链接、来源、时间、热度和摘要。',
      '2. 推荐最多 3 个值得继续写的题目。',
      '3. 每个推荐题目补：推荐理由、写作角度、值得写评分、目标读者、核心痛点、标题方向、证据缺口和风险提醒。',
      '4. 输出适合作为 topic-research 或 content-brief-builder 的上游材料。',
    ].join('\n'),
    '资讯扫描,研究,选题',
    'copy',
    'true',
  ],
  [
    '研究',
    'Topic Research：Tavily 深研查询',
    '把选题、研究问题、种子链接和首轮扫描上下文合成 Tavily research 查询。',
    [
      '研究主题：{{研究主题}}',
      '研究问题：{{研究问题}}',
      '',
      '请输出适合中文内容团队做选题判断的结构化研究，重点关注最新事实、分歧点、行业信号和可写角度。',
      '',
      '优先参考这些链接：',
      '{{种子链接}}',
      '',
      '首轮扫描上下文：',
      '{{首轮扫描上下文}}',
      '',
      '补充要求：',
      '{{补充要求}}',
    ].join('\n'),
    'Tavily,深研,研究查询',
    'copy',
    'true',
  ],
  [
    '文章',
    'Case Writer Hybrid：自动长文初稿',
    '把结构化 brief 扩写为公众号长文，并生成 writing pack 与质量门控材料。',
    [
      '请基于以下结构化 brief 生成一篇公众号长文初稿。',
      '',
      '主题：{{topic}}',
      '目标读者：{{target_reader}}',
      '发布目标：{{publish_goal}}',
      '核心观点：{{core_view}}',
      '背景与语境：{{background}}',
      '论证方向：{{arguments}}',
      '可用案例 / 素材：{{cases}}',
      '明确不要写什么：{{avoid}}',
      '风格要求：{{style}}',
      'SCQA：{{scqa}}',
      '风险提醒：{{risk_reminders}}',
      '素材可信度：{{material_confidence}}',
      '',
      '要求：',
      '1. 保留用户提供的判断、框架和证据，优先使用 brief 里的论证方向。',
      '2. 结构包含标题、导语、问题提出、核心判断、论证段、结论、可传播总结。',
      '3. 如素材可信度低，只能作为待验证线索，不可写成确定事实。',
      '4. 每段尽量短，先说观点再说理由。',
      '5. 输出可进入 writer -> critic -> humanizer-zh -> judge 的本地质量循环。',
    ].join('\n'),
    '公众号长文,写作,初稿',
    'copy',
    'true',
  ],
  [
    '文章',
    'Case Writer Hybrid：交互式标题和大纲',
    '交互模式下先产出标题候选、结构选择和章节大纲，等待用户确认。',
    [
      '请先不要写全文，只基于 brief 输出标题和大纲供确认。',
      '',
      '主题：{{topic}}',
      '目标读者：{{target_reader}}',
      '发布目标：{{publish_goal}}',
      '核心观点：{{core_view}}',
      '论证方向：{{arguments}}',
      'SCQA：{{scqa}}',
      '',
      '要求：',
      '1. 生成 3 个标题候选，并说明各自的钩子。',
      '2. 从五大框架和结构模板里选一种最适合的结构。',
      '3. 基于 SCQA 产出章节大纲。',
      '4. 停在标题和大纲阶段，等待用户确认后再写全文。',
    ].join('\n'),
    '标题,大纲,交互写作',
    'copy',
    'true',
  ],
  [
    '审稿',
    'Adversarial Content Review：三角色审稿',
    '对已完成文章做笔杆子审、参谋审、裁判裁定，输出五维评分和修改建议。',
    [
      '请对以下 Markdown 文章做对抗式审稿，不要重写文章。',
      '',
      '文章标题：{{文章标题}}',
      '文章正文：{{文章正文}}',
      '',
      '审稿流程：',
      '1. 笔杆子审：检查观点、结构、证据和章节推进。',
      '2. 参谋审：站在目标读者视角，判断哪里看不懂、哪里想跳过、哪里有共鸣。',
      '3. 裁判裁定：按五维度给分并输出结论。',
      '',
      '评分维度：结构与标题、论据硬度、读者收益、故事共鸣、语言节奏。',
      '结论规则：总分 >= 8 为通过；5-7.9 为需修改；<5 为需重写。',
      '输出必须包含主要问题和具体修改建议。',
    ].join('\n'),
    '审稿,质量门控,评分',
    'copy',
    'true',
  ],
  [
    '改稿',
    'Humanizer ZH：去 AI 痕迹与中文润色',
    '按中文表达规则清理 AI 腔、套话、机械连接词和过度拔高表达。',
    [
      '请对以下中文内容做去 AI 痕迹和口语化润色。',
      '',
      '原文：{{原文内容}}',
      '目标风格：{{目标风格}}',
      '保留要求：{{保留要求}}',
      '',
      '要求：',
      '1. 删除“在当今数字化时代”“值得注意的是”“总的来说”等套话。',
      '2. 减少机械连接词、模板化反转和过度拔高。',
      '3. 保留事实、核心判断和章节结构。',
      '4. 让句子更像作者在说话，而不是报告或聊天机器人回复。',
    ].join('\n'),
    '润色,去AI,中文表达',
    'copy',
    'true',
  ],
  [
    '图片',
    'Generate Image：文章配图生成',
    '基于文章标题、摘要、正文和风格要求生成图片 API 调用 Prompt。',
    [
      '请为以下文章生成一张公众号配图或信息图。',
      '',
      '文章标题：{{文章标题}}',
      '文章摘要：{{文章摘要}}',
      '文章路径 / 正文：{{文章正文或路径}}',
      '图片用途：{{图片用途}}',
      '基础风格：{{基础风格}}',
      '用户补充：{{用户补充}}',
      '',
      '要求：',
      '1. 视觉必须围绕文章最强可视化观点。',
      '2. 优先信息图、头图或关键概念图。',
      '3. 避免无关炫技感、无关人物肖像和低信息密度装饰。',
      '4. 输出可交给 OpenAI-compatible image API 的图片 Prompt。',
    ].join('\n'),
    '配图,图片生成,信息图',
    'copy',
    'true',
  ],
  [
    '短视频',
    'Script Writer Short：文章转口播脚本',
    '把文章、brief 或题目笔记转成 60-180 秒短视频口播脚本。',
    [
      '请把以下文章或题目笔记转成短视频口播脚本。',
      '',
      '源标题：{{源标题}}',
      '源正文：{{源正文}}',
      '目标时长：{{目标时长}}',
      '',
      '结构要求：',
      '1. Hook：20-30 个中文字符，服务前 3 秒。',
      '2. Introduction：说明为什么观众应该关心。',
      '3. Body：2-3 点，每点包含结论 + 例子或收益。',
      '4. Summary：一句可记住的话 + 评论 / 关注引导。',
      '5. 拍摄提示：节奏、镜头、字幕建议。',
      '',
      '约束：口语、紧凑；保留核心观点；优先具体场景；不要添加不可验证事实。',
    ].join('\n'),
    '口播,短视频,视频号',
    'copy',
    'true',
  ],
  [
    '公众号分析',
    'WeChat Report：多篇公众号对比报告',
    '对同一主题下多篇公众号文章做结构、互动、写法标签和共性总结。',
    [
      '请基于以下公众号文章集合，生成结构化对比采集报告。',
      '',
      '主题：{{主题}}',
      '文章集合：{{文章集合}}',
      '互动数据：{{互动数据}}',
      '采集备注：{{采集备注}}',
      '',
      '报告必须包含：',
      '1. 文章总表。',
      '2. 互动数据对比表。',
      '3. 内容结构对比表。',
      '4. 爆款写法标签表。',
      '5. 单篇摘要卡。',
      '6. 标题与开头拆解。',
      '7. 结尾与转发钩子。',
      '8. 共性写法总结。',
      '9. 失败与缺口。',
    ].join('\n'),
    '公众号分析,竞品,结构拆解',
    'copy',
    'true',
  ],
  [
    '格式化',
    'WeChat Formatter：Markdown 转公众号 HTML',
    '本地格式化规则，不是 LLM Prompt；列入表中用于完整调用链确认。',
    [
      '【非 LLM Prompt / 本地格式化配置】',
      '',
      '输入 Markdown：{{文章Markdown}}',
      '主题样式：{{theme_name}}',
      '模板名称：{{template_name}}',
      '',
      '执行内容：',
      '1. 解析文章 Markdown。',
      '2. 应用公众号主题和模板。',
      '3. 输出 ready HTML 和预览元数据。',
      '',
      '说明：当前 runtime 通过本地 formatter 执行，不向模型发送创作 Prompt。',
    ].join('\n'),
    '格式化,公众号HTML,非LLM',
    'copy',
    'true',
  ],
];

const detailRows = [
  ['调用阶段', 'Prompt / 模板', '来源文件', '实际调用方式', '主要占位符', '确认点'],
  ['选题', 'Topic Radar：选题切口评估', 'skills/topic-radar/SKILL.md; skills/topic-radar/runtime.py', '本地规则生成，等价 Prompt 可导入管理器', '{{原始主题}}, {{原始材料}}', '是否需要把四维评分权重做成占位符'],
  ['Brief', 'Content Brief Builder：结构化创作简报', 'skills/content-brief-builder/SKILL.md; runtime.py', '本地规则 + Skill 指令', '{{选题来源}}, {{核心判断}}, {{目标读者}}, {{发布目标}}, {{已有素材}}', '用户不足信息是否保留为必填占位符'],
  ['采集', 'WeChat Collect：公众号原文转 Brief', 'skills/wechat-collect/runtime.py', '本地抽取 + brief 模板', '{{原文标题}}, {{原文作者}}, {{发布时间}}, {{原文链接}}, {{正文摘要段落}}, {{小标题}}', '是否和普通 Brief 合并，还是保留采集专用版本'],
  ['研究', 'News Collect：资讯扫描报告', 'skills/news-collect/runtime.py', '调用 vendor 抓取后本地整理', '{{扫描主题}}, {{扫描来源}}, {{关键词}}, {{候选条目}}, {{请求备注}}', '是否把“推荐题目数”做成占位符'],
  ['研究', 'Topic Research：Tavily 深研查询', 'skills/topic-research/runtime.py', '真实外部研究查询 Prompt', '{{研究主题}}, {{研究问题}}, {{种子链接}}, {{首轮扫描上下文}}, {{补充要求}}', '这是最接近真实 LLM / research 调用的 Prompt'],
  ['写作', 'Case Writer Hybrid：自动长文初稿', 'skills/case-writer-hybrid/SKILL.md; runtime.py', '本地写作模板 + 质量循环', '{{topic}}, {{target_reader}}, {{publish_goal}}, {{core_view}}, {{background}}, {{arguments}}, {{cases}}, {{scqa}}', '是否拆成“标题生成 / 正文生成 / 结尾生成”多个 Prompt'],
  ['写作', 'Case Writer Hybrid：交互式标题和大纲', 'skills/case-writer-hybrid/SKILL.md; references/*.md', '交互式 Skill 指令', '{{topic}}, {{target_reader}}, {{publish_goal}}, {{core_view}}, {{arguments}}, {{scqa}}', '是否作为独立常用 Prompt 保留'],
  ['审稿', 'Adversarial Content Review：三角色审稿', 'skills/adversarial-content-review/SKILL.md; runtime.py', '本地评分器 + 角色审稿模板', '{{文章标题}}, {{文章正文}}', '是否要把评分阈值做成占位符'],
  ['改稿', 'Humanizer ZH：去 AI 痕迹与中文润色', 'skills/humanizer-zh/SKILL.md; skill_runtime/writing_core.py', '本地规则替换 + 润色指令', '{{原文内容}}, {{目标风格}}, {{保留要求}}', '是否增加“力度：轻/中/重”占位符'],
  ['图片', 'Generate Image：文章配图生成', 'skills/generate-image/runtime.py', 'md2wechat generate_image 调用 image API', '{{文章标题}}, {{文章摘要}}, {{文章正文或路径}}, {{图片用途}}, {{基础风格}}, {{用户补充}}', '需要确认图片风格库是否独立管理'],
  ['短视频', 'Script Writer Short：文章转口播脚本', 'skills/script-writer-short/SKILL.md; runtime.py', '本地脚本模板', '{{源标题}}, {{源正文}}, {{目标时长}}', '目标时长现在 runtime 默认 90 秒，可做成占位符'],
  ['公众号分析', 'WeChat Report：多篇公众号对比报告', 'skills/wechat-report/SKILL.md; runtime.py', '本地采集 + 分析报告模板', '{{主题}}, {{文章集合}}, {{互动数据}}, {{采集备注}}', '是否需要拆出“标题开头拆解”专用 Prompt'],
  ['格式化', 'WeChat Formatter：Markdown 转公众号 HTML', 'skills/wechat-formatter/runtime.py', '非 LLM，本地 HTML 格式化', '{{文章Markdown}}, {{theme_name}}, {{template_name}}', '导入管理器时可禁用或标记为非 LLM'],
];

const workbook = Workbook.create();

function styleSheet(sheet, range, headerRange, widths) {
  sheet.showGridLines = false;
  sheet.getRange(range).values = sheet === main ? promptRows : detailRows;
  sheet.freezePanes.freezeRows(1);
  sheet.getRange(headerRange).format.fill.color = '#0F172A';
  sheet.getRange(headerRange).format.font.color = '#FFFFFF';
  sheet.getRange(headerRange).format.font.bold = true;
  sheet.getRange(headerRange).format.horizontalAlignment = 'Center';
  sheet.getRange(headerRange).format.verticalAlignment = 'Center';
  sheet.getRange(range).format.wrapText = true;
  sheet.getRange(range).format.verticalAlignment = 'Top';
  sheet.getRange(range).format.font.name = 'Arial';
  sheet.getRange(range).format.font.size = 10;
  widths.forEach((width, index) => {
    const col = String.fromCharCode(65 + index);
    sheet.getRange(`${col}:${col}`).format.columnWidthPx = width;
  });
}

const main = workbook.worksheets.add('Prompt导入模板');
styleSheet(main, `A1:G${promptRows.length}`, 'A1:G1', [130, 210, 280, 640, 170, 90, 70]);
main.getRange('A2:G2').format.rowHeightPx = 160;
main.getRange(`A3:G${promptRows.length}`).format.rowHeightPx = 210;
main.getRange(`F2:F${promptRows.length}`).dataValidation = { rule: { type: 'list', values: ['copy', 'insert', 'ai'] } };
main.getRange(`G2:G${promptRows.length}`).dataValidation = { rule: { type: 'list', values: ['true', 'false', '是', '否'] } };

const detail = workbook.worksheets.add('调用梳理');
styleSheet(detail, `A1:F${detailRows.length}`, 'A1:F1', [110, 230, 330, 210, 360, 310]);
detail.getRange(`A2:F${detailRows.length}`).format.rowHeightPx = 90;

const summary = workbook.worksheets.add('确认重点');
summary.showGridLines = false;
summary.getRange('A1:B8').values = [
  ['项目', '说明'],
  ['主表用途', 'A-G 列严格符合 Prompt 管理器导入格式，可直接导入。'],
  ['占位符规则', '所有需要调用前填写的变量均用 {{字段名}} 标记。'],
  ['真实 LLM 调用', 'Topic Research 和 Generate Image 最接近外部模型/API Prompt；其他多数是 Skill 指令或本地模板化生成。'],
  ['建议先确认', 'Case Writer 是否拆成标题、大纲、正文、结尾、审稿多个 Prompt。'],
  ['建议先确认', 'WeChat Formatter 是否导入管理器，还是仅记录为非 LLM 调用链。'],
  ['建议先确认', '图片风格、审稿阈值、短视频时长是否做成独立占位符。'],
  ['来源范围', '/Users/Abigale/All_project/content_system/skills、skill_runtime、workflows。'],
];
summary.freezePanes.freezeRows(1);
summary.getRange('A1:B1').format.fill.color = '#0F172A';
summary.getRange('A1:B1').format.font.color = '#FFFFFF';
summary.getRange('A1:B1').format.font.bold = true;
summary.getRange('A:B').format.font.name = 'Arial';
summary.getRange('A:B').format.font.size = 11;
summary.getRange('A1:B8').format.wrapText = true;
summary.getRange('A1:B8').format.verticalAlignment = 'Top';
summary.getRange('A:A').format.columnWidthPx = 150;
summary.getRange('B:B').format.columnWidthPx = 720;
summary.getRange('A2:B8').format.rowHeightPx = 58;

const inspect = await workbook.inspect({
  kind: 'table',
  range: `Prompt导入模板!A1:G${promptRows.length}`,
  include: 'values',
  tableMaxRows: 6,
  tableMaxCols: 7,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 50 },
  summary: 'formula error scan',
});
console.log(errors.ndjson);

await workbook.render({ sheetName: 'Prompt导入模板', range: 'A1:G8', scale: 1 });
await workbook.render({ sheetName: '调用梳理', range: 'A1:F8', scale: 1 });
await workbook.render({ sheetName: '确认重点', range: 'A1:B8', scale: 1 });

const output = await SpreadsheetFile.exportXlsx(workbook);
const xlsxPath = path.join(outputDir, 'content-system-prompts-v0.1.xlsx');
await output.save(xlsxPath);

const firstWorkbook = Workbook.create();
const firstSheet = firstWorkbook.worksheets.add('Prompt导入模板');
const firstRows = [promptRows[0], promptRows[1]];
firstSheet.showGridLines = false;
firstSheet.getRange('A1:G2').values = firstRows;
firstSheet.freezePanes.freezeRows(1);
firstSheet.getRange('A1:G1').format.fill.color = '#0F172A';
firstSheet.getRange('A1:G1').format.font.color = '#FFFFFF';
firstSheet.getRange('A1:G1').format.font.bold = true;
firstSheet.getRange('A1:G2').format.wrapText = true;
firstSheet.getRange('A1:G2').format.verticalAlignment = 'Top';
[130, 210, 280, 640, 170, 90, 70].forEach((width, index) => {
  const col = String.fromCharCode(65 + index);
  firstSheet.getRange(`${col}:${col}`).format.columnWidthPx = width;
});
firstSheet.getRange('A2:G2').format.rowHeightPx = 210;
await firstWorkbook.render({ sheetName: 'Prompt导入模板', range: 'A1:G2', scale: 1 });
const firstOutput = await SpreadsheetFile.exportXlsx(firstWorkbook);
const firstXlsxPath = path.join(outputDir, 'content-system-prompts-first-row.xlsx');
await firstOutput.save(firstXlsxPath);

const briefWorkbook = Workbook.create();
const briefSheet = briefWorkbook.worksheets.add('Prompt导入模板');
const briefRow = [
  '自媒体',
  'Content Brief Builder：结构化创作简报',
  '把已选题目整理成 stage-1 兼容 brief，锁定读者、核心观点、SCQA、素材和风险。',
  [
    '请把以下选题整理成结构化创作 brief，不写正文。',
    '',
    '选题来源：{{选题来源}}',
    '主要想说：{{核心判断}}',
    '目标读者：{{目标读者}}',
    '希望读者看完做什么：{{发布目标}}',
    '已有素材：{{已有素材}}',
    '',
    '要求：',
    '1. 补全背景与语境、论证方向、可用案例 / 素材。',
    '2. 角度必须是一句话、有立场、与众不同。',
    '3. 必须包含 SCQA：情境(S)、冲突(C)、问题(Q)、答案(A)。',
    '4. 素材至少 3 条，不足时标注推断或待验证。',
    '5. 必须包含明确不要写什么、风格要求、配图方向、风险提醒、素材来源可信度。',
    '6. 输出 section header 必须兼容 stage1 brief 模板。',
  ].join('\n'),
  'content-system,brief,创作简报,SCQA',
  'copy',
  'true',
];
briefSheet.showGridLines = false;
briefSheet.getRange('A1:G2').values = [promptRows[0], briefRow];
briefSheet.freezePanes.freezeRows(1);
briefSheet.getRange('A1:G1').format.fill.color = '#0F172A';
briefSheet.getRange('A1:G1').format.font.color = '#FFFFFF';
briefSheet.getRange('A1:G1').format.font.bold = true;
briefSheet.getRange('A1:G2').format.wrapText = true;
briefSheet.getRange('A1:G2').format.verticalAlignment = 'Top';
[130, 260, 300, 680, 220, 90, 70].forEach((width, index) => {
  const col = String.fromCharCode(65 + index);
  briefSheet.getRange(`${col}:${col}`).format.columnWidthPx = width;
});
briefSheet.getRange('A2:G2').format.rowHeightPx = 230;
await briefWorkbook.render({ sheetName: 'Prompt导入模板', range: 'A1:G2', scale: 1 });
const briefOutput = await SpreadsheetFile.exportXlsx(briefWorkbook);
const briefXlsxPath = path.join(outputDir, 'content-system-brief-prompt-import-test.xlsx');
await briefOutput.save(briefXlsxPath);

const markdownRows = promptRows.slice(1).map((row) => {
  const [category, title, description, prompt, tags, mode, enabled] = row;
  return `| ${category} | ${title} | ${description} | ${String(prompt).split('\n')[0]}... | ${tags} | ${mode} | ${enabled} |`;
});
const markdown = [
  '# Content System Prompt 梳理 v0.1',
  '',
  '| 分类 | 标题 | 简介 | Prompt内容预览 | 标签 | 调用模式 | 启用 |',
  '|---|---|---|---|---|---|---|',
  ...markdownRows,
  '',
  '## 初步判断',
  '',
  '- 主链路：topic-radar / content-brief-builder / case-writer-hybrid / adversarial-content-review / generate-image / wechat-formatter。',
  '- 采集研究链路：news-collect / topic-research / wechat-collect / wechat-report。',
  '- 衍生分发链路：script-writer-short。',
  '- 其中 wechat-formatter 是本地格式化，不是 LLM Prompt；先放入表中用于确认是否管理。',
].join('\n');
const mdPath = path.join(outputDir, 'content-system-prompts-v0.1.md');
await fs.writeFile(mdPath, markdown, 'utf8');

console.log(xlsxPath);
console.log(firstXlsxPath);
console.log(briefXlsxPath);
console.log(mdPath);
