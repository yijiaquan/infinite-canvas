---
name: ai-drama-story-writing
description: Develop an original AI-drama episode from premise through causal outline, readable prose, production screenplay, and story-room audit. Use for original story creation or material narrative revision; do not use for novel drafting or to duplicate a screenplay from the novel-adaptation Skill.
---

# AI Drama Story Writing

## Canvas Production Boundary

进入漫剧生产前读取 [Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md)，先调用 `get_canvas_summary` 并核对真实项目/分集/Clip ID 与 revision。创作源文件可以保留；生产交接写入并读回 Canvas 对象，不维护第二份资产或状态台账。

源提示词只保存语义正文和结构化引用/绑定，不手写提供方媒体编号。下文及专业参考中的 `<Picture N>` / `<Video N>` / `<Audio N>` 是编译后格式的审核示例，仅由预览/提交编译器输出；UI 使用缩略图及图片N/视频N/音频N令牌。旧模板的文件路径/current 标记不构成 Canvas 采用记录，采用必须对应真实持久媒体版本与 QA。


目标是先把故事写得有因果、有选择、有变化，再变成可制作剧本。不要用旁白、镜头术语或提示词掩盖故事问题。

## Inputs

读取 Series Bible、本集承诺、目标时长、类型、必须保留的事实与人物连续性。若当前原创项目已有 `ai-story-architecture` 采用的故事架构卡，以其中的共情抓手、冲突发动机、核心反差、价值转折、危机、高潮和结局变化为当前结构输入，不另写一套平行架构。若已有外部剧本，把它作为当前输入直接审阅，不要求主人再做一轮形式化复审。

完整小说需要写成漫剧时，交给 `novel-to-ai-drama-adaptation`：它负责全书取舍、分季蓝图和首季制作剧本。本 Skill 只在主人要求对那份剧本进行实质叙事重写时介入，不能因为同一小说存在就重复开发一份剧本。

主人提供小说、长剧本、外部案例、提示词或样片作为创作输入时，先读取 `references/source-material-triage.md`。只抽取可迁移机制与可见故事载体；来源/权利判断仍归 Series Skill。

## Workflow

0. Story Architecture
   - 新点子只有题材或人物、尚无可靠的共情/冲突/反差/危机/高潮结构时，先调用 `ai-story-architecture`；
   - 已有采用架构卡、完整因果大纲或已确认剧本时直接继续，不把它变成新的确认阶段；
   - 本 Skill 可以在写作中修正局部 Beat，但真实的核心动机、价值转折或结局问题应回到 Story Architecture Skill 处理。

1. Episode Contract
   - 主角想得到什么？
   - 谁或什么阻止他？
   - 失败会失去什么？
   - 本集不可逆变化是什么？
   - 结尾回答什么，又留下什么问题？

2. Causal Beat Outline
   每个 Beat 写进入状态、目标与阻力、可见行动或发现、因此/但是导致的下一 Beat、输出状态。拒绝只用“然后、接着、随后”连接事件。

3. Readable Prose
   - 按 Beat 写完整故事正文。
   - 保留人物体验、空间关系、信息揭示顺序和情绪转变。
   - 不把摄影机、模型标签或技术说明混进正文。

4. Story-Room Audit
   检查因果、动机与代价、设置与回收、信息顺序、连续性、升级与释放、画面/声音可表现性，以及本集和系列承诺。修复后再进入剧本，不用数值评分自动判断质量。

5. Production Screenplay
   每场写清 Scene/Beat、地点时间、进入状态、可见动作、空间关系、对白/旁白/声音、退出状态、剧情功能和预计时长。进入视频的每句台词还要标明画内对白、画外对白或旁白、口语语言和所在时间窗口。

6. Dialogue-Action Units
   每段重要对白补齐说话前任务、说话时行动、对方或环境响应、台词后状态变化。按当前角色 Voice 的自然表演节奏检查精确台词、动作和停顿能否落入时间窗口；装不下时优先按真实剪辑点拆 Shot，不得悄悄删改已确认台词。站着或坐着看着对方念台词不是完整表演；沉默也需要身体任务、环境反应和释放条件。

7. Review Candidate
   输出当前大纲、正文、制作剧本和审校结论。主人读完并同意后，Series Skill 只记录一次剧本确认，然后进入制作拆解。

## Handoff

交给 Series Skill 的制作拆解必须明确人物/Look、地点、道具、Scene/Beat/Shot、对白与声音、连续性变化、开头钩子和结尾状态。下游没有发现真实叙事缺陷时，不重开写作。

## References

- 大纲、因果和分集结构：`references/story-architecture.md`；
- 正文转制作剧本：`references/prose-to-screenplay.md`；
- 故事室审校：`references/story-room-audit.md`。
- 小说、长剧本或外部创作参考：`references/source-material-triage.md`。

只读取当前任务需要的一份，不为普通下游制作重新加载。
