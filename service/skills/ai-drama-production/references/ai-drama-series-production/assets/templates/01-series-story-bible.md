# Series Bible

## Series Promise

- 类型与受众：
- 一句话承诺：
- 世界规则：
- 视觉与声音基调：
- 明确禁区：

## 导演脊柱

- 一句导演意图（观众应持续感到什么，人物与世界怎样共同表达它）：
- 默认镜头 / 运动态度：
- 主光 / 色彩原则：
- 声音密度 / 静默原则：
- 何时刻意破格，以及它服务的剧情转折：

## 可观察视觉语言

- 媒介 / 真实度：
- 主要识别通道（面部、剪影、材质或其他）：
- 轮廓、材质与表面处理：
- 空间密度 / 景深 / 留白：
- 色彩关系与光线响应：
- 明确禁区：

> 媒介、真实度、轮廓、材质、光线和画面密度以文字进入身份板、场景、分镜导演板和视频提示词；图片色彩基准使用下方的简洁项目配色色卡。完整 LookDev 展示板只在主人明确要求做美术开发审阅时单独制作。

## Project Look / 项目配色色卡

- Look route（`text_only / project_look_board`）：
- Project Look ID：
- 基础色域 /综合色彩倾向：
- 肤色保护：
- 阴影 / 高光 / 黑位 / 对比 / 饱和度：
- 材质与表面响应：
- 强调色及其叙事职责：
- 禁止色 / 禁止的全局滤镜或漂移：
- 允许破格的剧情条件：
- current Global Project Palette（`reference_frame`，三条横向纯色色带）：
- 代表性 Scene Master 来源（2–4 张；无可用图时写文字场景族）：

> `project_look_board` 路线先建立一张全片 Global Project Palette 母色板：三条横向纯色色带分别表达全局基础/黑位与中性锚点、重复环境/光线色族、角色/道具/叙事强调色。肤色保护、明暗、材质、媒介和画面密度保留在文字 Project Look。色板生图提示词只使用正向的纯色色块分组目标。完整 LookDev 展示板仅在主人明确要求时单独制作。

### Scene Palette（按需）

| Scene Palette ID | Parent Global Palette | 保留的全局锚点 | 局部替换/新增的环境与光线颜色 | 适用 Location / Color State / Clip 边界 | current 文件 |
|---|---|---|---|---|---|

> 只有特殊 `hero_recurring` 场景或连续段落具有跨多个 Shot/Clip 复用的独立综合色彩家族时才建立 `LOOK-SCENE-<LOCATION>-<STATE>`。单次警报闪烁、爆炸、灯光亮灭或一镜曝光变化继续写 `Color State / Lighting State`。子色板必须保留母色板核心锚点；下游场景/View/导演板只绑定 current 子色板，不同时追加母色板。

## Story Engine（连续剧按需填写）

- 反复压力来源：
- 主角惯常策略：
- 对抗力量如何反制：
- 本轮结果与代价如何制造下一轮压力：
- 观众反复得到的回报：
- 旧策略何时会彻底失效：
- 人物为何不能轻易退出：

## Characters

| Character | 欲望 | 保护的价值/关系 | 惯常策略与筹码 | 盲区 | 改变条件 | 关系 | 长期变化 |
|---|---|---|---|---|---|---|---|

## 同框角色尺度（按需）

| 同框角色 / 组合 | 相对身高与体量 | 眼线关系 | 轮廓 / 服装区分 |
|---|---|---|---|

> 仅填写会反复同框的角色；用于分镜导演板与视频的相对尺度，不改变任何人的独立 `Character + Look` 身份板。

## Recurring World

| Location / Prop | 固定事实 | 可变化范围 | 连续性风险 |
|---|---|---|---|

## Recurring Scene Bible（按需）

| Location ID | 生产等级 | current Scene Master | Scene Look ID / 继承 Project Look | 默认 Color State | Light Source Map（Light ID → Anchor / 方向 / 色温或颜色 / 范围 / 状态） | Anchor ID 与相对关系 | Top-Down / Blender 空间来源 | 主要轴线 / 屏幕方向 | Blocking Zone | Camera Zone | 已采用 View Library | 复用边界 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

> 生产等级为 `hero_recurring / standard / transient`。主场景才补完整 Anchor、空间关系、轴线、合法走位区、Camera Zone、实际需要的 View 和有动机的 Light Source Map；一次性场景只保留当前镜头真正需要的事实。`Color State` 管综合色彩状态，逐 Shot 的光源亮灭/闪烁/遮挡写为 `Lighting State`，不能用无来源全局滤镜代替。只有独特色彩/灯光身份仍无法从 Project Look + Scene Master 继承的主场景，才按需采用一张 Scene Look Board。Camera Zone 使用 `CAM-ZONE-*` ID，不是固定相机坐标。Scene Master / View 负责“世界是什么”，不能锁定后续 Shot 的景别、焦段、精确机位、构图、人物姿态或表情。

## Episode Map

| Episode | 进入状态 | 本集承诺/目标 | 阻力与可见转折动作 | 局部结果/代价 | 信息权限变化 | 退出压力/必须继承事实 |
|---|---|---|---|---|---|
