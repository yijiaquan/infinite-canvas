# H3 提示词编译与校验

本页是官方 `h3-prompt-writing` 与 Infinite Canvas 之间的提交检查层。官方 Skill 决定 Prompt 语法和模型能力；本页只补全量重编译、Canvas 绑定闭环与确定性检查，不创建项目报告、任务包、Gate、Manifest 文件或质量结论。

## 完整重编译

Prompt 的唯一输入是当前有效 Master H3 Clip Contract 和真实媒体连接。收到 ADD / REPLACE / REMOVE / MOVE / RETIME 后：

1. 重算所选模式、总时长、Shot 顺序和切点；
2. 重算 Picture / Video / Audio / Subject / Speaker 的编号、职责与适用 Shot；
3. 删除被替换、移除或移位后失效的动作、镜头、对白、声音、端点和参考关系；
4. 从头生成完整三段或六段 Prompt；
5. 输出可直接覆盖 UI 示例 Prompt 的完整文本，不输出局部补丁、`其余不变` 或历史修订说明。

## 具体、直接、可视化

H3 更适合明确的画面与声音指令，而不是依赖“意会”的抽象比喻。编译时保留原有戏剧意图，但把抽象表达转成至少一个可观察载体：人物姿态/重心/动作阶段、眼神与微表情、人物距离与遮挡、构图和景别、摄影机触发/路径/速度/落点、具名光源变化、材质或环境响应、同步声音事件。诸如“压迫感袭来”“空气凝固”“命运逼近”“意识到危险”不能单独承担 Shot 内容；必须说明观众具体看见或听见什么。风格词可以概括综合色彩与气质，但不得替代逐镜事实，也不得改写成无句法的关键词堆。

内部合同可以完整检查口型、呼吸、停顿、目光、重心和身体协同，最终 Prompt 不得把这组维度变成固定套话。逐镜用简洁大白话直接写人物在哪里、做什么、情绪怎样变化；对白前最多保留简短情绪、必要的 `<Audio N>` 音色引用和一个关键动作。不得写“开场状态是”“以自然中文口型、呼吸、停顿、目光和身体动作完成表演”“严格参照音频声音身份与演绎节奏”，也不得在 `[Shot N]` 内再列 `1.`、`2.` 等编号说明。

人物空间连续性以具名场景锚点和稳定屏幕区域为准。同一人物进入当前 Shot 时继承上一镜末态；只有画面中可见移动、明确的新机位重构或有动机换轴才能改变其屏幕位置。禁止先写人物在左侧，随后没有过程地改成模糊的“画面边缘”或另一侧。

最终 Prompt 除 `<d>` 内真实对白外，禁止出现内部创作意图、观众目标、剧情功能、交接占位或抽象镜末结论。遇到“上一回合/上一镜结束”“动作引出后续对白”“对白冲突已被动作触发”“观众在 N 秒内知道/明白”“镜末形成/呈现悬念、压迫、转折”等上游文字，必须解析为当前 Shot 可观察的人物、道具、空间、动作、摄影、光线、声音与精确末态；无法解析时停止编译，不能原样引用、加引号包装或交给 H3 自行理解。

## 模式与结构

- T2VA / I2VA / FL2VA / L2VA 使用官方 Base 三段；需要图像对齐的模式带官方对齐行。I2VA/L2VA 只有当前 Canvas UI JSON 暴露对应单端点输入时才可执行。
- Ref2VA 使用六段固定顺序：`subject_definitions`、`summary`、`retention_analysis`、`detailed_description`、`overall_soundscape`、`non_diegetic_music`。
- 按 current 镜头表实际 N 镜编译 `[Shot 1]` 至 `[Shot N]`；第一镜从零开始，后续连续编号，并以严格递增、位于实际 Clip 时长内的 `At MM:SS.mmm` 开头。数量与时长不绑定；单镜不添加虚构切点。官方 H3 输出时长为整数 4–15 秒；输入参考视频的 2–15 秒限制单独检查，不能冒充输出范围。
- 一个 Clip 不跨场。多 Shot 只覆盖同一连续事件，不把无关蒙太奇、复杂时间跳跃或互相冲突的参考塞进一次请求。

## 静默结构检查

提交前检查：

