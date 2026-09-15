---
name: minimax-h3-video-production
description: Produce, repair, review, and hand off AI-video Clips using the current local MiniMax H3 route. Use after story, visual, audio, and prompt preparation for Ref2VA multi-Shot Clips, conditional FL2VA endpoint tests, model-specific input roles, dynamic performance, continuity, native dialogue, and media QA.
---

# AI Video Production

## Canvas Production Boundary

进入漫剧生产前读取 [Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md)，先调用 `get_canvas_summary` 并核对真实项目/分集/Clip ID 与 revision。创作源文件可以保留；生产交接写入并读回 Canvas 对象，不维护第二份资产或状态台账。

所有画布节点严格遵循生产契约中的 [Infinite Canvas 源提示词标准](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md#infinite-canvas-源提示词标准)：只编辑语义正文和 UI 缩略图令牌，媒体职责通过结构化绑定保存；不得把预览生成的 `<Picture N>` / `<Video N>` / `<Audio N>` 写回源节点。旧模板的文件路径/current 标记不构成 Canvas 采用记录，采用必须对应真实持久媒体版本与 QA。


本 Skill 把当前剧本、完整分镜导演故事板、视觉/声音参考和提示词变成可用视频。当前使用已经配置好的本地 MiniMax H3；正常制作直接生成、看片和最小返修。

本 Skill 只接收已经成立的制作剧本、current 视觉资产和通过逐格 QA 的 current 完整导演板。缺少正式导演板，或导演板仍存在 Beat 遗漏、身份/空间/道具漂移、动作跳变、镜头覆盖失败时，退回 Series/Visual 修正；不得用 H3 Prompt 或生成重试替代上游工作。视频通过真实媒体 QA 后才交给必剪。

## Default Route

- 默认模型：MiniMax H3 local。
- 默认输出：480p。时长与镜头数量由剧情、自然对白和动作决定；当前本地已验证制作范围为单次 2–15 秒，不等于底层节点硬上限，也不把所有 Clip 填到 15 秒。更长场次先规划完整内容，再按有动机的切点拆为可执行 Clips。
- 每个 H3 Clip 只用一个 generation mode。漫剧默认使用 `MiniMax-H3_03` Ref2VA；一个 Clip 根据完整故事板规划实际 N 个同场 editorial Shots，N 不固定。`MiniMax-H3_02` FL2VA 只在主人明确测试或开场/落点两端都必须精确成立时选用。
- 项目选择白模预演时，Ref2VA 输入包含完整分镜故事板 `<Picture 1>`，以及该 Clip 通过 QA 的 Blender motion-reference MP4 `<Video 1>`。
- H3 无法完成的需求如需更换模型，等待主人明确选择并验证对应 ComfyUI 工作流。
- 正常项目遵循 [Infinite Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md)：先 `get_canvas_summary`，读取匹配 Clip/Shot、节点 Prompt、有序版本绑定及运行记录。通过真实 MCP/工作台预览与提交，底层由管理员配置的 H3 工作流生成；不经旧工作台或文件索引。只有明确技术实验或真实执行失败才加载技术排障资料。

读取 `references/minimax-h3-local.md` 获取 H3 模式、参考角色、提示格式和 QA 方法，并读取 [H3 提示词编译与校验](references/h3-prompt-compilation-and-validation.md) 进行完整重编译和提交前结构检查。项目选择 Blender 白模预演时，同时读取 [H3 白模视频参考输入](references/whitebox-video-reference-input.md)。打斗、武器、法术、异能、怪物能力或范围技能攻击时，按 Prompt Skill 的 [高密度打斗、技能与能力调度](../ai-media-prompt-compiler/references/combat-and-ability-staging.md) 先组织整段 连续攻防，再把每轮可读战术变化映射为一个 Panel / 内部 Shot。每次提交前重新读取所选模式的当前 UI JSON；它是唯一执行图真源。`01` 仅用于无需视觉参考的简单例外；`02` 用于明确选择的 FL2VA 端点测试；`03` 是默认 Ref2VA 路线。参考页只说明公开输入的职责，不定义或重建内部节点链。

## Inputs

完整导演板必须在本次执行预览中成为首个 Picture，随后连接实际出镜人物的完整身份板、当前 Location 场景板及实际出现且影响连续性的关键道具版本；Voice 只关联实际 Speaker。引用使用数据库 assetId/versionId/storageId 与 role/order/speaker，不使用文本提及解析。关系锚点或白模预演仅在真实保真风险存在时加入。Codex 编写语义正文与结构化引用，官方媒体标签仅由预览/提交编译器生成；草稿或绑定变化后重核当前 Prompt，不改已提交快照。适配层已加入导演板时不要重复绑定它。

一个 H3 Clip 需要：

- 剧本 Beat、精确对白和可见事件；
- 有台词时的声源（画内 / 画外 / 旁白）、口语语言和已验证可容纳的表演时间窗口；
- Ref2VA 使用该 Clip 的一张完整分镜导演故事板，以及“Beat → Panel/Shot → 切点/动作/参考职责”的映射。只有相邻 Clips 处于同一地点、同一连续时间且动作/对白/道具状态确实承接时，才必须先用上一板末格 `handoff_setup` 与当前板 P1 `motivated_cut_in` 完成交接：状态准确继承，但新 P1 明确改变至少两项摄影覆盖。若属于换场、明确时间跳跃、闪回、梦境或蒙太奇，则按剧本建立新的开场状态，不继承上一刻人物姿态。需要连续交接但工作台没有上一板原图、末格终态或已完成的边界合同时，不提交当前 Clip。只有定向修正两张整板后，多人站位、背侧/过肩朝向、视线交汇、人物体量、连接道具或开场状态仍有真实风险时，才按 [跨 Clip 故事板交接与关系锚点](../ai-media-prompt-compiler/references/clip-boundary-blocking-anchor.md) 追加干净彩色关系锚点。FL2VA 则使用两张独立制作并通过 QA 的开场/落点帧；
- 当前项目选择 Blender 白模预演时，已写入共享语义 brief 的摄影/调度合同，以及通过 QA 的同 Shot `*_reference.mp4`；该视频必须作为 H3 `<Video 1>`/`video_1_frames` 输入，仅控制相机、调度、动作节拍和空间拓扑；
- 对双人、门口、交接、揭示、追逐、打斗、武器或技能攻击、或群像：Shot 功能、唯一主状态变化、行动主导者、受控反应和下一 Shot 交接；三人以上、围堵或队列还要给出焦点人物/具名配角相对命名锚点的区域与朝向、每个 `Crowd-*` 簇的人数/区域/整体朝向/密度、入口通道、功能关系/空间权限和唯一允许重排；冲突/技能 Shot 还要给出双方距离/朝向/重心、关键物或能力源头、作用路径/目标范围、可见后果与终态；
- 同场多 Shot 或路径动作的覆盖与交接：观众必须读到的事实、相对上一镜的可读变化、切点理由，以及人物相对锚点的位置/朝向/行动阶段和道具归属如何进入下一镜；跨镜连接道具再提供归属者、端点 A/端点 B、路径/余量或滑动方式与当前模式；
- 当前出镜人物按实际重要性连接各自的完整身份板；不为正常 H3 Clip 派生或生成单视角人物图。身份板只控制脸、发型、身体比例、服装和固定配饰，不控制板内中性姿态、表情、白底或排版。当前 Location 连接完整场景板，控制同一地点的拓扑、固定锚点、入口、主光和多方向关系。关键道具连接完整道具板，控制形制、材质、数量、机制和当前 State；连接道具还必须固定归属者、两端、路径与模式。故事板继续负责当前空间中的实际站位、镜头、动作和状态交接；
- Scene Bible 中的独立 Top-Down、Anchor 表、Blocking Zone、Camera Coverage 或整套 View Library 不作为 H3 图片槽批量输入。它们先被编译进完整分镜导演板、Camera Zone、屏幕方向和可见 Anchor；当前完整场景板仍作为常规场景 Picture 输入，单独 `Location + View` 不再作为常规补图。
- 当前 Shot 确有近景微表情或复杂情绪弧风险时，先确认制作拆解已有角色表演语言和当前 Clip 表演曲线，完整导演板对应 Panel 已写清触发、眼神/聚焦、眼睑、眉间、嘴唇、下颌、呼吸、面部张力、身体协同与结束变化，并继续使用完整身份板保持身份。完整表演板只服务上游制板；只有真实视频 QA 反复证明该近景无法从整板继承时，才可追加一张限定当前 Clip/Shot 的干净单状态表演参考；
- 当前 Project / Scene Look、Color State、可见 Light ID 与 Lighting State。完整电影 Look Board 只服务上游完整分镜导演板，不直接进入 H3；整板未能可靠承载综合色彩时先修整板，不用额外板式图片补救。Look 只控制肤色、综合色彩关系、阴影/高光、黑位、材质响应和强调色职责，不控制身份、地理、道具、动作或构图；
- 仅本 H3 Clip 实际各 Shot 中实际发声者的 Voice 样本和声音方案（有对白时）。Picture、Audio、Subject、Speaker 分别编号：可见说话者的 Audio 指向其 Subject 与 Speaker；没有可见实体的画外音、旁白、广播或系统声只绑定 Audio 与 Speaker，不得为了音频额外创建 Subject；
- 由 Prompt Skill 整理的视觉、动作、声音和连续性语义 brief；
- 目标时长、画幅、开头状态、结尾状态和剪辑条件。

声音方案逐 Shot 写 `AMB=延续/进入/退出 + 可听空间锚点`、与可见事件同步的 Foley/SFX、声源和精确 Line（如有），以及交给下一 Shot 的声音状态。相邻同场 Shot 默认继承底声和相对空间距离；只有门、距离、机器、天气或场景确实变化时改变。`无台词` 不传 Voice，但仍保留必要 AMB/Foley/SFX。非画内 BGM 只作为 `none / 延续 / 进入 / 退出 / 为对白让路` 的时间线意图交给必剪，不让每个 H3 Shot 烧入并重开配乐；画内音乐才属于该 Shot 声源。

每个参考只控制一个明确层。一个 H3 Clip 是一条同场、连续时间、按实际节奏定时的请求。Ref2VA 以完整分镜导演故事板作为主 `<Picture 1>`；随后按“实际出镜主角身份板 → 其他实际出镜角色身份板 → 当前完整场景板 → 实际关键道具板”的顺序连接 `<Picture 2>` 至 `<Picture 9>`。故事板控制镜头计划，身份板控制人物身份与 Look，场景板控制空间拓扑与固定锚点，道具板控制形制、机制和 State。超出九张时优先保留故事板、主角身份板和当前场景板，再按剧情风险选择其他身份板与关键道具板。不传各 Panel 裁图、单视角派生图、重复图片、上一条成片原始尾帧或无职责的视频。

完整分镜故事板同时承担当前 Clip 的主要 Look 基线。完整 Look Board 不作为额外 H3 Picture；若整板未可靠覆盖综合色彩，先用 current Look Board 修正或重做整板。换机位、景别或人物位置不会重置 Project / Scene Look，只有已声明 Color State 或有动机 Lighting State 可以改变色光关系。

其中 `<Picture 1>` 的每格建立对应 Shot 的一个可读瞬间；动作格优先使用可继续的 `mid_state`，并保持 Camera Zone、景别/焦段/机高/角度、前景/主体/后景和身体表演合同。身份板只锁定“是谁”，不得把其中的中性表情、站姿或视线带入完整分镜。

参考槽数量不是固定模板。每个 H3 Clip 都从所选模式、实际出镜/出声内容和 Shot 覆盖重新计算输入，只连接必要且内容互不重复的媒体；空槽直接断开或省略。H3-03 的公开槽位按当前 UI 图为准；H3-02 的开场帧、落点帧和提示字段同样只按 freshly-read UI 图绑定。图片、视频帧和音频的上游来源只按所选 UI 图的公开输入配置，不手工搭建历史 `ref_*` 接线。当前 UI 节点里的示例 Prompt 只是占位内容，每次请求必须用当前 Clip 完整重编译的 Prompt 覆盖。最终标签、实际媒体、顺序、职责及适用 Shot 必须逐项一致。

`subject_definitions` 先把人物、场景、道具或表演图片抽象为稳定的 `<Subject N>`；H3 的后续段落跟踪这个 Subject。`<Picture 1>` 只作为完整分镜导演规划锚点；其他 Picture 标签只在 Subject 定义或高风险状态锚点中出现。跨格连接道具对应的 Subject 要在连续动作和交接中保持同一归属者、两端、路径/余量与模式。选择白模预演时，紧邻实际 `<Video 1>` 写相机路径、调度或动作节拍职责。`retention_analysis` 和 `detailed_description` 正向声明最终成片为完整彩色电影画面，只呈现故事世界中的 Subject。

## Choose a Mode

- reference to video：默认路线。支持一个按实际时长、完整分镜故事板驱动的同场多 Shot Clip；完整故事板、完整身份板、完整场景板、按需完整道具板、高风险关系锚点和 Voice 各自承担明确职责。
- text to video：无需人物、地理、道具或导演板参考的简单 H3 Clip 才使用。
- first frame to video：只在真实返修已证明必须严格控制单一开场画面时使用；它不是常规完整分镜 Ref2VA 路线。
- first + last frame / FL2VA：按需测试或明确端点任务。只有开场状态、落点状态以及两者之间的单一连续物理过程都明确时使用；两张端点帧必须分别制作和 QA，不能把上一条 H3 成片原始尾帧自动当作下一条的开场或落点。

模式必须由任务决定：Ref2VA 默认用完整分镜导演板和 Prompt 生成一个按实际时长的同场多 Shot Clip；FL2VA 用两个具体端点约束一个连续插值过程。跨场、换时、地理/状态不兼容、对白动作过载或真实 QA 失败时拆成不同 H3 Clips，再由必剪连接。不要把各 Panel 裁图分别塞进请求，也不要用 FL2VA 掩盖缺失的动作设计。

## Verify the Performance Brief

对话、观察、对峙或 POV Shot 必须继承具体 `Eyeline Contract`：角色当前注视的具名人物/道具/空间点、目标的场内位置/距离/眼线高度、摄影机观察位置、脸部角度，以及视线转移的可见触发和新目标。普通客观镜头正向写成“摄影机从斜侧/越肩观察，角色双眼落在场内目标”；只有明确 POV、自拍、视频通话、演讲或直面观众才让镜头方向成为注视目标。不得因身份板正面脸或近景构图把剧情表演变成看镜头。

摄影稳定性继承 [镜头语言与运镜选择](../ai-media-prompt-compiler/references/camera-direction-playbook.md#选择顺序)：默认稳定支撑与平滑受控运动，逐镜写出落点；明确的手持/冲击例外按范围执行。不把表演动态、跟拍、POV、呼吸、环境震动或参考样片的晃动自动扩散为持续相机抖动。编译只保留该语义，不新增负向段或私改采样参数；效果仍需真实连续播放验收。

小说改编或已有 current 正式导演板的 Ref2VA Clip，编译前必须取得由制作剧本、小说对白去向表和 current 导演板共同生成的逐 Shot 合同，并在最终校验时通过 `--shot-contract` 传入。合同核对精确切点、每格不可省略的小说动作事实和完整对白；没有合同、合同仍只写概述、或 Prompt 使用“按导演板变化”等句子把具体内容推回参考图时，不得提交视频。

在编译前确认 Prompt Skill 交来的语义 brief 已包含 trigger、身体准备、committed action、对方或环境响应、reaction/choice 和 changed end state，并使用至少两个可见变化通道：身体/位置、目光/表情、道具接触、摄影机或环境响应。高风险场面中，一个主状态变化只在声明的 `primary_action` Shot 完成；相邻 `establish`、`reaction`、`insert` 或 `transition` Shot 只建立、反应、看清细节或确认结果，不让 H3 重播开门、交接、进入或揭示。三人以上时，若 brief 没有写清具名人物与 `Crowd-*` 簇的开场几何、唯一允许重排和通道，就先回到关键帧/Prompt 修正；不要让 H3 自行分配围堵者或改变谁控制出口。

同时确认 brief 已解析当前 Look Continuity Block：同一 Scene / Color State 不因换景别、机位或人物位置而重置肤色、阴影/高光、黑位、综合色温或强调色职责；Lighting State 的亮灭、闪烁、遮挡或局部颜色变化必须来自已声明 Light ID 或当前镜内可见的新光源，不能使用无来源全局滤镜。

人物 Shot 还要继承角色表演语言和当前 Clip 的非单调表演曲线，并给出身体姿态/重心、头肩手腿躯干、视线、呼吸、微表情/强度和动作阶段。表情状态名或百分比必须展开为眼球焦点、眼睑、眉间、嘴唇、下颌、呼吸/颈部张力与身体协同；表情与身体由同一触发共同变化。微表情、视线、呼吸或单个准备动作默认与主动作/对白同镜完成，不单独制造 Shot。只有切点已有真实观看价值后，才要求相邻 Shot 的 Camera / Body / Information 通常至少两项发生可读变化。

冲突、打斗和能力攻击同样不是例外：一条按实际时长规划的 H3 Clip 可以完成一条高密度、连续因果的攻防链；其中每个 Panel / 内部 Shot 只完成一轮可读的逼近、攻击/施放、格挡/闪避、命中/后果或脱离。上一 Panel 的受力、位置、装备状态、环境后果和余势必须成为下一 Panel 的起点。接触、能量和效果必须有可见源头、方向或路径、作用对象与结果；武器/法器只在声明的 Panel 中通过可见夺取、释放、损坏或状态变化改变归属。复杂连招、多人同时大动作、范围毁坏与余波分别按真实编辑边界分配给多个 Panel 或拆成多个 Clips，不能用强晃或随机运镜遮住因果。

对白必须已有说话前任务、说话时行为、听者/环境反应、台词后的变化，以及画内/画外/旁白声源、语言和可容纳的时间窗口；每个 Shot 只能有一个由行动、注意力、揭示或空间关系驱动的主要摄影行为。若精确台词装不进窗口，退回 Prompt Skill 先按真实编辑点拆 Shot，不在 Video Skill 压缩台词或二次创作。

对白情绪按官方结构写在 `<d>` 外：先用自然中文描述起始语气、导致情绪变化的触发、语速/音量/重音/停顿曲线，以及同步的眼神、嘴唇/下颌、呼吸和身体动作；`<d>[Chinese]…</d>` 内只保留角色真正朗读的精确原文及其正常标点。不得把 `（逐渐激动）`、`（低声）`、`[愤怒地]` 等舞台说明放进 `<d>`，避免被朗读或破坏剧本、字幕与口型的一致性。

## Scope and Timing

先把剧本中同场、同时间、同目标的动作、对白、听者反应和摄影跟随压缩成连续表演，再决定 editorial Shots。默认不切镜；只有新必要事实、当前机位无法读清的关键动作、观察立场变化或不可替代的节奏重音才建立新 Shot。逐镜删除测试后，移除仍不损失上述内容的镜头必须合并或删除。实际镜头数 N 与总时长 T 没有固定绑定。每个保留 Shot 都有 Dramatic Beat、摄影行为、声音落点和交接状态；第二镜至末镜使用严格递增、位于 T 内的切点。H3 当前已验证单次范围为 2–15 秒，更长内容按真实切点拆成多个有各自导演板的 Clip；不要为凑满时长添加镜头，也不要把完整场次硬塞进请求。路径动作和连接道具仍写清上一末态、当前开场、可见过程、当前终态及下一开场，不能让切镜掩盖瞬移或道具消失。明确：

每个 Shot 同时声明一个 Camera Zone；同一 Location + View 允许在合法工作侧内改变距离、高度、焦段、景别、过肩、前景遮挡和小幅角度，不把场景一致误解成固定摄像头。

- already happened；
- this Shot only；
- reserved for later；
- do not show yet。

时间规划连续、对白能自然说完、动作有准备和收尾。内容太多就拆到下一 Clip；内容偏少时让建立、反应、环境或余韵承担真实叙事功能，不用无意义空闲动作填充。

## H3 Prompt Formats

先读取 [H3 Ref2VA 本地生产提示词模板](references/h3-ref2va-final-prompt-template.md)；选择 FL2VA 时改读 [H3 FL2VA 端点测试模板](references/h3-fl2va-test-template.md)。Ref2VA 使用固定六段顺序，Base/FL2VA 使用官方三段与对齐行。段名、媒体/Subject/Speaker 标签、`[Shot N] At MM:SS.mmm,` 和 `<d>[Chinese]…</d>` 保留固定兼容语法；六段中的说明、逐镜描述与声音正文统一使用自然中文。上游导演板使用信息栏、大幅镜头画面与底部参考简表，完整导演字段保留在工作台镜头表，但其字段不复制进 `detailed_description`。`detailed_description:` 可直接进入 `[Shot 1]`，也可先写一至两句纯风格开场；开场只写媒介、真实度、综合色彩、材质与整体影像气质，第一帧、参考、切镜、运镜、动作、表演和声音都进入前三段或对应 Shot，也不在每镜重复素材清单。多 Shot Ref2VA 只在 `detailed_description` 中增加后续 `[Shot N] At MM:SS.mmm, ...`，不改变六段骨架。每次修改动作、时长、媒体、Shot 顺序、Speaker 或声音后，依据编译参考页从当前有效事实完整重写 Prompt，不在旧 Prompt 后追加补丁。

H3 提示词优先使用具体、直接、可视化的描述，少写需要模型“意会”的抽象句或文学比喻。把“压迫感增强”“命运逼近”“空气凝固”“他意识到危险”等意图，展开成可见、可听的人物重心与动作、眼神和面部张力、距离与遮挡、构图占比、摄影机路径与落点、光线变化、材质/环境响应或声音事件。风格和情绪词可以保留，但不能替代其对应的画面与声音载体；也不要退化成逗号分隔的关键词堆。

最终 Prompt 除 `<d>` 内的真实对白外，不得保留内部创作意图、观众目标、剧情功能、交接占位或抽象镜末结论。“上一回合/上一镜结束”“动作引出后续对白”“对白冲突已被动作触发”“观众在 N 秒内知道/明白”“镜末形成/呈现悬念、压迫、转折”等内容必须改写为人物位置、姿态、视线、手与道具关系、可见动作过程、摄影/光线/声音和可观察末态；无法从制作剧本、Shot 合同与 current 导演板解析时停止编译，不得原样复制或用引号包裹后提交。

### Base Modes

只把 Prompt Skill 的语义 brief 转换为官方 H3 Base 格式：`integrated_multimodal_description`、`overall_soundscape`、`non_diegetic_music`。字段名与首帧/FL2VA 的官方对齐行保留固定兼容语法，正文统一使用自然中文；精确对白和可见文字保持原语言。FL2VA Prompt 必须描述从开场帧到落点帧的可生成过程、相机路径、状态变化和实际时长，不能让模型仅凭两个静态结果猜过程。不得在此重写剧情或参考职责。

除明确要求画内音乐或单段容器交付，单个 H3 Shot 的 `non_diegetic_music` 默认写 `none`。跨 Shot BGM 由必剪的独立音乐轨负责；Prompt 中若有音乐，只允许写与上一/下一 Shot 的相对 `延续 / 进入 / 退出 / 为对白让路`，不让每段视频各自重新起一首配乐，也不因 `none` 丢掉 AMB、Foley 或 SFX。

### Ref2VA

只把同一语义 brief 按官方六段顺序编译：

1. `subject_definitions`；
2. summary；
3. `retention_analysis`；
4. `detailed_description`；
5. `overall_soundscape`；
6. `non_diegetic_music`。

保持 Picture、Video、Audio、Subject 标签和 Speaker 映射一致。每个实际连接的 `<Audio N>` 必须在 `subject_definitions` 定义，在 `summary` 概括其任务职责，在 `retention_analysis` 写明 `reference`/复用关系，并在该音频真正生效的 Shot 或声音层自然引用；Voice 音色参考必须在实际发声 Shot 明确写出“使用 `<Audio N>` 的音色/表达参考”。`retention_analysis` 不写 `(Sx)`，Speaker 只在定义绑定与目标视频的实际发声事件中使用。目标新台词由正确的 `<Subject N> (Sx)` 说出，并放在 `<d>[Language] ...</d>` 中。一次连续发言指定唯一 `dialogue_owner_shot`，完整可朗读原文只在该 Speaker 的一个 `<d>` 中出现一次；其余 Shot 只描述同一次发言的准备、中段、收束或说完后阶段与可见表演，不能出现原句、短句、关键词或引号。`summary`、`retention_analysis` 与 `overall_soundscape` 不复述可朗读文本。

最终 Prompt 严格隔离“制作层”和“故事世界层”：导演板与各类资产板只在前三段声明来源和控制职责；`detailed_description` 的 Shot 正文不得出现板名、标题栏、编号、格线、参考小图、平面图、表格或 `<Picture N>`，只使用已定义 `<Subject N>` 写最终可见世界。无对白 Shot 只写动作、听者反应、环境声和 Foley，不出现 Voice、Audio、Speaker、`<d>`，也不使用“闭口／不要说话／无台词”等反向控制语。提交前必须通过提示词 lint，任一制作层泄露或声音职责泄露均不提交。

中文字符“说”只用于真正对白发生处，并且只能作为紧邻唯一 `<d>` 前的明确发声句式，例如“`<Subject N> (S1) 说出 <d>…</d>`”。其余位置禁止使用“说完后、说话时、继续说、没有说、听他说、说了一句”等文字；对白后的状态改写为“声音落下后”的可见动作，听者段只写反应，声音段只写具体声源与声场。角色真实台词内部出现“说”不受此规则影响。

最终 H3 Prompt 不附带独立 negative-prompt 字段、后缀或第七段。参考保留、限制与变化按官方段落职责用自然中文写入相应六段；不得再套用项目自定义的负词黑名单。`non_diegetic_music: N/A` 或 `none` 是音乐状态字段。

## Native Dialogue

可见说话默认优先 H3 Ref2VA 原生对白：

- 绑定当前角色 Voice 样本；
- 显式映射 Audio、Subject、Speaker 和目标 Line；
- 写入精确文本、语言、发音和表演；
- 生成后检查台词、音色、发音、表演、嘴型、A/V 同步、环境和动作声。

汇总本 H3 Clip 实际各 Shot 的全部精确 Lines 后附加 Voice：画内对白只绑定实际开口角色；画外对白/旁白只绑定实际说话者；画面中的沉默角色不得附带其 Voice。整个 Clip 没有任何台词时，真实请求省略全部角色 Voice 音频和 Audio / Speaker / `<d>` 映射，只保留所需环境、Foley 和 SFX。某个 Shot 无台词但同 Clip 其他 Shot 有台词时，只在该 Shot 正文省略对白标签，不移除其他 Shot 实际需要的 Voice。

同一连续发言跨越多个摄影切点时，镜头可以继续切换，但文字不跟着重复：唯一认领 Shot 保存完整 `<d>`；之前的 Shot 写开口准备，之后的 Shot 写发言中段/收束阶段、听者反应、口型和身体任务。若同一 Speaker 在一个 Clip 内出现多个 `<d>`，必须能证明它们是被新事件或另一位说话者分开的独立发言；否则视为连续对白被错误拆散并在提交前失败。

原生音频存在不代表通过。若模型路线不支持或结果不合格，可做明确的 post lip-sync 修复，但不得静音全部原生声音后只贴对白；保留或重建环境、Foley 和 SFX。

## Continuation

不要将上一视频的稳定尾帧直接作为下一 H3 请求的输入。下一 Clip 通过自己的完整分镜导演板、实际出镜身份板、当前完整场景板、必要道具板和明确的连续性语义自行建立新构图与动作；不为常规身份保真追加单视角人物图。

若真实 QA 显示下一 Clip 无法接住上一 Clip，先核对上一板末格 是否已经收束当前事件并交出注意力、下一板 P1 是否继承同一动作/道具/空间状态且真正改变摄影覆盖。使用前后原完整整板和 current 资产只修这两个边界格；若需要真实尾部证据，尾帧只进入静态图片编辑。只有修板后多人关系仍不稳时，才生成干净彩色关系锚点；它优先辅助 末格/下一板首格 修板，修板后 H3 仍失败时才作为下一 Clip 的后续 `<Picture N>` 输入。下一批同场 Clips 若关系未变可复用同一 current 锚点，完整分镜故事板仍分别控制各自的镜头、动作和表演。原始尾帧不直接进入 H3；不要把锚点变成每段必做步骤，也不要仅因接缝失败自动改选 FL2VA。

## Repair

先判断问题属于：表演、身份、场景、几何、摄影机、对白/声音、连续性、时间、技术文件。

先按 Prompt Skill 的通用返修分流选择最小且真实可行的路线，不以任务状态替代画面判断。本 Skill 只定义视频模型差异：H3 不支持假性时间段局部编辑。完整分镜 Clip 中一个 Shot 失败时，先判断能否沿自然切点生成独立替换 Shot 交给必剪；否则必须完整重编译并重拍该 Clip，不能声称只修改原视频的一个时间段。

### MiniMax H3 Retake

H3 不做“只修一个时间段”的假性局部编辑。H3 返修针对一个明确 H3 Clip 或拆出的独立替换 Shot：

- 复用当前身份、场景、道具、Voice、完整分镜导演板和对应 Shot 语义；若原请求已使用白模 `<Video N>`，同时复用同一白模并先核对其实际输入支路和标签映射；只有该缺陷确实涉及状态衔接时，才增加相应的干净彩色状态图；
- 只指定一个可观察缺陷与一个主要变化变量；
- 写出必须保持的身份、服装、地理、道具、方向、光线、对白和结尾状态；
- 用诊断后仍适用的 H3 模式重拍完整 Clip/独立替换 Shot；通过 QA 后采用为新的 current 视频版本。模式变化（例如 Ref2VA 改为 FL2VA）必须来自任务端点需求，而不是无依据重试。

只有当前提供方确实支持且已验证了目标编辑能力时，才使用 `targeted_edit` 修复明确范围；仍需保留原视频、相关参考、唯一问题和 preserve list。`post_fix` 只处理不改变剧情表演的剪辑、字幕、混音或技术修复。

局部问题不重做整场。无法按当前路线修复时报告真实阻塞，不使用幻灯片、拼贴、故事板动画或静态推拉替代 AI 视频。

## Media QA

按 [真实媒体验收与最小返修](../ai-media-prompt-compiler/references/media-acceptance-and-repair.md) 的六项视频检查，在正常速度和目标画幅下观看真实成片；Look/色光部分同时遵循 [Look / Color Continuity](../ai-media-prompt-compiler/references/look-color-continuity.md)。它已定义何时把“表演呆板”作为明确的 `performance_flat` 缺陷，而非无限重抽的风格偏好。

使用 [FFmpeg 媒体助手](../short-video-production/references/ffmpeg-media-helper.md) 做按需技术检查：先用 `ffprobe` 读取真实时长、画幅、FPS、视频/音频流，再从源 MP4 直接抽取开场、关键动作和结尾帧查看；不要用播放器、ComfyUI 队列或桌面截图代替源帧。抽帧用于定位问题，不替代正常速度观看、声音检查或真实内容验收。只有字幕、封装、裁切、色彩空间或明确的技术音轨问题才可按该页使用 FFmpeg 做 `post_fix`；不得用它把静态图、导演板或不合格镜头伪装成视频。

只在高风险连续性、快速动作、对白或可见瑕疵时做逐秒/逐帧检查。使用白模 `<Video N>` 时，额外比对成片是否保持它规定的相机方向/主路径、工作侧、人物调度和动作节拍；不以白模材质、人物代理外形或像素相似度验收。同一 Clip 内相邻 Shot 及相邻 Clips 的高风险接缝，静默预览前一段尾部与后一段开头约 2–3 秒，检查姿态、手/持物、目光、屏幕方向、Location + View、主光、环境底声及其空间距离、对白尾音和动作声；使用关系锚点时，还要逐项核对具名人物/群像簇的画面区域、前后层次、身体与视线朝向、相对体量、双方距离/通道和道具归属是否保持，而完整分镜要求的景别、构图、动作与信息变化是否仍然发生。多人场面还检查具名角色未被替换、每个未获准改变的 `Crowd-*` 簇仍在同一相对区域/朝向/密度与通道中。对路径动作还要看人物相对锚点的位置、行动阶段和道具归属是否可从上一末态到达。连接道具再核对归属者、两端、路径/余量与模式，不能把“已连接”接成“无连接的自由移动”。直接切镜必须兑现事先声明的覆盖变化；没有变化是 `camera_failure`，无解释的到达/下跪/交接/开门、连接消失、群像静默重排或模式跳变是 `space_prop_continuity`。若规划已错，先用原整板和相同参考修目标 Panel、补 `transition` 或重拆受影响 Shot；若整板正确而 H3 执行失败，有自然切点时生成独立替换 Shot，否则重拍完整 Clip。若同场底声被无故重置、门/距离变化却没有相应声场变化、动作缺同步 Foley/SFX，先修声音语义或在必剪做最小可编辑修复，不重拍正确的视觉表演。通过的片段在 Canvas 显式采用真实 run/output；媒体留在持久存储，必剪所需文件通过导出取得，不以磁盘 current 标记代替采用。生成记录、History 或可播放文件本身不代表 QA 通过。

连续 Shot 还要检查 Project / Scene Look、Color / Lighting State、肤色、阴影/高光、黑位和强调色来源是否保持同一综合色彩语言。只有已声明 Light ID 的亮灭、闪烁、遮挡、局部反射或可见新光源可以改变色光；每镜无原因换白平衡或套综合色彩滤镜不通过。

人物 Shot 额外检查：身份稳定但姿态/表情是否被参考冻结，动作是否只有结果没有过程，身体重心/肩颈/四肢/呼吸是否真正变化，微表情是否只是重复瞪眼张嘴；相邻 Shot 的 Camera / Body / Information 是否按设计至少改变两项或具有明确固定覆盖理由，前景/主体/后景是否仍是同一模板。未兑现即分别归为 `performance_flat` 或 `camera_failure`，不因脸和背景一致而采用。

## Optional Upscale

只有选中视频在目标裁切下明显偏软时才做 RealESRGAN 2x。超分后重新检查脸、手、纹理、闪烁、时长、FPS、音频和同步。失败则继续使用原视频；超分不能修复创意或动作错误。

## ComfyUI

视频通过画布 MCP/工作台的预览和入队能力调用管理员所选 H3 工作流。先核对最终提示词、有序实际素材和参数，再冻结提交当前 Clip；候选保存后仍需正常速度视频/声音 QA，再明确采用。草稿改变不撤销排队快照，未知提交不重发；普通生产不构造执行图或直发底层请求。

视频只由所选的 `MiniMax-H3_01/02/03` 执行；不依赖编号式辅助流程。精确请求、History 和技术日志留在输出目录。真实结果不明时才查队列、History 和输出，再决定是否重提。

## Handoff

把数据库中采用视频的 runId/storageId、所选原生或替换声音、目标时间线位置和必要剪辑说明交给 Audio 与必剪，导出实际采用媒体而不改写采用历史。只有实际使用的彩色接桥图才作为参考交接；最终内容选择在完整成片中完成，不逐 Shot 打断主人。
