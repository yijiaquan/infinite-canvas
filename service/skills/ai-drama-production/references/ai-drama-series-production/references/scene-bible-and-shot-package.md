# Scene Bible 与 Shot Package 分工

本页用于重要场景的复用规划，以及同一场景中多个 Shot 的动态摄影设计。核心原则是：`Build the world once. Shoot it many ways.` 场景长期资产回答“世界是什么、东西在哪里”；Shot Package 回答“这一镜怎么拍、演员此刻怎么演”。不要把场景稳定误解成构图、机位或人物姿态固定。

## 三种场景生产等级

| 等级 | 适用条件 | 最小充分内容 |
|---|---|---|
| `hero_recurring` | 主场景、跨集重复、复杂走位或多方向覆盖 | 一张完整 2×3 多视角场景板、由其派生的干净 Scene Master、稳定 Anchor ID、俯视空间关系、主要动作轴线/屏幕方向、Blocking Zone、Camera Zone，以及实际需要的 Scene View Library。 |
| `standard` | 本集多次出现、存在两三个方向或关键进出关系 | 有多方向/门内外/反打/复杂走位时建立完整场景板，否则使用 Scene Master；再记录主要 Anchor、简化空间关系、主要轴线、3–5 个以内 Camera Zone，以及当前覆盖真正需要的 View。 |
| `transient` | 一次性短场景、单一工作侧、没有复杂地理交接 | Scene Master 或当前 View、必要空间说明、可见 Anchor 与当前 Shot 的 Camera Zone；不为未来可能性批量生成俯视图或 View。 |

等级只决定资产投入，不改变真实 Shot 的质量要求。随剧情复用增加时可以从 `transient` 升级；不提前制作不会被使用的 Camera Zone、Coverage Board 或 View。

## Scene Bible 的稳定层

- **Complete Scene Board**：重要地点的最高全局空间身份基准。一张 16:9、2×3 六区板同时建立主视角、反向、左右斜角、入口/连接方向与俯视拓扑；所有区必须闭合为同一个空场。它供审阅、派生静态制板所需 View，并直接作为 H3 的常规场景参考；提示词不得让六区板式、俯视图或标签进入成片。
- **Scene Master**：由完整场景板派生的干净主视角；简单地点可直接生成。它固定当前方向可见的体积、结构、门窗、固定家具/大型设备、材质、美术、使用痕迹、时间状态和主光。
- **Spatial Anchor System**：只给会跨镜定位世界的实体稳定 ID，例如 `A01 主控制台`、`A02 主屏幕`、`A03 入口`。提示词和 Shot 只引用当前画面实际可见或影响动作的 Anchor，不把所有 ID 堆入每个请求。
- **Top-Down / spatial relation**：按需从 Scene Master 与已采用 View 推导墙体、入口、通道、固定物、可走区域和摄影机可进入区域。它解释“东西在哪里”，不能重新设计“长什么样”。选择 Blender 时，共享 `.blend` 可承担这项可导航空间职责；不重复制作第二份精绘地图。
- **Action Axis / Screen Direction**：记录人物与人物、人物与门、人物与设备之间真正影响剪辑的轴线、眼线、进入/退出方向。跨轴必须是可见跨越、中性重建或已采用新 View，不允许随机翻转。
- **Blocking Zone**：人物可坐、站、接近、离开、通过和互动的合法区域，不是固定站位。具体站位、重心和动作由 Shot 决定。
- **Camera Zone**：使用稳定 ID `CAM-ZONE-A`。它是同一工作侧内的合法摄影区域和基础观看方向，不是固定相机坐标；区内允许远近、左右、升降、焦段、景别、过肩、前景遮挡和小幅角度变化。
- **Scene View Library**：只收录生产真正需要且已通过 QA 的 Master View / `Location + View`。每个 View 帮助判断墙、门、设备、锚点和光线在哪里；它不是最终 Shot 构图模板。

实际图片资产使用 `scene_board`、`scene_master` 与 `scene_view`。干净 `scene_master` / `scene_view` 服务正式导演板的静态构建；当前完整 `scene_board` 作为 H3 的常规地理参考，提示词必须排除其网格、标签、拓扑图与空场板式泄漏。简单 `transient` Location 可改用其单张 current 场景图。Anchor、轴线、Blocking Zone 和 Camera Zone 写在现有 Series Bible/制作拆解；选择 Blender 时也写入同一共享场景，不另建平行连续性文档。

## Camera Master View 的职责边界

Master View 只能控制该方向真实可见的空间、固定陈设、主光和锚点关系。它不得迫使 Shot 复制以下内容：

- 景别、焦段、精确机位、机高和俯仰；
- 人物画面位置、身体姿态、表情和视线；
- 前景遮挡、景深、构图、主运镜和戏剧落点。

同一 Camera Zone 内改变这些动态项时，仍使用同一 `Location + View` 的地理事实设计分镜导演板中的不同 Panel。只有门内/门外、越轴后的另一侧或新露出空间需要稳定时，才创建新的 View。

## Shot Package 的动态层

每个真实 Shot 在现有制作拆解中按需记录：Dramatic Beat、时长、Scene/Character、Camera Zone、景别、焦段、精确机位/机高/角度、主运镜、前景/主体/后景、人物 Blocking、身体姿态与重心、头肩手腿躯干、视线、动作阶段、表情状态/强度、屏幕方向、可见 Anchor、起止状态和连续性要求。

相邻 Shot 除非明确采用有目的的固定覆盖，通常让 `Camera / Body / Information` 三项至少两项出现可读变化。场景资产稳定的是世界，Shot Package 允许摄影和表演随 Dramatic Beat 变化。

## 当前 Clip、分镜导演板与时长约定

- 默认先把同场、同时间、状态连续的 Beat 聚合成一个 H3 Clip，再在同一 Clip 内设计实际数量的有动机的 editorial Shots。分镜时长由 Beat、动作、对白与切点决定，不机械平均。
- 一个 Clip 对应一张完整导演板和一次 H3 Ref2VA 请求。完整整板作为 `<Picture 1>`；每格建立一个可读镜头瞬间，动作格优先选择 `mid_state`，H3 按递增时间戳完成多次覆盖与连续动作。
- 不把分镜拆成多张 Picture 或多次 H3 请求，不默认增加 Start/Peak/End 三张图片，也不自动回到首尾帧插值。跨场、换时、地理/状态不兼容、对白动作装不下、参考冲突或真实 QA 失败时才新建下一个 Clip；若选择 Blender 白模，则用同 Clip 连续预演表达摄影与调度。

## 生产层级

`Project → Episode → Scene → Clip → 完整分镜导演板 → 实际 N 个 editorial Shots → H3 Video Clip → Edit`

Scene Bible 与 Character Bible 是长期稳定层；Clip、分镜导演板、Panel/Shot 和 Video Clip 是当前场景的动态生产层。它们仍记录在现有制作拆解中，不建立新的控制文档。