- 所选 UI workflow、Prompt schema 与实际媒体模式一致；
- 必需段落各出现一次、顺序正确、正文非空；
- 所有引用标签均已定义，编号与实际输入类型/顺序一致；
- Ref2VA 图片顺序为完整导演板、实际出镜身份板、关键近景所需单状态表情参考、当前完整场景板、关键道具板和其他必要参考；最多九张，超限时优先保留导演板、身份板和场景板，表情参考仅在承载关键剧情信息时优先于次要道具或一般参考；
- 完整 `expression` 人物表情板没有直接进入 H3；视频中的 `role: "expression"` 只连接父级为该表情板的干净单状态图片 `reference`，并在定义、retention 和实际适用 Shot 中保持同一窄职责；
- 每条 retention 关系属于正确媒体类型，并覆盖其声明的参考职责；
- 每个实际连接的 `<Audio N>` 都在 `subject_definitions`、`summary`、`retention_analysis` 和实际生效的 Shot/声音层闭环出现；若定义为 Voice 音色/表达参考，必须在对应实际发声 Shot 明确引用 `<Audio N>`。`retention_analysis` 不写 `(Sx)`，Speaker ID 只属于定义绑定与目标视频实际发声事件；
- 后续 Shot 编号与切点合法；
- `[Shot N]` 内部不再嵌套数字条目；人物位置从上一镜具名锚点和屏幕区域连续继承，变化必须有可见移动、明确新机位或有动机换轴；
- 每个 `<d>[Language] ...</d>` 紧邻真实 Speaker，Speaker 按目标视频中的首次发声顺序稳定编号；
- 画内同步对白的 Speaker 在其 `dialogue_owner_shot` 发声时间窗内清楚可见，且 `<Subject N> -> (Sx) -> <Audio N> -> <d>` 唯一对应。若台词开始时画面只覆盖听者、其他角色或空景，必须先切到/跟到 Speaker、重构焦点或让其有过程地入画；否则编译失败；
- 画外对白只接受明确旁白、电话/广播、门外声源、延迟揭示或 J-cut/L-cut，并严格使用 `[Speaker] (Sx) says in an off-screen voiceover: <d>[Language]...</d> while the corresponding on-screen character's lips remain completely closed.`，同时声明声源方位/距离/设备和画内听者反应；没有明确理由或缺少该官方句式时编译失败；
- `<d>` 只包含真正朗读的精确文本与原文标点；括号式情绪、语气、语速、音量、重音、停顿或动作说明写在标签外的 Shot 表演叙述中。`（逐渐激动）`、`（低声）`、`[愤怒地]` 等位于 `<d>` 内时校验失败；
- 对白前的 Shot 叙述只有简短情绪、必要的 Audio 音色引用和一个关键动作；出现“自然中文口型、呼吸、停顿、目光和身体动作完成表演”“严格参照声音身份与演绎节奏”等通用套话时校验失败；
- 普通连续发言只允许一个 `dialogue_owner_shot`、一个 Speaker 和一个 `<d>` 保存完整可朗读原文。若同一句确实跨越剪辑，允许一个相邻 owner span：前段 `<d>` 在连接处以 `<scenetrans>` 结束，后段 `<d>` 以 `<scenetrans>` 开始，并在正文明确声音无缝连续；两段原文不得重叠或遗漏。`<cutoff>` 只用于最终 Shot 结尾的刻意截断；
- 无台词 Clip 没有 Voice、Audio、Speaker 或 `<d>`；多说话者只连接实际发声者；
- Picture、Audio、Subject、Speaker 各自独立编号。可见人物的 Audio 可指向该 Subject；画外音、旁白、广播或无实体系统声只保留 Audio + Speaker，不创建视觉 Subject；
- 多说话者逐一核对 `Audio N -> Speaker Sx -> 精确 Line`，可见说话者再关联其 Subject。沉默角色、无对应 Line 的 Voice 或错误复用 Audio 时校验失败；多人真正同时说或唱使用官方复合 Speaker ID `(S1,S2)`；
- 多说话者轮流发言时逐段核对当前 owner Shot 的可见 Speaker；同一双人/多人镜不能清楚区分发言者时，必须在换 Speaker 前切镜或明确转移构图焦点，禁止让当前占据画面的非说话者承载下一人的台词；
- Ref2VA 的 `detailed_description` 保留官方 Shot 标签和时间戳语法，逐镜正文使用英文；对白、歌词和可见文字保留原语言。每个 Shot 具体写构图、人物/物体位置、环境与灯光、动作与状态变化、摄影机和同步声音。完整导演字段只属于上游工作台镜头规划，不得出现在最终 H3 Prompt；所有后续 Shot 同样不能写成省略号、`same as above`、`同上`或一句结果；
- 除 `<d>` 内真实对白外，六段均不含内部创作意图、观众目标、剧情功能、交接占位或抽象镜末结论；凡“上一回合/上一镜结束”“动作引出后续对白”“对白冲突已被动作触发”“观众在 N 秒内知道/明白”“镜末形成/呈现悬念、压迫、转折”等未解析文字均校验失败；
- `detailed_description:` 可直接以 `[Shot 1]` 开始，也可先写一至两句纯风格开场。开场只说明媒介、真实度、综合色彩、材质和整体影像气质；第一帧、参考/板式、切镜、镜头路径、停稳、动作、表演和声音必须写入前三段或对应 Shot。逐镜不得重复“实际参考按序为”之类的素材清单，引用职责在前三段声明一次，Shot 正文只写故事世界中的真实出现与作用；
- Shot 正文不得把制作层对象变成目标画面：禁止故事板／导演板／身份板／场景板／道具板、标题栏、编号、格线、参考小图、平面图、表格或 `<Picture N>`；所有图片只在前三段完成来源与职责绑定，逐镜改用已定义的 `<Subject N>` 描述最终故事世界。`<Audio N>` 仅在其真实 Speaker 发声的 Shot 引用，`<Video N>` 仅在其运动／调度职责实际生效时引用；
- 禁止用“镜头按导演板切换”“人物和道具按上一末态变化”“听者按导演板回应”等句子把语义创作责任推回参考图。最终 Prompt 可以声明导演板职责，但每个 Shot 仍必须把该 Panel 的实际构图、人物位置、动作过程、响应、声音和末态完整翻译成文字；
- 小说改编或已有正式导演板的项目，在最终编译前从“制作剧本 + 小说对白去向表 + current 导演板”生成一个临时逐 Shot 合同 JSON，并通过 `--shot-contract` 校验精确切点、必须落入该 Shot 的小说动作事实与精确对白。合同只用于确定性校验，不替代来源提示词，不作为工作台业务资产；
- 打斗、武器、法术、异能、怪物或范围技能 Clip 额外核对：整段存在连续攻防脊柱；每个 Shot 只有一轮可读战术变化；后续 Shot 明确继承前一 Shot 的位置、重心、武器/能力、受力余势或环境结果；切镜没有把人物、资产或优势关系无因复位；
- `overall_soundscape` 与 Shot 的 AMB/Foley/SFX 不复述任何可朗读对白词句，`non_diegetic_music` 与环境声职责分开；
- 普通无对白 Shot 不连接或引用 Voice，不出现 Audio、Speaker 或 `<d>`，也不写闭口、不要说话、无台词等反向控制语；只写具体可见动作、听者反应和环境／动作声。只有采用官方 `says in an off-screen voiceover` 的画外对白 Shot，才要求同句写明对应画内角色 `lips remain completely closed`；
- 字符“说”只允许作为紧邻真实 `<d>` 的明确发声动词；删除六段中其他“说完后、说话时、继续说、没有说、听他说”等暗示。对白结束写声音落下后的可见状态，听者 Shot 写反应，声音段写声源与声场；`<d>` 内真实台词自身不受影响；
- 最终 Prompt 不附带独立 negative-prompt 字段或项目自定义的禁词段；自然语言按 H3 官方格式服务当前可见、可听事实，`non_diegetic_music: N/A` 或 `none` 是合法状态；
- 提示词长度接近当前节点实测上限时，先删除重复、失效和非当前 Clip 信息，再考虑拆 Clip；数字上限以 freshly-read UI/schema 和本地代码为准，不把社区数字冒充官方硬限制。

