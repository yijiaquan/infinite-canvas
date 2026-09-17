---
name: short-video-production
description: Business-first workflow for ordinary short videos and for AI-drama delivery, Bcut editing, full-cut review, export, and learning. In serialized AI drama use it only for the overall delivery route or editing/finalization stage; ai-drama-studio-workflow remains the production router. This Skill prioritizes finished content without exposing internal checks as owner stages.
---

# Short Video Production

## Canvas Production Boundary

进入漫剧生产前读取 [Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md)，先调用 `get_canvas_summary` 并核对真实项目/分集/Clip ID 与 revision。创作源文件可以保留；生产交接写入并读回 Canvas 对象，不维护第二份资产或状态台账。

源提示词只保存语义正文和结构化引用/绑定，不手写提供方媒体编号。下文及专业参考中的 `<Picture N>` / `<Video N>` / `<Audio N>` 是编译后格式的审核示例，仅由预览/提交编译器输出；UI 使用缩略图及图片N/视频N/音频N令牌。旧模板的文件路径/current 标记不构成 Canvas 采用记录，采用必须对应真实持久媒体版本与 QA。


目标是完成一条可观看、可编辑、可交付的短视频。正常路线连续推进，不把内部检查、模型调用或文件记录变成主人操作流程。

## Start

先确认任务属于普通短视频、AI 漫剧/连续剧情，还是只测试节点/模型的 technical lab。

获取最少必要输入：主题或脚本、目标受众、平台/比例、目标时长、必须保留的素材、交付目标。能从上下文可靠推断的内容采用合理默认值；只有会改变作品方向的缺失项才询问主人。

进入画布生产时，按 [Infinite Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md) 先调用 `get_canvas_summary`，读取/建立项目与分集，再创建资产对象和候选版本。按 [真实媒体验收与最小返修](../ai-media-prompt-compiler/references/media-acceptance-and-repair.md) 真正通过 QA 才明确采用。技术节点/模型测试属于 Lab，不自动创建正式采用项。

## Business Workflow

全过程遵循唯一依赖顺序：`故事成立 → 制作剧本成立 → 人物/场景/道具资产成立 → 完整导演板成立 → 视频 Clip 成立 → 必剪成片`。“成立”只表示真实内容满足下一阶段输入要求，不新增 Lock、Gate、报告或主人逐阶段确认。返修退回最早出错的来源；已成立且未受影响的内容不重复制作。

1. 明确作品承诺
   - 一句话写清观众会看到、感受到或得到什么。
   - 确定开头 5 秒的吸引机制：异常、问题、冲突、承诺、视觉反差或立即发生的动作。
   - 普通短视频在内容简报内写一小段导演脊柱、可观察视觉语言和 Project Look：肤色、阴影/高光、黑位、对比/饱和度、强调色职责、有动机光源与允许破格；不新建设定文档。需要图片色彩基准时采用一张 `reference_frame` 类型的 Global Project Palette：从文字 Project Look 与可用的 2–4 张代表性 current Scene Master 提炼，并以三条横向纯色色带分别表达全局基础/黑位与中性锚点、重复环境/光线色族、角色/道具/叙事强调色。只有特殊主场景存在跨多个 Shot/Clip 复用的独立色彩家族时，才派生一张保留全局核心锚点的 Scene Palette；场景资产和整板只用当前最具体的一张色板，不同时传父子色板。色板提示词只写正向布局、颜色顺序和职责。完整 LookDev 展示板只在主人明确要求时制作，不作为默认生产色板。
   - 事实型内容区分事实、报道、解释和未证实信息。

2. 完成脚本
   - 原创 AI 漫剧先由 Story Architecture 确认共情、冲突、反差、因果升级、危机、高潮和结尾变化成立，再由 Story Skill 写制作剧本。
   - 每段都有叙事功能、画面、动作、声音和预计时长。
   - 删除只靠旁白解释、画面没有变化的段落。
   - 对话不允许“站着念台词”：给人物任务、阻力、肢体行动、对方反应和改变后的结尾状态。
   - AI 漫剧的故事与制作剧本交给 Series/Story Skills。

3. 完成生产资产与导演板
   - 剧本成立后，先生成并看图采用实际需要的人物身份板、场景主图/View、关键道具和 Project/Scene Look。剧本仍不稳定时不提前制作正式资产。
   - 必要资产成为 `current` 后，再记录每个 Shot 的叙事目的、可见事件、主体动作、镜头、声音、开头状态、结尾状态和剪辑理由。
   - 悬疑或揭示 Shot 有多个独立事实时，按 `事实 → 现在给出 / 暂时隐藏 → 画面或声音载体 → 揭示触发` 写入现有 Shot 说明；普通 Shot 不增加这层记录。
   - 只获取确实服务脚本的素材。
   - 主人选择白模预演时，在 Clip 与分镜覆盖方案完成后、完整导演板生成前调用 `blender-whitebox-previs`。它复用本机人物模型、骨骼动作、场景与道具代理，在同一 Blender 场景中完成共享调度，并为同一 Clip 渲染一条包含全部覆盖与切点的连续预演；不替代正式导演板或最终 AI 视频。通过 QA 的同 Clip 预演可作为 H3 `<Video 1>` 参考资产，补充运镜、调度和动作节拍；完整分镜导演板仍是主 `<Picture 1>`。
   - AI 漫剧的身份板、场景、道具和完整分镜导演板交给 Visual Skill。
   - 完整导演板必须使用 current 资产生成，并通过逐格身份、空间、道具、动作、镜头、信息和交接 QA；存在已知缺陷时不提交视频节点。
   - 有重复角色的可见对白时，在首个关键场次分镜导演板或 Clip 方案完成后优先使用 LibTV 下载的代表样本；主人确认样本后再绑定视频。Qwen3-TTS 不作为默认音色来源。

