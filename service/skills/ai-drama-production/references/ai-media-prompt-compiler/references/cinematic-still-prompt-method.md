# Cinematic Still Prompt Method

Use this reference for a cinematic source still, scene/character establishing image, or production start/reference image. It produces one complete semantic prompt, not an identity board or director storyboard.

## Full structure

Do not shorten the request to `[character] + [style]`. Compile all applicable sections below and omit only truly inapplicable fields.

```text
任务：生成一张 [年代 / 类型 / 世界观] 风格的电影级静帧，采用 [照片级真实 / 项目批准媒介]。

主体：[Character ID / Look ID]，[年龄、脸型、发型、服装、鞋靴、固定配件和视觉气质]。人物正在 [一个清晰动作]；[左/右] 手 [接触物与状态]，另一只手 [接触物与状态]；表情与目光为 [可观察状态]，传达 [当前剧情判断或情绪]。保持身份板中的脸、身体比例与本 Look 完全一致。

场景：[Location ID]。固定世界元素包括：[地标1及位置]、[地标2及位置]、[车辆/建筑/道路/关键道具及数量状态]、[地表/天气/远景]。这些元素组成同一连续空间，不得遗漏、镜像、瞬移或重新设计。

构图：[主体与关键物体在画面中的位置]；[环境]占据 [负空间比例/区域]；前景为 [内容]，中景为 [内容]，远景为 [内容]。强调 [人物与环境尺度关系 / 孤独 / 压迫 / 亲密 / 危险等可观察构图结果]。关键车辆、人物身体和剧情道具必须完整，不得被意外裁切。

动作与环境动态：[风、尘、雨、布料、头发、纸张、蒸汽、灯光等]如何运动；所有动态必须服务当前一帧的叙事，不添加无关特效。

光线：[主光方向、高度、硬软、色温]；[补光/环境光/阴影颜色]；[体积光、轮廓光、反射或热浪]。明确人物脸、轮廓和关键道具的可读性。

摄影语言：[景别]，[机位高度/方向]，[镜头或 FOV 意图]，[景深]，[胶片颗粒/质感]，[批准色彩关系]。将影片或摄影参考翻译为可观察的画面特征，不依赖作品名本身。

文字策略：故事可见文字只允许 [准确文字清单及位置]；如果当前模型未验证能准确生成，则改为空白/不可读图形，并在后期确定性添加。无其他文字、Logo、水印或签名。

必须保持：[身份、Look、人物数量、车辆/道具数量、场景地理、地标位置、时代、光向和项目风格]。
禁止结果：[卡通化、插画化、错误类型风格、身份漂移、额外人物、额外车辆、物体消失、肢体错误、AI 伪影以及本任务的已知失败项]。
```

## Compilation rules

- Keep ratio, resolution, seed, model, quality, and other request parameters outside prose unless the verified provider requires them in text.
- Replace named-film shorthand with concrete composition, light, palette, texture, rhythm, and environmental behavior. Preserve source names only as internal inspiration/evidence when rights and policy allow.
- Use one clear visible action. If the request describes an action sequence, move it to a storyboard or video Shot contract.
- Do not let a cinematic still replace the identity board. It proves only this Look in this action, framing, and environment.

## QA

Check identity/Look, required body and object completeness, geography, counts, contact points, intended action, negative-space intent, light direction, story-visible text policy, technical properties, and absence of added people, vehicles, or props.
