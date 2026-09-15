---
name: ai-drama-audio-post-production
description: Create and manage recurring voices, provider-native dialogue, TTS or recording, ambience, Foley, SFX, music, lip sync, subtitles, Bcut audio tracks, mix, and audio QA for AI drama. Use after the script is accepted and whenever sound or post-production work is required.
---

# AI Drama Audio and Post Production

## Canvas Production Boundary

进入漫剧生产前读取 [Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md)，先调用 `get_canvas_summary` 并核对真实项目/分集/Clip ID 与 revision。创作源文件可以保留；生产交接写入并读回 Canvas 对象，不维护第二份资产或状态台账。

源提示词只保存语义正文和结构化引用/绑定，不手写提供方媒体编号。下文及专业参考中的 `<Picture N>` / `<Video N>` / `<Audio N>` 是编译后格式的审核示例，仅由预览/提交编译器输出；UI 使用缩略图及图片N/视频N/音频N令牌。旧模板的文件路径/current 标记不构成 Canvas 采用记录，采用必须对应真实持久媒体版本与 QA。


本 Skill 负责让角色声音稳定、对白自然、声音有环境感，并把所有媒体组织成可编辑成片。它不是授权或状态管理系统。

## Inputs

读取当前剧本、制作拆解、当前 H3 Shot 与视频结果以及角色和场景信息。若拆解中有 Scene Sound Arc，先继承本场的入场声场、压力/留白和离场声桥；再让每个 Shot 只写 `AMB=延续/进入/退出 + 可听空间锚点`、实际 Speaker/Line、动作同步 Foley/SFX 与音乐相对 Cue。相邻同场 Shot 默认继承同一底声和相对距离，只有门、距离、机器、天气或场景真的变化才改变；不另建声音设计文档。

## Voice Management

对有可见对白的重复角色，在首个关键场次的完整分镜导演板通过视觉 QA 后、视频提示词定稿前，优先在 LibTV 创建角色音色并下载干净代表样本。当前 Skill 只绑定主人提供的本地 LibTV 文件，不假定或调用 LibTV API；未来接入经过验证的节点或 API 后再补执行方式。

主人只需在这一处确认每个角色采用哪条 LibTV 样本。确认后登记为 current Voice 并继续视频制作；未确认的角色只暂停其需要该 Voice 的对白 Shot，非对白工作无需等待。

1. 为每个重复角色建立稳定 Voice ID。
2. 默认使用 LibTV 创建并下载一条干净代表样本：单人、无音乐、无竞争声音、清楚文本。
3. 检查语言、音色、年龄感、情绪范围、清晰度、噪声、失真和使用权。
4. 后续生成优先复用同一代表样本作为人物音色参考。
5. 真正改变角色声音时建立新版本；普通新台词不重新选音色。
6. 对采用样本只声明它控制的声音身份基线：音色、口音、听感年龄或基础节奏；样本里的具体情绪、房间/话筒感、背景声和原台词不进入角色身份。本场表演情绪由剧本和 Line 指令决定。
7. 同一集会说话且容易混淆的常驻角色，按需写一条可听的区分点；无法明确区分时先换样本，不用堆叠形容词掩盖撞声。

`Qwen3-TTS_本地角色语音_v01` 不再是角色音色默认来源；只在主人明确要求独立 TTS、临时补录或技术测试时使用。LibTV 样本未就绪时，不自动用 Qwen3 替代或重新选声。

代表样本实际试听通过后，通过画布正常注册能力写入 Voice 资产的持久媒体版本并明确采用；普通对白、环境、音效和音乐同样登记真实输出，导出供剪辑使用。新版本沿用资产对象但产生新 versionId；不因新台词重选音色，不建立音频锁、文件状态索引或回执。历史 WAV/MP3 与技术日志只读保留。

## Dialogue Routes

生产先按 [Infinite Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md) 调用 `get_canvas_summary` 并读取当前 Clip/Shot、Voice 采用版本和输入绑定。Voice 通过 assetId/versionId 绑定且显式填写实际 speaker；一个音频引用只对应本 Clip 的实际 Speaker，无台词或沉默角色不进入 Audio 槽位，不扫描或回写旧工作台。

每个有声音角色的 Shot 先按精确 Line 选出实际 Speaker，再只为这些 Speaker 选择一个路线。画面中的角色不会仅因出镜而获得 Voice 输入；`无台词` Shot 不传角色 Voice 样本，仍可保留环境、Foley、SFX 和按需音乐。

### Native Dialogue — Default

当 MiniMax H3 或当前视频模型支持人物音色参考和原生对白时，优先：

- 输入当前人物视觉参考；
- 输入同角色 Voice 样本；
- 写入精确台词、语言、发音和表演意图；
- 由视频模型同时生成画面与原生声音。

每条附加的 Voice 样本都必须对应本 Shot 的一个实际 Speaker 与精确 Line。画外对白和旁白只绑定实际说话者；沉默角色、未出声的同场角色和项目其他已确认 Voice 均不得作为“备用上下文”传入。

生成后检查精确台词、发音、角色音色连续性、情绪、嘴型、A/V 同步、环境声和动作声。存在音频轨不等于通过。

