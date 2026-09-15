---
name: ai-story-architecture
description: Design or repair the dramatic architecture of an original story before prose or screenplay drafting. Use when a premise needs stronger empathy, conflict, contrast, causal escalation, value turns, crisis, climax, or an optional absurd black-comedy mechanism; do not use for Shot design, media prompts, or an already accepted script unless a real story rewrite is requested.
---

# AI Story Architecture

## Canvas Production Boundary

进入漫剧生产前读取 [Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md)，先调用 `get_canvas_summary` 并核对真实项目/分集/Clip ID 与 revision。创作源文件可以保留；生产交接写入并读回 Canvas 对象，不维护第二份资产或状态台账。

源提示词只保存语义正文和结构化引用/绑定，不手写提供方媒体编号。下文及专业参考中的 `<Picture N>` / `<Video N>` / `<Audio N>` 是编译后格式的审核示例，仅由预览/提交编译器输出；UI 使用缩略图及图片N/视频N/音频N令牌。旧模板的文件路径/current 标记不构成 Canvas 采用记录，采用必须对应真实持久媒体版本与 QA。


本 Skill 只解决“故事为什么值得看、事件为什么必然向前、结尾为什么成立”。它位于创意命题与 `ai-drama-story-writing` 之间，不写导演板、Shot、图片或视频提示词。

## Inputs

读取题材、目标观众、载体与时长、主角、必须保留的设定/事件/结局，以及当前已有的梗概或剧本。信息足够时直接工作；只有主角目标、核心题材或结局方向真正缺失且会改变整个故事时才询问主人。

## Workflow

1. 写清故事承诺
   - 观众跟随谁，期待获得什么情绪或认知回报；
   - 开始状态和结尾状态必须在关系、权力、认知、风险、情感或现实处境上产生可观察变化；
   - 用一句 `价值变化 + 导致它的角色选择` 表达故事命题，不先写抽象主题口号。

2. 建立共情
   - 给主角一个可理解的欲望、具体损失风险和仍在保护的人/事/尊严；
   - 同时展示能力与脆弱点，让观众既相信主角能行动，也担心其惯常策略会伤害自己；
   - 共情来自处境、行为、代价和选择，不靠旁白要求观众同情。

3. 建立冲突发动机
   - 让欲望遭遇会主动反制的对手、制度、关系、环境或内在盲区；
   - 每次行动都产生结果，结果缩小选择、提高代价或暴露新事实；
   - 关键转折优先来自“角色预期与现实结果之间的落差”，不能只靠随后发生的新事件。

4. 设计反差
   - 选择一项主反差：身份与处境、愿望与手段、公开形象与私下需要、严肃目标与荒诞环境、计划与结果；
   - 反差必须持续改变冲突或人物关系，不能只是一次性噱头；
   - 每个主要角色至少拥有一处不违背人物逻辑的内部矛盾，避免单标签人物。

5. 组织价值转折
   - 开端用诱发事件打破平衡；中段以递进复杂化迫使主角改变策略；
   - 每个主要 Beat 和完整场景改变至少一个价值域，并用 `之前 -> 之后` 表达；场景不能只有对白交换而没有权力、认知、关系、风险、情感或现实处境变化；
   - 危机提供真正两难选择，高潮让主角采取不可撤销行动，结局展示行动造成的新现实。

6. 对照故事曲线与情绪曲线
   - 故事曲线只列可见事件与行动结果；情绪曲线只列观众主导感受及其强弱、突变和冷却；
   - 两条曲线必须互相影响但不能写成同一列表：事件应触发情绪变化，情绪积累应改变下一次选择的意义；
   - 短片需要检查功能节拍时读取 [功能节拍、场景价值与双曲线](references/beat-sheet-and-curves.md)。功能节拍是诊断工具，不要求固定数量、固定分钟点或逐格对应。

7. 按需加入荒诞黑色喜剧
   - 仅在题材和主人方向适合时读取 [荒诞命运与认知迷宫](references/absurd-black-comedy.md)；
   - 抽象使用严肃人物面对荒诞系统、微小选择引发命运连锁、信息错位和悲喜同源等机制；
   - 不复制任何具体作者的角色、情节、台词、场景或标志性表达。

8. 形成架构卡并自检
   - 使用 [故事架构卡](assets/story-architecture-card.md)；
   - 检查共情是否可见、冲突是否主动、反差是否参与因果、每个场景是否发生价值转变、故事/情绪曲线是否相互推动、危机是否两难、高潮是否由主角选择完成；
   - 发现问题直接修订架构，不生成评分、审计报告或确认流程。

## Handoff

把采用的故事架构卡交给 `ai-drama-story-writing`。Story Skill 负责因果 Beat、可读正文和制作剧本；Series Skill 负责系列连续性与生产拆解。下游只有发现真实的动机、因果、价值转折或结局问题时，才回到本 Skill。

## Reference

普通故事只需读取 [共情、冲突、反差与价值转折](references/story-design-principles.md)。短片结构不清、场景像对白段落、事件和情绪脱节时读取功能节拍参考页。只有明确需要荒诞、犯罪、黑色幽默或认知错位时，再读取荒诞黑色喜剧参考页。