结构检查只证明 Prompt 可提交，不证明视频合格。最终采用仍以真实视频的剧情、表演、连续性、声音和技术 QA 为准。

可用现有脚本做静默检查：

```powershell
python scripts/validate_h3_prompt.py <prompt.txt> --mode ref2va --duration 8 --pictures 3 --videos 0 --audios 1
python scripts/validate_h3_prompt.py <prompt.txt> --mode ref2va --duration 15 --pictures 7 --audios 2 --shot-contract <shot-contract.json>
python scripts/validate_h3_prompt.py <prompt.txt> --mode fl2va --duration 8 --pictures 2
```

`--pictures / --videos / --audios` 必须来自当前所选 UI workflow 的真实连接数量；只有已核验当前节点字符上限时才传 `--max-chars`。

逐 Shot 合同使用以下最小结构。`start` 必须与 current 导演板切点完全一致；`required_facts` 写不可被概述替代的可观察小说动作或状态；`dialogues` 按该 Shot 的 `<d>` 顺序写完整原文，无对白时为空数组：

```json
{
  "shots": [
    {
      "number": 1,
      "start": 0.0,
      "required_facts": ["秦衍背门坐在账桌前", "秦素在门外筛药"],
      "dialogues": []
    },
    {
      "number": 2,
      "start": 1.2,
      "required_facts": ["秦素边夹药边看向门内"],
      "dialogues": ["数完了？桌上这些钱，够不够把五日后的债填上？"]
    }
  ]
}
```