### Post Lip Sync

仅在原生对白不可用或画面好但对白需要替换时使用。绑定最终台词音频和当前视频，完成口型后重新检查身份、嘴型、时长和同步。

### Off-Screen / Voiceover

画外音或旁白不要求口型，但仍要保持 Voice、语气、文本、时长和场景声音一致。

## Source Audio Policy

默认保留合格的原生混音。绝不把有用视频音轨全部静音后只贴一条对白。

若替换对白：

- 保留可用环境底；
- 或重建 AMB、Foley、SFX；
- 保证声场和画面动作对应；
- 音乐是否存在单独决定。

真正的故意静默必须有剧情理由和进入/退出声场。BGM=none 不等于没有环境音。

## Sound Design

为每场设计：

- DLG / VO / ADR；
- AMB 环境与 room tone；
- Foley；
- SFX；
- MUS 或 none；
- 入场声音状态、主要听觉焦点、离场状态和下一镜衔接。

把场次声音弧线落实到 Shot 时，先写“延续什么、何时由哪项可见变化触发改变、交给下一 Shot 什么”。每一个 Foley/SFX 都必须有可见或明确画外事件；不能用泛化音效掩盖镜头没有完成的动作。镜头中无台词时仍保留有意义的 AMB/动作声或有理由的静默，而不是默认静音。

ACE-Step 可用于明确需要的原创 BGM，不因为模型已安装就默认生成音乐。生成曲必须试听旋律、意外人声、对白遮蔽、失真、循环、淡化和版权边界。

除明确要求画内音乐或单段交付，非画内 BGM 在必剪保持独立轨：按进入、延续、让对白、退出跨镜铺设。不要让每个 H3/视频 Shot 各自烧入一段重新开始的配乐；`MUS=none` 不影响环境、Foley 和 SFX。

实际使用 ACE-Step 时读取 `references/ace-step-1-5-local-bgm.md`；它只提供节点、提示和试听方法，不创建另一套项目流程。

## Audio Handoff to Bcut (必剪)

- 字幕只来自当前确认台词。
- 检查断句、阅读速度、时间、语言、样式和安全区。
- 必剪中保留视频、对白/旁白、环境、Foley、SFX、音乐和字幕为独立可编辑轨。
- 先完成叙事和画面节奏，再做字幕、音乐和包装。
- 真实编辑转场可用 J-cut（下一 Shot 的声源先进入）或 L-cut（上一 Shot 的台词尾音、环境或动作声后延），但只在说话者、空间距离、环境状态与剧情时间都连续时使用；不得重写、重复或错配精确台词。
- 可选超分在字幕/标题/UI 前完成，并重新检查画音同步。

## Audio QA

在正常速度下听完整段落，重点检查：

- 文本与发音；
- Voice 连续性和表演；
- 同场常驻角色的可辨识度（仅在存在易混角色时）；
- 对白可懂度；
- 嘴型与 A/V 同步；
- 环境、动作声与画面；
- 音乐是否遮蔽对白；
- 点击、削波、噪声、失真、突兀静音；
- 镜头之间的声音连续性。

只在发现问题时做更细的帧级或波形检查。

只有实际试听且文件可播放的结果才能采用为 current；生成完成、WAV 存在或节点状态成功不等于通过。

## Audio QA and Final-Cut Handoff

1. 在必剪完成对白/旁白、环境、Foley、SFX、音乐和字幕的可编辑音频轨。
2. 正常速度听完整段落，完成本 Skill 的声音 QA。
3. 把可编辑工程、采用音频、混音意图和未解决声音问题交给 Short Skill；Short 负责全片叙事审核、最终导出与交付。
4. 发布始终需要明确授权。

## ComfyUI

可见说话的原生对白或口型使用画布管理员配置的 H3 渠道；通过数据库输入绑定仅为实际 Speaker 引用对应 Voice 版本。预览真实 Audio 槽位后完成对白与声音 Prompt；普通项目不靠正文名称建立引用，不手工拼接底层媒体请求。

LibTV 下载的 current Voice 样本是角色音色默认来源；`Qwen3-TTS_本地角色语音_v01` 仅用于明确要求的独立 TTS、临时补录或技术测试；`本地背景音乐_ACE-Step1.5_3070Ti-8GB_v01` 用于可选原创 BGM。可见说话的原生对白或口型使用所选 H3 视频工作流本身；不依赖抽象编号式流程。环境、Foley 和 SFX 优先保留合格视频原声或使用已授权素材/必剪可编辑轨，不虚构不存在的 ComfyUI 声音节点。正常制作直接生成并做内容 QA；只有真实失败或结果不明时才查看详细日志。

## Handoff

向 Video Skill 提供**本 Shot 实际 Speaker**的 current Voice 样本、样本控制项与不控制项、精确 Line、语言/发音、表演方向、声音进入/退出状态和所选 dialogue route；`无台词` 明确交付空 Voice 列表。向必剪提供 `媒体/音频` 中选用的声音、当前视频及其原生音轨或替换方案、独立 stems、字幕和混音意图。

重复角色可按需复制 `assets/templates/01-voice-bible.md`，无需为每条台词另建包。
