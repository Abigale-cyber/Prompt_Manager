# Content System Prompt 梳理 v0.1

| 分类 | 标题 | 简介 | Prompt内容预览 | 标签 | 调用模式 | 启用 |
|---|---|---|---|---|---|---|
| 选题 | Topic Radar：选题切口评估 | 把热点、粗笔记或题目转成 3 个可写切口，并给出评分、结构和标题方向。 | 请基于以下原始题目或热点材料，生成候选公众号写作切口。... | 选题,热点,上游决策 | copy | true |
| Brief | Content Brief Builder：结构化创作简报 | 把已选题目整理成 stage-1 兼容 brief，锁定读者、核心观点、SCQA、素材和风险。 | 请把以下选题整理成结构化创作 brief，不写正文。... | brief,创作简报,SCQA | copy | true |
| 采集 | WeChat Collect：公众号原文转 Brief | 从公开公众号文章提取标题、正文、作者和链接，生成再创作 brief。 | 请基于以下公众号原文采集结果，生成可进入 stage-1 写作链路的再创作 brief。... | 公众号采集,brief,再创作 | copy | true |
| 研究 | News Collect：资讯扫描报告 | 把多源新闻扫描结果整理成可人工选题的报告，并补写作价值判断。 | 请把以下资讯扫描结果整理成稳定的内容选题报告。... | 资讯扫描,研究,选题 | copy | true |
| 研究 | Topic Research：Tavily 深研查询 | 把选题、研究问题、种子链接和首轮扫描上下文合成 Tavily research 查询。 | 研究主题：{{研究主题}}... | Tavily,深研,研究查询 | copy | true |
| 文章 | Case Writer Hybrid：自动长文初稿 | 把结构化 brief 扩写为公众号长文，并生成 writing pack 与质量门控材料。 | 请基于以下结构化 brief 生成一篇公众号长文初稿。... | 公众号长文,写作,初稿 | copy | true |
| 文章 | Case Writer Hybrid：交互式标题和大纲 | 交互模式下先产出标题候选、结构选择和章节大纲，等待用户确认。 | 请先不要写全文，只基于 brief 输出标题和大纲供确认。... | 标题,大纲,交互写作 | copy | true |
| 审稿 | Adversarial Content Review：三角色审稿 | 对已完成文章做笔杆子审、参谋审、裁判裁定，输出五维评分和修改建议。 | 请对以下 Markdown 文章做对抗式审稿，不要重写文章。... | 审稿,质量门控,评分 | copy | true |
| 改稿 | Humanizer ZH：去 AI 痕迹与中文润色 | 按中文表达规则清理 AI 腔、套话、机械连接词和过度拔高表达。 | 请对以下中文内容做去 AI 痕迹和口语化润色。... | 润色,去AI,中文表达 | copy | true |
| 图片 | Generate Image：文章配图生成 | 基于文章标题、摘要、正文和风格要求生成图片 API 调用 Prompt。 | 请为以下文章生成一张公众号配图或信息图。... | 配图,图片生成,信息图 | copy | true |
| 短视频 | Script Writer Short：文章转口播脚本 | 把文章、brief 或题目笔记转成 60-180 秒短视频口播脚本。 | 请把以下文章或题目笔记转成短视频口播脚本。... | 口播,短视频,视频号 | copy | true |
| 公众号分析 | WeChat Report：多篇公众号对比报告 | 对同一主题下多篇公众号文章做结构、互动、写法标签和共性总结。 | 请基于以下公众号文章集合，生成结构化对比采集报告。... | 公众号分析,竞品,结构拆解 | copy | true |
| 格式化 | WeChat Formatter：Markdown 转公众号 HTML | 本地格式化规则，不是 LLM Prompt；列入表中用于完整调用链确认。 | 【非 LLM Prompt / 本地格式化配置】... | 格式化,公众号HTML,非LLM | copy | true |

## 初步判断

- 主链路：topic-radar / content-brief-builder / case-writer-hybrid / adversarial-content-review / generate-image / wechat-formatter。
- 采集研究链路：news-collect / topic-research / wechat-collect / wechat-report。
- 衍生分发链路：script-writer-short。
- 其中 wechat-formatter 是本地格式化，不是 LLM Prompt；先放入表中用于确认是否管理。