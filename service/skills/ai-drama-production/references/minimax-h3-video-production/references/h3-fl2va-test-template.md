# H3 FL2VA 端点测试模板

仅当任务明确需要一个开场帧、一个落点帧以及两者之间的连续物理过程时使用。它是按需测试/条件路线，不是 Ref2VA 的失败回退，也不使用上一条生成视频的原始尾帧自动串接。

## 适用条件

- 两张端点图都由当前项目资产制作并通过真实图片 QA；
- 人物身份、Look、Location + View、道具数量/归属、工作侧和主光在两端可物理连续；
- 中间过程只有一个主要动作因果，不跨场、不跳时、不依赖模型发明复杂交接；
- 端点之间的动作、摄影和声音能装入所选时长；
- 当前 `MiniMax-H3_02_首尾帧生视频_3070Ti-8GB.json` 已 freshly re-read，并按其公开输入绑定两端。

## 三段骨架

```text
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 1) aligns with the [实际时长].00-second mark of the target video.

integrated_multimodal_description: [Shot 1] 真人电影场景从 <Picture 1> 确立的构图、主体位置和动作阶段开始。[触发事件]发生后，[主体]完成[身体准备]，沿[可见路径]实施[一个连续且明确的动作]，并引发[环境／对手／道具]的[可见回应]。摄影机以[一个有动机的镜头行为]从[开场关系]移动到[落点关系]。动作最终准确落到 <Picture 2> 确立的人物位置、姿态、道具、构图、工作侧、空间锚点与色彩／灯光状态。[如适用：<Subject N> (S1) 在自然表演时窗内说出 <d>[Chinese] 精确对白。</d>]

overall_soundscape: [用中文描述连续环境底声与空间声学锚点]。[用中文描述与动作同步的 Foley 和 SFX]。[用中文描述对白尾音或声桥，不重复可朗读台词。]

non_diegetic_music: N/A
```

## 编译与 QA

- 两张端点只约束开场与落点；Prompt 必须写出触发、身体准备、运动轨迹、接触/惯性、响应和收束，不能只重复两个结果。
- 最终 Prompt 保留官方三段标签与固定对齐行，三段描述正文使用英文；对白、歌词和画面可见文字保留原语言。不附带独立 negative-prompt 字段、后缀或项目自定义禁词段。
- 修改任一端点、动作、时长、Speaker 或声音后，完整重编译三段与对齐行。
- 生成后正常速度观看全过程，检查中间动作是否物理成立、身份/地理/道具是否稳定、终点是否真正落到 Picture 2。端点相似但过程崩坏仍判定为返修。
- FL2VA 测试失败后根据真实缺陷重写过程、重做端点或改选 Ref2VA；不自动把失败任务改成尾帧续接。