4. 制作媒体
   - 当前 Clip 完整导演板成立后才进入所选视频节点。数据库显式输入绑定与实际预览确定媒体顺序，不从正文提及解析，也不替代内容判断。
   - 静态图、完整导演板与视频 Clip 在无限画布 MCP/正常工作台中编辑、预览、入队与审核；图片可直接用管理员配置的图片 API，H3 通过配置的 ComfyUI 适配器执行。普通生产不发送 /prompt 或维护另一套节点图。
- 引用使用真实 assetId/versionId/storageId、role/order/speaker；由预览/提交编译器从结构化绑定生成提供方标签。改草稿不影响已提交快照，改绑定后重新预览，不复用旧编号。
   - 提示词先由 Prompt Skill 整理语义，再由对应模型 Skill 编译准确格式。
   - 使用项目本地 FFmpeg/ffprobe 做按需的真实媒体检查：`ffprobe` 读取时长、画幅、FPS、编码和音轨；需要看具体帧时，从源视频直接抽取确定时间点的帧，不截取播放器或桌面画面。具体调用与边界见 [FFmpeg 媒体助手](references/ffmpeg-media-helper.md)。
   - AI 漫剧开始批量 Shot 前，先制作本集最能暴露路线风险的 1–3 条已规划 Shot：通常包括身份/场景锚定、最复杂的对白或调度、以及关键交接或揭示。按真实媒体 QA 修正它们的来源后，再继续同类 Shot；这不是额外测试项目、报告或主人确认环节，也不重做已经简单可靠的 Shot。
   - 正常配置的路线直接执行；内部 lint、排队和普通 QA 不打断主人。
   - 真实失败只诊断受影响请求，不把整个项目改造成技术排障工程。

5.必剪剪辑
   - 只有通过真实视频 QA 的 current Clips 才进入正式成片时间线；已知不合格 Clip 先定向返修，不能靠剪辑遮掩故事、表演或连续性失败。
   - 先完成叙事结构和节奏，再做字幕、音乐、特效和包装。
   - 保持视频、对白/旁白、环境音、Foley、SFX、音乐、字幕为可编辑轨道。
   - 已经确定、不再需要创意调整的单纯技术裁切、同编码片段拼接、封装或转码可由 FFmpeg 完成；镜头选择、节奏、J/L 声桥、多轨混音和反复调整仍留在必剪，不用命令行替代时间线。
   - AI 漫剧按 [先导样片与必剪剪辑](references/pilot-and-editing.md) 连接通过 QA 的 H3 Shot：反应补镜必须是有明确 Beat 的完整新 Shot；J/L 声桥只服务清楚的声源、空间和叙事交接；不得用静态图、板面、无依据慢放或随机 B-roll 填节奏。
   - 普通候选修复和替换在内部完成。

6. 整片审核
   - 正常速度、目标画幅观看完整视频。
   - 检查开头、叙事、动作活力、连续性、声音、字幕、安全区、事实/权利和文件属性；同时检查肤色、阴影/高光、黑位、综合色温、强调色职责和有动机光源是否按 Project / Scene Look 连贯。
   - 把问题退回真正来源：故事、镜头、资产、提示词、生成、声音或剪辑。

7. 交付与复盘
   - 主人确认成片后按目标规格导出；发布必须明确授权。
   - 记录有效的 Hook、节奏、镜头、提示词和失败模式。

## Owner Interaction

只在真实创意分歧、来源/权利问题、明显不同的提供方/表现形式、硬预算突破、不可修复质量问题、最终成片、导出或发布时询问主人。若当前 Codex Goal 已明确要求完成并交付指定项目，则它覆盖普通中间选择、最终内部评审和已声明导出；无需中途询问，发布仍除外。

不要让主人确认技术文件、预检、队列、哈希、裁切、普通 QA 或内部修复。

## Records

画布数据库是制作剧本、Clip/Shot、节点草稿、资产版本、输入绑定、运行快照与采用的唯一生产记录。旧工作台目录只供历史只读查证或明确的一次性导入。

项目区保留来源文档、版权凭据、必剪/Blender 可编辑工程与导出交付；媒体来自数据库明确的采用记录与既有持久存储。跨会话读取数据库及当前工具状态恢复，不创建平行 Shot 表、进度文件或资产索引。历史技术证据不移动或删除。

旧项目仅在明确迁移时只读核对真实采用媒体，再通过 Canvas 正常导入能力建立副本；不回写旧项目，不把扫描猜测当成采用，不把导入记录伪装成新生成。

需要创作骨架时使用 `assets/templates/01-content-brief.md`、`02-topic-and-hypothesis.md`、`03-research-script.md` 或 `05-review-publish-learn.md`；生产 Shot/资产关系写入 Canvas，不复制历史素材台账模板。节点/模型实验才使用 `assets/templates/10-comfyui-technical-lab-test.md`。

## References

按实际任务读取，不要为了开始制作一次性加载全部资料：

- 事实、授权和 AI 标注：`references/rights-and-evidence.md`；
- 开头 5 秒：`references/opening-hook-and-five-second-retention.md`；
- HyperFrames：`references/tooling-assets-hyperframes.md`；
- 本地超分：`references/local-video-upscale.md`。
- AI 漫剧先导样片、反应补镜与必剪声画交接：`references/pilot-and-editing.md`；
- 真实图片/视频验收与最小返修：`../ai-media-prompt-compiler/references/media-acceptance-and-repair.md`。
- 项目/场景 Look、电影色卡、Color State 与 Lighting State：`../ai-media-prompt-compiler/references/look-color-continuity.md`。

AI 漫剧继续交给后续专业 Skills。
