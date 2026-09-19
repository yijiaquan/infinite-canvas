# H3 Ref2VA 本地生产提示词模板

本页以 `skill/参考Skill/MiniMax-H3-official-prompt-skill` 的 `ref-en.txt` 为基础，供当前本地 MiniMax H3 Ref2VA 编译使用。`detailed_description:` 可按官方方式在 `[Shot 1]` 前保留一至两句纯风格开场，只说明媒介、真实度、综合色彩、材质和整体影像气质；参考职责、第一帧、切镜、运镜、动作、表演与声音全部归入前三段或对应 Shot。它只规定**最终 H3 Prompt**；导演板使用信息栏、大幅镜头画面和底部参考/简表。完整导演字段保留在工作台镜头表，不复制为 `detailed_description` 中的字段清单。

## 写法边界

- 使用六段固定顺序：`subject_definitions`、`summary`、`retention_analysis`、`detailed_description`、`overall_soundscape`、`non_diegetic_music`。
- 六个段名、媒体/Subject/Speaker 标签、关系标记、Shot 标签和时间戳保留固定兼容语法；六段描述正文统一使用英文。对白、歌词和画面实际可见文字保留原语言，中文对白写入 `<d>[Chinese]…</d>`。
- `detailed_description` 用逐镜英文叙述：当前构图、人物/物体位置、环境与灯光、动作与状态变化、摄影机和同步声音。不得用 `CAMERA:`、`BODY/ACTION:`、`SOUND:` 等导演卡字段替代叙述。
- 优先使用具体、直接、可视化的描述。抽象情绪和文学比喻只能作为补充，必须同时展开为人物动作/重心/视线/面部、空间距离与遮挡、构图、摄影机、光线、材质、环境响应或声音中的可观察变化；不要要求 H3 自行“意会”。
- 除 `<d>` 内真实对白外，不得把内部创作意图、观众目标、剧情功能、交接占位或抽象镜末结论写进六段正文。“上一回合/上一镜结束”“动作引出后续对白”“对白冲突已被动作触发”“观众在 N 秒内知道/明白”“镜末形成/呈现悬念、压迫、转折”等必须先改写为可观察的故事世界事实；无法解析则停止编译。
- `detailed_description:` 后可以直接进入 `[Shot 1]`，也可以先写一至两句纯风格开场。开场只允许媒介、真实度、综合色彩、材质和整体影像气质；不得写第一帧、参考板、素材顺序、切镜数量、镜头路径/停稳、人物动作/呼吸/表演、声音或“按下列镜头展开”等执行指令。
- 逐镜正文不重复罗列“画面中的实际参考按序为……”或“分别保持已声明职责”。参考顺序与职责只在 `subject_definitions`、`summary`、`retention_analysis` 声明一次；Shot 中只在素材首次真正出现或发挥作用的位置自然引用对应 Subject。
- Shot 正文不得出现“故事板／导演板／身份板／场景板／道具板／标题栏／编号／格线／参考小图／平面图／表格”等制作层对象，也不得引用 `<Picture N>`；把板内可见内容翻译成最终故事世界中的 `<Subject N>`、动作、空间、摄影与声音。`<Audio N>` 只允许在对应 Speaker 真正发声的 Shot 中作为音色与表达参考自然出现，`<Video N>` 只在实际承担运动／调度职责时出现。
- 摄影遵循 [稳定摄影与运镜选择](../../ai-media-prompt-compiler/references/camera-direction-playbook.md#选择顺序)：普通镜头自然写出稳定支撑、平滑运动和停稳落点，手持或冲击例外只作用于已声明 Shot/时段。不能把样例中的晃动、演员呼吸或物件受力泛化到全部镜头，不增加独立负向提示词段。
- 完整导演板是 Shot 顺序、覆盖、调度、空间锚点和状态交接的规划参考，并作为普通 `<Picture 1>` 输入，但不接入 `picture_1_keyframe`。后续图片按实际出镜身份板、关键近景所需单状态表情参考、当前完整场景板、关键道具板和其他必要参考排列。完整宫格表情板禁止直接进入 H3；视频产物只呈现完整彩色故事世界。
- 官方格式不使用独立 negative-prompt 段。是否使用自然限制语句以官方表述和当前任务需要为准，不另加项目自定义词汇黑名单。
- 普通连续对白只在一个 Speaker 的一个 `<d>` 中完整出现一次。若同一句有意跨越剪辑，前后相邻 `<d>` 在连接点成对使用 `<scenetrans>`，正文明确声音无缝连续，且原文不重不漏；`<cutoff>` 只用于最终 Shot 结尾的刻意截断。普通无台词镜头不写闭口、不要说话、无台词等反向控制语；官方画外音句式同句写明对应画内角色的 lips remain completely closed。
- 同步对白开始时，当前 Speaker 默认已经在该 Shot 中清楚可见；在 `<d>` 前先建立其画内位置、可见关键动作和 Subject/Speaker 对应。若当前画面只覆盖听者、其他角色或空景，先切到/跟到说话者、重构焦点或让其入画，再开始 `<d>`，不得让画内人物代说画外角色台词。
- 画外对白只用于明确的旁白、电话/广播、门外声源、延迟揭示或 J-cut/L-cut；发声句固定使用 `[Speaker] (Sx) says in an off-screen voiceover: <d>[Language]精确台词</d> while the corresponding on-screen character's lips remain completely closed.`，再补声源方位/距离/设备和具体听者反应。没有叙事必要性时改为切到说话者。
- `<d>` 内只放角色真正朗读的精确原文和属于原文的正常标点。标签外只用一句大白话写当前情绪、必要的语速或音量变化和一个关键动作，不逐项罗列口型、呼吸、停顿、目光与身体动作。
- Shot 首句直接写人物在具名锚点或明确画面区域正在做什么，不写“开场状态是”。连续 Shot 默认继承同一人物的位置；只有可见移动、摄影机重构或有动机换轴才能改变其屏幕区域，禁止无过程地从左侧跳到模糊的“画面边缘”。
- 不在 Shot 内嵌套 `1.`、`2.` 等数字说明。除固定 `[Shot N]` 标签外，逐镜正文始终是连续英文。
- 中文字符“说”只允许出现在紧邻真实 `<d>` 前的发声句式，例如“`<Subject N> (S1) 说出 <d>…</d>`”。除 `<d>` 内的真实台词外，六段其他位置不得出现“说完后、说话时、继续说、没有说、听他说”等发声暗示；改用“声音落下后”、具体听者反应、可见动作或实际环境声。

## 引用职责

- `<Subject N>`：成片中需要持续跟踪的**可见**人物、场景、道具、表演或效果；在定义中说明实际来源和应保留的特征。音频不是 Subject；画外音、旁白、广播和无实体系统声不得为了绑定 Voice 而新增 `<Subject N>`。
- `<Picture N>`：实际图片输入，从首张身份、单状态表情、场景、道具或关系锚点参考开始编号。Ref2VA 不把导演板或普通参考定义为首帧；I2VA/FL2VA 的端点图像只按对应官方模式处理。
- `<Video N>`：真实视频输入，仅说明其剪辑、动作、调度、相机路径或延续职责。
- `<Audio N>`：真实音频输入；Voice 样本写为 `reference`，只提供目标 Speaker 的音色/交付参考，不复制原信号或原台词。
- 本页标签仅用于审核编译输出。源提示词保存结构化引用，只有预览/提交编译器将其转为本次真实媒体标签；它不重写 Prompt 正文、Shot 叙述或时间线。

## 最终六段骨架

```text
subject_definitions:
[不定义或上传完整导演板；其 Shot 顺序、覆盖、调度、空间锚点与状态交接已经编译进下方 summary、retention_analysis 和逐 Shot 正文。]
<Subject 1> 是来自 <Picture N> 的[人物／环境／道具]，需要在目标视频中稳定保持[实际必要特征]。
<Picture N> 是适用于[对应 Shot]的[具体关键帧或关系锚点]，只提供[狭义视觉职责]。
[单状态表情参考按需：<Picture N> 是 <Subject N> 在 [Shot X] 的干净单状态表情参考，只控制眼睑、眉间、嘴唇/下颌、呼吸、肩颈与重心反应，不改变身份、Look、动作阶段、视线目标或构图。]
<Video N> 是用于[狭义时间职责]的[已采用预演／源结构]。
<Audio N> 是 <Subject N> (S1) 的角色音色参考。[仅当 S1 是可见人物时使用此关系。]
<Audio M> 是画外 Speaker (S2) 的角色音色参考。[仅当本段确实采用 H3 原生画外音时使用；不创建虚构 Subject。]

summary:
[reference generation + audio reference] 目标视频在[环境]中跟随 <Subject 1> 完成[一段连续事件]；采用已批准导演板编译出的 Shot 规划，<Audio N> 为 <Subject N> (S1) 的目标对白提供音色与表达参考，其他真实参考仅承担各自声明的职责。

retention_analysis:
[不列出导演板 Picture；直接在每个 Shot 中完整保留已批准的镜头顺序、覆盖方式、人物调度、空间锚点与状态交接。]
<Subject 1>（出现在 [Shot ...]）：fully_preserved - 只保持必须延续的稳定身份或资产特征。
<Picture N>（[Shot ...] 锚点）：partially_preserved - 只保持已声明的狭义锚点职责。
[单状态表情参考按需：<Picture N>（<Subject N> / [Shot X] 表情）：partially_preserved - 只保持该 Shot 的微表情与身体反应语言，不保留背景、白底或参考板式。]
<Video N>（摄影机与调度结构）：weak_reference - 只参考已声明的运动或时间职责。
<Audio N>：reference - 只用其音色与表达方式指导 <Subject N> 的目标对白，不复制原始信号或样本台词。

detailed_description:
[可选的一至两句纯风格开场：只写媒介、真实度、综合色彩、材质和整体影像气质。不要写参考、剪辑、运镜、表演或声音指令。]
[Shot 1] [直接写人物位于哪个具名锚点或明确画面区域、正在做什么，以及摄影机如何看见；不要另写“开场状态是”，不要先列参考清单。]
[Shot 2] At 00:SS.mmm, [Write the inherited state, new coverage, action progression, camera behavior, sound, and exit state in complete English prose.]
...
[Shot N] At 00:SS.mmm, [Write the final coverage, action, response, sound, and exact handoff state in complete English prose.]

[有 Voice 音色参考的对白写法：<Subject N> (S1) 借用 <Audio N> 的音色，[简短情绪]地说出 <d>[Chinese]真正朗读的精确台词。</d> 声音落下后，[只写一个最关键的可见反应或动作]。没有 Audio 输入时省略 `<Audio N>`，但保留实际 Speaker。]

[Official off-screen form: [Speaker] (Sx), using the timbre of <Audio N>, says in an off-screen voiceover: <d>[Chinese]真正朗读的精确台词。</d> while the corresponding on-screen character's lips remain completely closed. State the source direction, distance or device and one visible listener reaction.]

overall_soundscape:
[Summarize the continuous ambience, synchronized physical sounds, and nonverbal vocals in one to four English sentences without repeating readable dialogue.]

non_diegetic_music:
N/A
```

## 编译检查

1. 每次引用、Beat、Shot、时长、对白或声音变化后，以当前有效语义和真实连接重新写完整六段；不向旧 Prompt 追加补丁。
2. `[Shot 1]` 无时间戳；后续 Shot 使用严格递增、位于实际时长内的 `[Shot N] At MM:SS.mmm,`。N 替换为当前镜头数，单镜只有 Shot 1，不复制骨架中的省略号或额外末镜。导演板或 Shot 表的 `0–3 秒、3–5 秒` 只用于审阅和累计计算，必须编译为 `[Shot 1] ... [Shot 2] At 00:03.000, ...`；禁止写 `[Shot 1] At 00:00.000-00:03.000`、`[Shot 2] At 00:03.000-00:05.000` 等开始–结束范围。镜头表、主镜头区和视频 Prompt 数量/时段一致，底部参考小图不计为 Shot。
3. `[Shot 1]` 前若有文字，只能是一至两句纯风格开场，不得包含参考清单或制作执行说明。每个 Shot 是完整自然叙述，不能使用“same as above”、省略号、空白占位或纯结论；完整导演字段属于工作台镜头规划，不是 H3 最终格式。
4. 每个标签、Subject、Speaker 与当前实际 Picture / Video / Audio 连接数量和顺序一致；未连接媒体不得出现在 Prompt。
5. Picture、Audio、Subject、Speaker 分别独立编号。Audio 只引用其真实目标 Speaker；它不会成为新 Subject，也不能改变可见 Subject 的编号。
6. 多 Speaker 可以存在，但每个 `<Audio N>`、`(Sx)` 和 `<d>` 必须形成唯一对应关系；沉默人物不传 Voice，画外 Speaker 不伪造视觉 Subject。
7. 每段画内同步对白开始时，实际 Speaker 已在 owner Shot 中清楚可见；若没有，已先切镜、跟摇、重构焦点或让其入画。画外对白必须使用 `says in an off-screen voiceover`，同句写明对应画内角色 `lips remain completely closed`，并写清空间或设备声源；画内听者不得关联到其 Voice 或 `<d>`。
7. 每个实际连接的 Audio 都在定义、summary、retention 和实际生效的 Shot/声音层出现；Voice 音色参考必须在实际发声 Shot 出现。`retention_analysis` 不写 `(Sx)`。
8. `overall_soundscape` 不重复 `<d>` 中的台词；`non_diegetic_music` 只写观众听到的配乐，或写 `N/A`。
9. 检查所有 `<d>` 的开头没有括号式语气、情绪、语速或动作说明；这些内容必须位于 `<d>` 外，且 `<d>` 的标准化文字与剧本/Shot 合同精确一致。
10. 检查 Shot 正文只有最终故事世界，不含板式名称、布局元素、制作说明或 `<Picture N>`；普通无对白 Shot 不含 Voice、Audio、Speaker、`<d>`，也不使用闭口／不要说话／无台词等反向控制语。官方画外音句式中的 `lips remain completely closed` 是唯一例外。
11. 删除所有不紧邻真实 `<d>` 的“说”字；角色台词正文中的“说”保留，唯一对白前可使用“`(Sx) 说出 <d>`”。
12. 检查 `<d>` 外没有内部意图、观众目标、剧情功能、交接占位或抽象镜末结论；不得用引号包装“上一回合结束”“动作引出后续对白”等文字冒充可见动作。
13. 删除“开场状态是”“自然中文口型、呼吸、停顿、目光和身体动作完成表演”“严格参照音频声音身份与演绎节奏”等套话，以及 `[Shot N]` 内部的数字条目；对白前只留简短情绪、必要声线引用和一个关键动作。
14. Ref2VA 保持 `picture_1_keyframe` 断开，最多使用其余八个普通图片槽；实际 Picture 顺序为出镜身份板、关键近景单状态表情参考、场景板、关键道具与其他必要参考。超限时保留身份板和场景板；表情参考仅在承担关键剧情信息时优先于次要道具或一般参考。
14. 逐 Shot 核对人物位置继承；位置变化必须能由可见移动、明确新机位或有动机换轴解释，不能把同一人物无过程地从左侧改写到画面边缘或另一侧。

完整实例见 [主人提供的官方 Audio / Subject / Speaker 实例](h3-ref2va-audio-mapping-example.md)。
