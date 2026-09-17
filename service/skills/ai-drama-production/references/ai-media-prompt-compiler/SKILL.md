---
name: ai-media-prompt-compiler
description: Compile current story, visual, motion, sound, and reference requirements into image and H3 Clip semantic briefs and prompts. Use as a companion to ai-drama-visual-assets or minimax-h3-video-production for boards, images, targeted edits, final prompts, and prompt review; it never generates, adopts, binds, enqueues, or replaces the owning production Skill.
---

# AI Media Prompt Compiler

## Canvas Production Boundary

进入漫剧生产前读取 [Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md)，先调用 `get_canvas_summary` 并核对真实项目/分集/Clip ID 与 revision。创作源文件可以保留；生产交接写入并读回 Canvas 对象，不维护第二份资产或状态台账。

所有画布节点严格遵循生产契约中的 [Infinite Canvas 源提示词标准](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md#infinite-canvas-源提示词标准)：只编辑语义正文和 UI 缩略图令牌，媒体职责通过结构化绑定保存；不得把预览生成的 `<Picture N>` / `<Video N>` / `<Audio N>` 写回源节点。旧模板的文件路径/current 标记不构成 Canvas 采用记录，采用必须对应真实持久媒体版本与 QA。


本 Skill 解决提示词弱、动作呆、参考图没有真正参与、不同模型格式混用的问题。它只负责编译和检查提示词，不管理执行。

## Shared Semantic Brief

按以下顺序整理：

1. Purpose：这张图或这个 Shot 对故事有什么作用。
2. Subject：人物、外观、道具、数量和关系。
3. Action：可观察动作、触发、准备、执行、反应和结果。
4. Environment：地点、空间、地标、时间、天气和环境运动。
5. Composition/Camera：景别、机位、主体位置、镜头行为和焦点。
6. Light/Style：解析当前 Project Look → Scene Look → Color State → Lighting State，写光源方向、肤色、阴影/高光、黑位、强调色职责、材质和媒介；不复制整份 Bible。
7. Sound：对白、Voice 参考、环境、Foley、SFX、音乐或 none。
8. Continuity：上一状态、必须保持、允许变化和结尾状态。
9. Failure Avoidance：只供内部检查当前任务真实风险。静态图片按其提供方实际机制处理；H3 最终提示词保留官方六段标签和引用语法，正文用自然中文表达当前可见、可听事实，不新增项目自定义的 negative-prompt 字段或禁词规则。

涉及导演板或视频时，读取 [镜头语言与运镜选择](references/camera-direction-playbook.md)。根据当前 Beat 的注意力、空间、关系、信息和节奏自动选择合适的固定机位或主运镜；不向主人索取镜头术语清单，也不把技巧当成平均分配的装饰。

摄影默认稳定，移动机位写成平滑受控的路径和停稳落点；手持/震动仅为明确选定并限定时段的例外。人物动态、情绪紧张、POV 与切镜数量不能自动转化成持续镜头抖动。具体选择和正向写法只维护在上述镜头参考页。

## Reference Roles

每个输入只承担明确角色：

- identity board：脸、头发、身体比例、当前 Look、服装和固定配饰；完整身份板直接作为 H3 人物参考，不额外生成、裁取或传入单视角人物图。必须声明板内中性表情、站姿、白底、分区、文字和多视图布局不得成为 Shot 表演或成片内容；
- expression board：完整 `expression` 人物表情板以对应 Character 或 Character Look 为父级，只服务上游分镜导演板，禁止作为 H3 Picture。H3 的表演默认由完整导演板的动作阶段、身体表演、微表情与强度，以及最终 Prompt 的可见动作链共同控制；制作拆解已识别的关键近景、特写、大特写或真实 QA 返修可使用一张父级为该表情板的干净单状态 `reference`，限定为当前 Clip/Shot 的微表情与身体反应语言，不控制身份、Look、动作阶段、视线目标、构图或其他 Shot；
- geography：当前 Location + View 的场景结构、入口、地标和光线；
- same-view continuity anchor：仅在静态分镜导演板生成时使用的同一已建立 `Location + View` 已采用参考，只控制该 Camera Zone 下实际可见的背景层次、固定陈设与空间锚点；多人场面还继承未获准改变的人物/群像簇区域、朝向、密度与通道。它不能锁定新 Shot 的景别、焦段、机高、构图、主体位置、姿态或表情，不能替代身份、道具状态或新角度的空间事实，也绝不作为额外重复 H3 Picture；
- prop：形状、数量、状态和归属；跨镜连接道具还控制归属者、端点 A/端点 B、可见连接路径/滑动方式和当前模式，不能借此改写身份或空间地理；
- director board：当前 Clip 的完整导演规划，控制 Shot 顺序、覆盖、构图、动作阶段、工作侧、空间锚点、Look 与状态交接；它作为 H3 `<Picture 1>`，不拆成多张 Picture；
- relational blocking / bridge image：仅在相邻整板 末格/下一板首格 已完成交接设计和定向返修后，真实 QA 仍证明复杂关系不足时，控制指定 Shot 或相邻 Clips 必须继承的站位、前后层次、身体/视线朝向、人物体量、道具归属、地理与主光；它不控制 Shot 顺序、表演或摄影变化，也不是每个 Clip 的默认输入。使用时读取 [跨 Clip 故事板交接与关系锚点](references/clip-boundary-blocking-anchor.md)；
- style / Look：当 `Look route = project_look_board` 时，`LOOK-PROJECT-*` Global Project Palette 是全片母色板；`LOOK-SCENE-<LOCATION>-<STATE>` Scene Palette 只在特殊主场景具有跨多个 Shot/Clip 复用的独立综合色彩家族时，从母色板派生。身份板和跨场景中性道具使用母色板；场景/View/分镜导演板优先使用 current 子色板，没有子色板时使用母色板；父子色板不得同时进入同一请求。色板只控制色域、冷暖比例和强调色关系；媒介/渲染语言、肤色保护、阴影/高光、黑位、材质响应和画面密度由文字 Project Look 控制。H3 的综合色彩由完整整板承载；整板无法稳定 Look 时先用最具体的 current 色板修正或重做整板，不给 H3 追加色板图片；
- motion/camera donor：只参考运动或摄影行为；
- format/layout example：来自 Visual Skill 案例库，只在静态模型连续无法理解目标板式时作为最后一张参考，控制区域比例、信息层级、主次面积与留白；不得控制人物、场景地理、道具形制、综合色彩、文字、剧情或实际 Shot 内容，不进入 H3；
- whitebox previs video：每个已通过的 Blender 预演视频只对应一个同场、连续时间的 Clip，按实际 `<Video 1>`/`video_1_frames` 控制实际各 Shot 的拓扑、调度、节拍、切点和相机路径。不控制最终身份/Look、材质/色彩、场景美术、道具形制、Voice 或声音，也不跨场或拼贴；
- voice/audio：只控制当前 H3 Clip 实际各 Shot 中实际说话角色、画外说话者或旁白的声明音色、口音、基础节奏或指定声音层；沉默出镜角色不得因其身份板存在而加入 Voice 样本。代表样本不锁定样本里的具体情绪、房间/话筒感、背景声或原台词。

写清每个参考控制什么、不能控制什么。实际请求必须真的传入所需参考，不能只写“参考已接受身份板”。

H3 最终提示词遵循“来源媒体”和“可见内容”分离：默认 `<Picture 1>` 是当前 Clip 的完整导演故事板；后续 Picture 固定按实际出镜人物的完整身份板、关键近景所需单状态表情参考、当前完整场景板、实际关键道具板和其他必要参考排序。它们分别控制镜头计划、人物身份、指定 Shot 的表情/身体反应语言、场景地理和道具形制/State，并在 `subject_definitions` 中映射为对应 `<Subject N>`；后文用同一个 `<Subject N>` 追踪成片里的可见内容。完整宫格表情板禁止直接进入 H3。提示词明确所有板或参考都是规划/识别来源，最终输出是完整彩色电影画面，不保留网格、编号、箭头、白底或板式。所有 Subject、Picture、Video、Audio 标签必须指向真实已连接且承担该职责的输入。

参考槽没有固定填满要求。按当前 H3 Clip 的一张完整分镜故事板、实际出镜角色的完整身份板、关键近景所需单状态表情参考、当前完整场景板、确实出现的关键道具板和实际 Speaker 选择最小充分集合；故事板占一个 Picture 槽，不把分镜裁图分别上传。当前 H3 Ref2VA 最多九张图片：超出时优先保留导演板、实际出镜身份板和当前场景板；单状态表情参考仅在它承载关键剧情信息时优先于次要道具或一般参考。制作拆解已标明高风险，或真实 QA 证明某个构图/状态无法由这些板控制时，才追加一张限定 Shot/连续关系职责的干净彩色关系锚点。跨格/跨 Clip 连接道具只要影响行动、剧情或下一开场，就属于关键道具。未使用槽直接断开或省略，禁止用重复或无关素材填槽。

静态图的多个真实参考使用一个有序 IMAGE 批次，不生成参考拼贴图。读取 [static-image-reference-batch.md](references/static-image-reference-batch.md)，在最终图片提示词与请求中保持相同的图片顺序、角色和越权禁止项。一个资产 ID 或完整分镜导演板对应一张候选图：执行参数固定 `number_images = 1`。不要为了探索变体而让同一生产请求返回多张近似图片；确需不同创作方向时先明确成不同资产/Clip 目的和各自输出前缀。

涉及色彩与灯光继承时读取 [Look / Color Continuity](references/look-color-continuity.md)，并服从已选择的 `Look route`。`project_look_board` 路线下，当前请求必须真实连接唯一一张最具体的 current Palette：身份板/跨场景中性道具使用 Global Project Palette；场景/Scene View/分镜导演板有 Scene Palette 时使用子色板，否则使用母色板。只写 Look ID、同时绑定父子色板或没有实际图片绑定都属于编译失败。`text_only` 路线才只从文字 Look 解析当前请求。色板自身的生成提示词必须使用纯色色块分组的正向结构。H3 整板无法覆盖综合色彩高风险时，先用最具体的 current Palette 修正或重做整板，H3 继续从整板继承综合色彩。

## Narrative / Functional Shot

对话、观察、对峙和 POV 不能只写“看向对方”。为每位相关角色编译 `注视目标 → 目标的场内位置/距离/眼线高度 → 摄影机观察位置 → 脸部角度 → 视线转移触发与新目标`。普通客观镜头使用斜侧、越肩或已建立工作侧，让双眼落在场内人物、道具、入口或显示器；只有明确 POV、自拍、视频通话、演讲或直面观众时，才正向描述人物注视镜头方向。身份板正面目光不得越权成为剧情视线。

先判断当前镜头的类型：

- 叙事镜头：人物有目标、阻力、选择、关系或可见转变时，使用导演意图把“前后变化、可见矛盾、不可替代细节、拒绝的俗套”转成动作、构图、光线或声音载体。
- 功能镜头：产品、环境、操作、材质或纯空间镜头只写观众需要验证的具体效果与不应虚构的戏剧内容；不为填字段臆造欲望、冲突或心理戏。

这是内部创作判断。最终模型提示词只保留可见、可听、可生成的结果，不输出这些标签。

## Performance Direction

有人物表演时，提示词必须包含 trigger、physical preparation、committed action、response/interruption、reaction/choice 和 changed end state。

把稳定身份和动态表演明确分开：身份/Look 只锁脸、年龄、发型、体型、服装和固定配饰；重复主角先继承其文字“角色表演语言”，每个有人物情绪推进的 Clip 再建立 `开场状态 → 可见触发 → 上升/压制/爆发/回落 → 结尾残留状态` 的表演曲线。逐 Shot 重新设计身体姿态、重心、头部、肩膀、手臂/手、腿、躯干、视线、呼吸、微表情与情绪强度。动作 Panel 优先捕捉 `mid_state`，即动作已经开始但结果尚未完成；不要只写“站起、转头、后退”等终态。需要重复近景、微表情信息、关键情绪转折，或审讯/悬疑/亲密表演时读取 [人物表情板方法](references/character-performance-board-method.md)，按 `Character + Look` 制作完整表情板供分镜导演板使用；关键近景可在首次 H3 前绑定其单状态子参考。

表情状态名与相对强度只是内部索引，最终图片/H3 语义必须展开成：触发、眼球焦点与聚焦距离、上下眼睑张力、眉间/眉峰、嘴唇/下颌/面颊、呼吸与颈部张力、身体重心/肩颈/手臂/躯干协同，以及结束时的可见变化。不同角色采用各自反应习惯；禁止用统一的瞪眼、张嘴、皱眉模板替代人物表演。

对白还要有说话前任务、说话时动作、听者或环境响应、说完后的变化。若只是人物站着或坐着念台词，退回重写。

给每个 Clip 一个主要保真目标：identity、motion、geography、dialogue 或 geometry；最多一个次要目标。分镜内部每个 Shot 必须有独立 Beat、递增切点和状态交接。过载时沿换场、换时、地理/状态不兼容、对白/动作容量或真实 QA 证据拆成下一个 Clip，不按单个反应或机位变化拆成独立请求。

## Image Profiles

### Identity Board

一次请求生成一张完整多视图艺术板。板内固定分成两个清晰区域：约 35%–40% 的颈根以下身体结构区，以及约 60%–65% 的大尺寸头部身份区。头部区默认严格收敛为 3 个大视图：最大的正面主视图、一个 3/4 视图和一个侧面视图；不重复左右对称角度，不默认加入后脑或额外五官小图，让每张脸获得更多有效像素。提示词包含身份锚点、唯一当前 Look、头身对应关系、服装与固定配件的材质/主次色、识别友好光线、简洁背景、清晰分隔和艺术书布局。身体区的颈根裁切必须是中性的制作研究，不得出现伤口或暴力含义；头部区保持基础中性表情，不承担 Shot 表演。比例作为请求参数，不在自然语言里反复堆叠。

需要完整模板时读取 `references/identity-board-prompt-method.md`。

身份板只负责不可变身份与 Look，不是 Shot 表演权威。主要角色出现重复近景、微表情承载信息、关键情绪转折、审讯/悬疑/亲密场面或已知表情僵化风险时，读取 [人物表情板方法](references/character-performance-board-method.md) 制作一张独立 `expression` 表情板；它不替代身份板，并只服务分镜导演板。H3 不因一般面部、全身或表演风险自动新增单视角人物图片；但制作拆解已标记的关键近景、特写或大特写可在首次生成前使用该表情板下属的一张干净单状态 `reference`，无需等待失败。

### Scene

场景主图默认空场，明确空间结构、固定地标、尺度、主光、当前 View、可见边界、文字策略和使用角度。新 View 只能从 current 场景图改变机位与朝向，不能补造或重排未建立的另一侧空间。避免只有电影感、高清、震撼等抽象质量词。

重复或空间复杂的地点还读取现有 Scene Bible：Scene Master、Anchor ID、按需 Top-Down/Blender 空间关系、动作轴线、Blocking Zone、Camera Zone 与已采用 View Library。只把当前请求实际需要的空间事实写入提示词；Camera Master View 只控制地理与锚点，不锁定后续 Shot 的精确机位、景别、焦段、构图、前景、景深或人物调度。场景生产等级和稳定/动态边界见 [Scene Bible 与 Shot Package 分工](../ai-drama-series-production/references/scene-bible-and-shot-package.md)。

场景电影静帧方法见 `references/cinematic-still-prompt-method.md`；Location + View 生产参考使用 `references/location-plate-prompt-method.md`。

### Prop Plate

一个道具板只对应一个 `Prop + State`，先写它以后要被哪类镜头复用，再按“稳定形制 → 当前状态 → 可操作结构 → 尺度/视图 → 材质/光线 → 文字策略 → 保持/排除”编译。持有人、开闭、内容物、污渍和可追踪破损属于 State；临时手位、画面左右位置或一次动作属于 Shot 状态，不为此新建道具板。目标道具作为静态参考批次的首图；角色或场景只在尺度、佩戴、安装或使用关系确有需要时加入，且不得改写道具形制或状态。

需要完整模板时读取 `references/prop-plate-prompt-method.md`。

### Complete Adaptive Director Board

先从剧本可见动作、自然对白和信息变化确定实际 Shot 与时长，再组织连贯 Clip。制板时读取 [自适应导演板模板](references/director-panel-prompt-method.md)，完整填写工作台镜头设计后，用页眉、大幅全彩主镜头、格外编号/时间和底部真实参考/简表呈现；不固定格数、时长或 2×4 布局。主镜头和最终 H3 Shot 按实际 N 一一对应，底部参考不增加视频镜头。保留 current 身份、地理、道具、Look、动作过程及交接，摄影与表演可随戏变化。

当前 Shot 有已通过的 Blender 白模预演时，将其摄影/调度合同完整转译为上述可观察字段：保持同一工作侧、景别和画面关系，并把镜头曲线压缩成一个有起点、触发、幅度和落点的主摄影行为。白模渲染不自动进入静态图片批次，绝不成为 H3 `<Picture N>`。

多人、对话、对峙、递交、进出门、追逐、打斗、武器或技能攻击，或新 View 时，读取 [分镜导演板与空间连续性](references/production-keyframe-shot-method.md)、[场面调度与 Shot 职责](references/blocking-and-cut-staging.md) 与 [镜头覆盖与状态交接](references/coverage-and-handoff.md)：裸写左右等于观众画面左右；写明轴线、摄影机工作侧、3–5 个可见固定锚点、持物与允许越轴方式，并声明每个高风险 Shot 是建立、主动作、反应、插入还是转场。三人以上、围堵或群像还明确焦点人物/具名配角的锚点区域、匿名人群簇的人数/区域/朝向、通道与唯一允许重排；不要用“周围一群人”让模型自行发明站位。相邻 Shot 还要写观众新读到的事实、覆盖变化、切点理由和可见交接；完整整板使用身份/场景/道具的有序真实参考，同一 View 的背景事实由 current View 和必要的连续参考约束。打斗、武器、法术、异能或巨物攻击还读取 [高密度打斗、技能与能力调度](references/combat-and-ability-staging.md)：先完成 Clip 级连续攻防编舞，再把每一次可读战术变化分配给一个 Panel。失败时以原整板和相同参考只修目标 Panel，并复核其余格及前后状态。

`Location + View` 只锁空间拓扑、轴线、固定锚点与主光；`Camera Zone` 定义同一工作侧内的合法摄影区域，允许前后左右、升降、焦段、景别、过肩、前景遮挡和小幅角度变化。same-View 连续参考只继承背景事实，不得迫使新 Shot 复制旧构图、机高、焦段、主体位置或人物姿态。默认先把同目标的连续微动作、对白、反应与摄影跟随合并成一个 Shot；只有新必要事实、必须换位才能读清的动作、观察立场变化或不可替代的节奏重音才建立切点。切点成立后，相邻 Shot 除非有明确的固定覆盖理由，通常让 `Camera / Body / Information` 三项至少两项出现可读变化；该检查不得用于反向制造镜头。

## Video H3 Clip Brief

读取 `references/video-shot-semantic-template.md` 建立内部 Master H3 Clip Contract，再由 Prompt Skill 按官方 H3 参考结构写最终中文 Prompt。默认选择 实际时长、分镜故事板驱动的同场多 Shot Ref2VA；Base 与 FL2VA 仅按明确任务选择。Master Contract 不复制项目控制信息或完整 Bible，也不直接作为 H3 文本。多人、对白、关键交互、连续性、悬疑揭示、冲突/技能攻击时额外读取表演、调度、交接与技能参考页。打斗 Clip 默认采用“高密度连续攻防”而非零散招式列表：先定双方事实、战斗载体、空间路线、优势转换和结尾余势，再将每次攻击/应对/位移/环境反馈分给实际各 Panel。一个 H3 Clip 写：

- 已经发生、当前只做什么、以后才发生；“现在不能展示”的内部边界在最终 H3 提示词中改写为本 Shot 此刻应保持的正向信息状态；
- Ref2VA 使用完整分镜故事板，以及“Panel 顺序 → Shot 切点 → 动作/表演 → 摄影/声音落点 → 状态交接”的映射；仅为后续高风险构图或状态追加职责明确的 Picture。FL2VA 另行记录两张经过 QA 的开场/落点帧及两端之间的唯一连续过程；
- 同场上一 Clip 存在时，把边界编译成明确事实而非“延续上一段”：当前 `[Shot 1]` 写出继承上一板 末格 的位置、朝向、重心、视线、手/持物/连接、光声和准备阶段，并写明本镜相对上一覆盖改变的景别/焦点/机高/前后景/POV；当前 `[Shot N]` 写出本段已完成事项、当前说话者闭口/道具落位、注意力交给谁，以及下一行动者只准备到何种程度。末格/下一板首格 状态连续但构图不得重复；
- 开头角色/道具/镜头/声音状态；
- 有台词时的声源（画内 / 画外 / 旁白）、精确文本、口语语言与实际表演时间窗口；Voice 参考的控制项与不控制项。一次连续发言的完整可朗读原文只归属于一个 Speaker 的一个 `<d>`：跨镜头时仅在认领 Shot 写一次完整原文，其他 Shot 只写“同一次连续发言的准备/中段/收束/说完后阶段”和身体表演，不能重复原句、短句、关键词、引号内容；AMB、Foley、SFX、summary、retention 与 `overall_soundscape` 也只描述时机和声学状态，不复述可朗读词语；
- 对白情绪遵循官方 H3 分层：`<d>` 内只保留真正朗读的精确原文和原文标点；标签外用一句大白话写当前情绪、必要的语速或音量变化和一个最关键的可见动作。内部可以检查口型、呼吸、停顿、目光和身体协同，但不得把这组检查项原样写进最终 Prompt，也不得写“严格参照声音身份与演绎节奏”等音频套话；
- 连续动作和表演节拍；
- 逐 Shot 身体/表演在内部合同中检查身体姿态、重心、视线、呼吸、表情与动作阶段；最终逐镜正文只保留会改变画面的一两个具体反应，不罗列身体部位或表演维度；
- 高风险 Shot 的功能、唯一完成的主状态变化、行动主导者、其他人的受控反应，以及交给下一 Shot 的状态；三人以上时还写焦点人物/具名配角的区域、匿名人群簇的区域/朝向/人数与唯一允许重排；主动作只能在一个 Shot 完成，其他 Shot 不重演；
- 与上一 Shot 的覆盖关系和切点理由：新 Shot 至少让观众读到新的景别/取景重点、观察侧/POV、人物或道具关系之一；若没有，就合并而不是编造镜头；
- 对跑向、靠近、递交、开门、落座、蹲下操作等路径，写上一末态 → 当前起点 → 可见过程/完成动作 → 当前末态 → 下一开场，并以命名锚点、朝向、行动阶段和道具归属表达。同一人物在连续 Shot 中默认继承上一镜的世界位置与屏幕区域；只有可见移动、明确的新机位或有动机换轴才能改变。不要先写“在左侧”，随后无过程地改成模糊的“在画面边缘”；
- 仅在事实会改变选择、权力、关系、恐惧或观众理解时写信息链：`给出/隐藏 → 载体 → 触发 → 接收后的可见后果`；没有后果不为“反应”硬切。新场次/集的开头优先让主体动作、异常或决定进入，Shot 尾按真实的 `resolve / edit_point / extension_anchor / hero_hold / reveal_punch` 落点收束，而不是默认悬念；
- 一个主要镜头行为；
- 当前 Camera Zone，以及景别、焦段意图、机高/角度和前景/主体/后景层次；只有真实切镜理由成立后，才检查同场相邻 Shot 通常让 Camera / Body / Information 至少两项发生变化，有目的的固定覆盖除外；
- 环境与声音响应：每个 Shot 写声源、`AMB=延续/进入/退出 + 可听空间锚点`、与可见动作同步的 Foley/SFX；同场相邻 Shot 默认延续同一底声和相对距离，只有门、距离、机器、天气或 Location + View 真实变化才改变。`无台词` 仍明确环境/Foley/SFX；
- 当前 Look Continuity Block：只写已解析的 Project / Scene Look、Color State、Lighting State、肤色/阴影/高光/黑位/强调色 preserve，以及本 Shot 唯一允许的有动机变化；
- 非画内音乐只写 `none / 延续 / 进入 / 退出 / 为对白让路` 的相对 Cue，由必剪跨 Shot 铺设，不能让每条 H3 视频各自重新起配乐；画内音乐必须写可见/可听声源与空间位置；
- ending purpose：resolve、edit point、extension anchor、hero hold 或 reveal punch；
- 可验证的最终状态。

H3 Ref2VA 的 `<Picture 1>` 固定为当前 Clip 的完整分镜导演故事板，控制 Shot 顺序、摄影覆盖、人物调度、动作阶段、空间锚点和 Look/情绪递进。之后依次加入实际出镜人物的完整身份板、关键近景所需单状态表情参考、当前完整场景板、实际关键道具板和其他必要参考；完整人物表情板、静态生图阶段的 same-View 连续参考和常规单视角派生图不追加为 H3 Picture。实际 Speaker Voice 或关系锚点按需加入。单状态表情参考在 `subject_definitions`、`retention_analysis` 和实际适用 Shot 中一致声明它只控制该角色的微表情与身体反应语言；关系锚点则只冻结开场/关系几何和状态，不冻结摄影、动作或表演。人物、场景、表演与道具从实际来源抽象成 `<Subject N>`。换场、复杂状态交接、动作/对白过载或真实 QA 失败时新建下一个 Clip。FL2VA 使用两张目的明确的端点帧；两张端点不得来自上一条成片原始尾帧的自动串接。

项目选择 Blender 白模预演时，把该 Clip 唯一通过 QA 的 `*_reference.mp4` 接入 `<Video 1>` / `video_1_frames`。在 `subject_definitions` 和依赖其调度的 Shot 正文中紧邻 `<Video 1>`，正向声明它只提供实际各 Shot 的相机路径、空间调度、动作节拍与切点，最终形体、材质、色彩和声音持续服从 Picture/Subject/Audio。它不替代 `<Picture 1>`，也不使用上一 H3 成片尾帧。若实际槽位或标签映射不能成立，报告路线失败。

每个 H3 Clip 从其中全部精确 Lines 反查实际 Speakers：只传真实发声者的 current Voice 样本，并让每个 Audio / Subject / Speaker / `<d>` 一一对应。一次连续发言选择唯一 `dialogue_owner_shot`；完整原文只在该 Shot 的一个 `<d>` 中出现一次。若同一 Speaker 在本 Clip 内确有第二次独立发言，必须由剧本中的新触发、新回应或另一说话者明确切开，否则合并为同一个 `<d>` 或拆到下一 Clip。没有任何台词的 Clip 不传角色 Voice；画外对白和旁白只传实际说话者的 Voice，不因画面中出现其他角色附带样本。

语义时间可以连续规划，但不要把某模型时间戳格式当成通用格式。

## Provider Handoff

Prompt Skill 是唯一语义作者：输出一个已绑定真实参考的共享语义 brief。它不执行媒体，也不为同一请求反复重写剧情、动作、镜头或声音意图。

正常项目读取 [Infinite Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md)，先 `get_canvas_summary` 并读取 Clip/Shot、当前节点草稿与有序资产版本绑定。通过预览确认实际图像、视频、音频职责及顺序后，Codex 完成语义正文和结构化引用，仅预览/提交编译器生成提供方媒体标签；不使用旧文本提及解析器，不猜 storageId，不跨 Clip 复制旧编号。输入绑定不从正文自动推断，工作台也不改写 Shot、对白、时间线或专业 Prompt；引用/槽位变化后重新核对预览，只影响新提交。

读取 `references/provider-boundaries.md` 后，将语义 brief 交给模型对应 Skill 只做官方格式转换。H3 的六个段落名、任务类型、关系标记、媒体/Subject/Speaker 标签、`[Shot N] At MM:SS.mmm,` 与 `<d>[Chinese]…</d>` 保持固定兼容格式；六段说明与逐镜正文使用自然中文，精确对白和画面可见文字保留原语言。内部导演卡可继续用中文，但不能复制为最终 H3 的字段式 Prompt：

- MiniMax H3：严格使用官方 Base 三段或 Ref2VA 六段结构、标签与音频规则。
- 静态图片：只使用当前 OpenAI-compatible 图片节点支持的字段。
- MiniMax H3：不输出独立 negative-prompt 字段、后缀或项目自定义的禁词段；其自然语言表述遵循官方参考格式。静态图片仍按所选图片提供方的真实能力处理。

模型 Skill 可按模型能力、长度、标签、时间和参考输入规则转换格式，但不得改变已交付的语义、参考职责或可见结果。每次 ADD / REPLACE / REMOVE / MOVE / RETIME，先重算受影响的 Shot 顺序、切点、媒体标签、Speaker、声音和端点，再从当前有效语义完整重编译最终 Prompt；不向旧 Prompt 追加修补段落或保留失效内容。

## Lint

H3 Ref2VA 的 `detailed_description:` 可直接进入 `[Shot 1]`，也可先写一至两句纯风格开场。开场只保留媒介、真实度、综合色彩、材质与整体影像气质；第一帧、参考、切镜、运镜、动作、表演和声音进入前三段或对应 Shot。参考顺序与控制职责只在 `subject_definitions`、`summary`、`retention_analysis` 声明，不在每个 Shot 重复“实际参考按序为”等素材清单；逐镜正文只写故事世界里真实出现和发生的内容。

小说改编或已有 current 正式导演板时，不能只从 Clip 摘要批量扩写最终 Prompt。必须逐 Shot 同时读取制作剧本、小说对白去向表和 current 导演板卡片，建立 `Shot 编号 → 精确切点 → 小说动作事实 → 精确对白 → 导演板构图/调度 → 末态` 的临时合同，再从该合同完整编译。禁止使用“镜头按导演板切换”“人物和道具按上一末态变化”“听者按导演板回应”等通用句替代实际内容；这些句子即使满足字数和六段结构，也属于编译失败。最终调用 H3 校验器时传入 `--shot-contract`，确认切点、必须事实和对白与合同完全一致后才能进入工作台提交。

提交前静默检查每个 Beat 的 Shot 或画外载体认领、故事目的、可见变化、真实参考绑定、动作负载、镜头动机、时间和对白、结尾状态、Project/Scene Look 与 Color/Lighting State 继承、参考冲突和官方 provider 语法。小说改编项目还必须逐行对照制作剧本中的“小说对白去向表”：归属当前 Clip 的每句精确台词必须落在唯一 Speaker、唯一 Shot、唯一 `<d>`；合并或转移项的剧情功能和承接位置必须兑现；删减项必须已有具体理由。出现未登记原文对白、`待 Series 拆解`、无去向台词，或用“询问”“回避”“继续追问”“准备开口”等概述替代已登记完整台词时，提示词编译失败并退回剧本/拆解修正。若 `Look route = project_look_board`，还必须核对本次正式静态请求只绑定了唯一一张最具体的 current Palette、Scene Palette 明确继承父 Global Palette 且只改变允许的场景色、参考顺序与提示词编号一致，并包含紧凑 Look Continuity Block；色板自身的最终提示词只保留正向的纯色色块分组目标。镜头选择必须有目的、起点、触发、路径和落点；固定机位也必须说明画内变化。每句进入视频的台词必须具有声源、语言、自然表演时间窗口和动作承载；一次连续发言的原文只能位于唯一 Speaker、唯一 Shot、唯一 `<d>`，并检查其他 `<d>`、后续 Shot、summary、retention 与两个全局声音段中没有同句、显著子串、短句或引号复述。若精确台词、动作和停顿无法容纳，按真实编辑理由拆成更多 Shot，不得静默压缩或改写。最终 H3 的 `detailed_description` 为简洁自然中文：每个 Shot 直接写人物在哪里、做什么、怎样变化及镜头如何看见；不另起“开场状态是”，不使用嵌套数字条目，不罗列口型/呼吸/停顿/目光/身体动作，也不重复 Voice 控制说明。尤其 `[Shot 3]` 至 `[Shot N]` 不能用省略号、`same as above`、`同上`、`承接上一镜`或一句结果替代。导演卡字段和完整检查清单只保留在上游。每个 Shot 的声音同时核对环境底声交接、动作同步 Foley/SFX 与音乐相对 Cue：同场连续 Shot 不得无故重置房间底声，`无台词` 也不能误编译为无声。将空泛质量词和逗号标签堆改成可观察的动作、镜头、光线、材质、声音或任务特定约束；保留有具体物理载体的类型/时代语言。

当动作依赖精确拦截、双手多步骤编排、多人同时大动作、不可见心理状态或模型未验证的复杂几何时，自动保留原 Beat 的戏剧功能与结果，优先采用更清晰的准备/接触/反应、按真实编辑理由拆为多个 Shot、或更可靠的机位与构图。打斗、武器、法术、异能或怪物能力可在同一 Clip 内形成高密度连续攻防；但**每一个 Panel / 内部 Shot**只完成一轮可读战术变化：写清行动主导者、源头、路径/接触、受控响应、后果和可继承终态。连续 Clip 层面让上一轮的余势、位置、装备和环境结果触发下一轮，而不是把连招、多人闪避、范围破坏和余波压进同一个 Panel。不得借此删除关键事件、提前泄露信息或改写已确认剧情。提交前还要检查高风险 Shot 的主状态变化没有被多个 Shot 重复完成，且反应、插入或转场没有偷偷提前泄露后续结果。

对悬疑、发现、对峙和关系转折，静默核对每个需要控制的事实是否有明确载体、合法揭示触发与接收后的可见后果；不能只让角色“得知了”。同一理解没有导致新动作、选择、关系或观众立场变化时，不为增加节奏强加反应 Shot。场次/集入口若承担钩子，首个 Shot 必须先给出可读的主体动作、异常或决定，而非无关空镜；其他 Shot 仍按实际段落功能选择平稳衔接或明确落点。

相邻人物 Shot 还要静默检查：身份参考是否越权冻结表情/姿态；目标 Panel 是否只是动作结果而没有可继续的动作阶段；Camera / Body / Information 是否至少两项真正变化；前景/主体/后景是否仍是同一模板；表情是否由眼睑、眉间、嘴唇、下颌、呼吸和身体反应共同兑现。若连续出现同景别、同高度、同方向、同姿态、同画面位置与同构图，除非这是明确的固定覆盖设计，否则先重设目标 Panel/Shot，不提交 H3。

当前来源内容、节点生成草稿、有序绑定、最终提交快照及输出归属保存在画布数据库；原始媒体使用既有持久存储，采用为独立显式记录。历史 ComfyUI 技术证据只读保留，不能作为新草稿或状态回写来源。

## Repair Prompts

真实图片和视频的采用标准、三种结果以及可观察缺陷到最小返修的对应关系，统一读取 [media-acceptance-and-repair.md](references/media-acceptance-and-repair.md)。它是内部检查，不创建 QA 项目文件或额外审批。

返修先在内部静默分类：

- `keep`：满足当前主目标和真实 QA，停止追加候选；
- `post_fix`：只需确定性剪辑、字幕、混音、调色或裁切修正；
- `targeted_edit`：仅当前提供方已验证支持的局部图像/视频编辑；
- `shot_retake`：分镜 Clip 中有自然切点时重拍独立替换 Shot，否则重拍完整 H3 Clip；
- `rewrite_prompt_or_board`：提示、输入或分镜导演板无法表达批准 Beat；
- `blocked`：真实基础设施、权利或创意矛盾。

返修时输入原整板或原视频、current 身份/Location + View/道具参考，明确唯一问题、目标变化和 preserve list。一次只改变一个主要变量。导演板的空间、动作或状态不成立时，用原整板和相同参考只修目标 Panel，复核其余格与相邻交接，再重新执行受影响内容；整板正确而 H3 没完成动作、终点或声音时，修 Prompt、参考或模式。有自然切点时重拍独立替换 Shot，否则重拍完整 Clip。MiniMax H3 没有验证过局部时间段编辑，使用 `shot_retake` 而不是伪造 interval edit。若缺的是一个已经在剧本/Beat 中成立的反应、插入或过渡，可生成一个完整的新 Shot 交给必剪；它必须明确认领该 Beat，不能静默替代原 Shot 的其余职责。仅裁切、字幕、调色或混音问题走 `post_fix`。对“风格可以不同但已兑现导演意图”的结果停止追加候选；只有明确动作、反应、摄影或情绪转折落空才视为质量缺陷。

这是通用返修分流的唯一完整定义。Visual Skill 只补充整板/目标 Panel 的修复规则；Video Skill 只补充已验证模型的编辑边界与 H3 Clip 重拍方式，不重复维护这张分流表。
