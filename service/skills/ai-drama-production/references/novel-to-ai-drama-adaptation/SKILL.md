---
name: novel-to-ai-drama-adaptation
description: Adapt a completed novel with a confirmed rights route into a whole-book drama map and first-season production screenplays. Use for novel-to-AI-drama adaptation; do not use for novel drafting, director boards, or media generation.
---

# Novel to AI Drama Adaptation

## Canvas Production Boundary

进入漫剧生产前读取 [Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md)，先调用 `get_canvas_summary` 并核对真实项目/分集/Clip ID 与 revision。创作源文件可以保留；生产交接写入并读回 Canvas 对象，不维护第二份资产或状态台账。

源提示词只保存语义正文和结构化引用/绑定，不手写提供方媒体编号。下文及专业参考中的 `<Picture N>` / `<Video N>` / `<Audio N>` 是编译后格式的审核示例，仅由预览/提交编译器输出；UI 使用缩略图及图片N/视频N/音频N令牌。旧模板的文件路径/current 标记不构成 Canvas 采用记录，采用必须对应真实持久媒体版本与 QA。


把定稿小说改编成可制作的 AI 漫剧剧本。职责是“剧本管戏”：选材、压缩、重组、场次、动作、对白和声音；不负责导演板、镜头、提示词、静态资产或任何媒体生成。

## Inputs

- 小说定稿路径，以及 `original / licensed_adaptation / verified_public_domain / reference_only_originalization` 来源路线和明确限制。
- 目标季数、首季集数、单集时长与目标平台。缺少这些会改变改编结构的创作参数时，一次性向主人确认；不要用固定集数、时长或爽点间隔替代。
- 小说很长时，先读全书总览、分卷大纲、章节目录与摘要，再按被选故事弧精读原文。不得只凭书名、网络梗概或记忆补造情节。

## Workflow

1. **来源与改编简报**
   - 复核来源路线和可用范围；外部小说的权利判断仍以 Series 的来源路线为准。
   - 写清改编命题、保留的核心价值、合并/删减/重排策略、不可复制的现代表达，以及小说中不可直接拍摄的内容。

2. **全书改编蓝图**
   - 把整书映射成季与故事弧：每季的核心问题、起始压力、转折、局部结局和下一季压力。
   - 建立改编后的系列事实：人物功能和弧线、关系、可见世界规则、关键地点/道具、信息权限与连续性边界。
   - 小说原文不是逐段照录。内心独白、抽象设定和长时间跳跃要改成行动、空间、道具、关系、声音或必要旁白。

3. **首季分集设计**
   - 每集写承诺、开场问题、目标、阻力、行动选择、代价、局部回报、结尾状态和下一集压力。
   - 所有关键小说事件要么映射到某集的可见 Beat，要么明确合并、删除或由旁白承担；不要悄悄遗漏。

4. **首季制作剧本**
   - 每场写 `Location + View / 时间`、呈现方式、`Character + Look`、关键 `Prop + State`、已知信息、可见动作、对白/旁白/声音、退出状态、戏剧功能和预计时长，让 Series 能直接拆解制作依赖而不必猜测。
   - 对重要对白补齐触发、说话前任务、说话时动作、听者或环境响应、说完后的变化。精确台词必须在对应 Voice 的自然表演窗口内成立；装不下时按真实剪辑点拆场或拆 Shot，不静默删改。
   - 每集制作剧本内维护一张紧凑的“小说对白去向表”。按原文出现顺序逐句登记本集选中范围内的每句人物对白和承担剧情信息的旁白，记录原文章节/段落、说话者、原文、处理方式 `保留 / 合并 / 删减 / 转移`、最终 Scene/Beat，以及计划落入的 Clip + Shot/画外载体。`合并 / 删减 / 转移` 必须写清不会丢失剧情功能的具体理由和承接位置；不得用“节奏需要”“时长有限”等空泛理由替代实际去向。
   - 去向表是制作剧本的内容索引，不是审批台账。剧本改写后同步更新受影响行；一条原文只有一个当前有效去向。尚未完成 Clip/Shot 拆解时可暂写 `待 Series 拆解`，但在正式导演板生成前必须解析为具体 Clip + Panel/Shot 或明确画外载体。
   - 不写镜号、景别、运镜、导演板格、图片/视频提示词或媒介参数。这些属于现有 Visual、Prompt 与 Video Skills。

5. **改编审校与交接**
   - 核查改编是否兑现既定命题、人物动机和代价是否成立、关键信息顺序是否清楚、每个场次是否能被画面和声音承载。
   - 逐行核对小说对白去向表：原文选中范围内不得存在未登记对白；制作剧本中的精确台词必须能反查原文行或明确标记为改编新增；被合并、删减或转移的内容必须有具体理由和有效承接位置。
   - 只对明确失败项做最小返修：全书蓝图问题回到蓝图，单集故事问题回到该集，台词/动作问题回到该场。不要因为单个下游画面问题重写小说或整季剧本。
   - 将首季制作剧本直接交给 Series 的制作拆解。已有本 Skill 的正式剧本时，`ai-drama-story-writing` 不重复开发相同剧本，除非主人要求实质性重写。

## Source and formal handoff

输入小说可以位于 `项目/<作品名>/小说/`，也可以由主人直接提供。磁盘文档只作为来源或创作草稿；完成改编后，必须通过当前 Canvas 工具把来源、改编蓝图写入正式漫剧项目，把各集制作剧本写入对应 Episode，并把可制作内容拆成带稳定 Shot ID 的 Clip/Shot。写入后重新读取项目、Episode 和 Clip，确认 revision 与正文一致，数据库记录才是下游正式输入。

`assets/templates/` 仅提供创作结构参考，不要求生成平行文件。不要建立 JSON/HTML 报告、固定阈值检查、候选池、审批表、锁、任务日志或技术执行记录；不得把 `脚本与制作资料/`、状态 Markdown 或本地资产索引当作新项目的当前状态。

## Handoff and boundaries

- Canvas 项目、Episode、Clip 和 Shot 写入并读回后，由 `ai-drama-series-production` 从制作拆解、资产采用和下游交接继续。
- 普通原创漫剧仍由现有 Story/Series 路线写剧本；本 Skill 不成为其前置条件。
- 本 Skill 不调用 ComfyUI、不制作人物/场景/道具、导演板、声音、视频或必剪时间线。

## References

- 全书选材、压缩与小说可视化改写：`references/book-to-series-adaptation.md`。
- 首季分集与制作剧本接口：`references/season-screenplay.md`。
