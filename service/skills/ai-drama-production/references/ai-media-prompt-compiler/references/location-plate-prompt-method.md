# Location Plate Prompt Method

Use this reference for either a complete multi-view `scene_board` or a production-ready clean `Location + View`. A scene board establishes a recurring location across directions; a clean master/view is what later adaptive-panel director boards navigate. Neither is a character portrait, cinematic action still or director storyboard.

## Complete scene-board mode

For a `hero_recurring` Location, or a `standard` Location that needs multiple directions, door/interior-exterior relations, reverse coverage or complex blocking, create one complete 16:9, 2×3 scene board in a single request. Use six mutually consistent zones: hero master, reverse view, left oblique, right oblique, entrance/connection view, and a simple top-down topology inset. Keep one empty location, one structure, one fixed-object inventory, one time/weather state and one motivated main light across all zones.

The topology inset explains wall/opening/path/large-fixture relations and legal camera/blocking space; it must not invent alternate architecture. Adopt the result as `scene_board`. It is the upstream geography source for clean `scene_master` and `scene_view` images used during director-board construction, and the complete current `scene_board` is also the normal H3 geography Picture for a recurring or multi-direction Location. Its prompt role must exclude the grid, labels, alternate-view layout and topology inset from the final video. When deriving a clean view, remove the board layout completely.

## What the image establishes

A scene master fixes the navigable world: room or exterior volume, architectural structure, entrances, paths, landmarks, fixed furniture/prop placement, materials, main light and current temporal state. It is empty stage by default so it does not accidentally turn one character pose, hand-held prop or temporary drama into permanent geography.

For a recurring or spatially complex Location, use the existing Scene Bible fields: stable Anchor IDs, optional Top-Down/Blender spatial relation, action axis, Blocking Zones and Camera Zones. These describe the world and legal observation areas; they do not prescribe a final Shot composition. A Camera Master View is a spatial reference, never a template for lens, shot size, exact height, foreground, depth or performer pose.

A `Location + View` is one declared camera-side observation of that same place in one declared Color/Lighting State. Make a new View when an interior/exterior, reverse angle, doorway side or occluded landmark must remain stable later. Change only camera position and viewing direction; reconstruct only the naturally occluded portions that connect to the current scene reference. Do not invent a new room, rearrange an exit, replace the established main light, or silently change time of day, weather, practical-light state or color treatment.

Add a non-identity scale reference only when scale, installation or a persistent scene state cannot otherwise be read. Do not add characters, crowds or action merely for atmosphere.

## Reference input

- A new complete scene board can be text-to-image from the approved production breakdown, Scene Bible and visual-language text. Once accepted, derive the clean scene master and needed views from it rather than independently regenerating each direction from prose.
- A new scene master for a simple or transient Location can be text-to-image from the approved production breakdown and visual-language text.
- A new View or scene repair uses the current `scene_board` first when one exists, followed by the closest clean master/View. The board controls cross-direction topology, architecture, openings and Anchor relations; the clean image controls the nearest visible side, fixed furniture/prop appearance, material finish, current Color/Lighting State, palette and main light. Without a scene board, the current master/View carries both roles.
- Add a character or prop reference only when the requested view must show its scale, wear or installation relation. It must not redesign the room or become the subject.
- When `Look route = project_look_board`, append exactly one accepted Palette last: the current Scene Palette for this Location/Color State when one exists, otherwise the Global Project Palette. The Scene Palette already retains the parent anchors, so never append both. The selected Palette controls the approved color range, warm/cool balance and accent-color relationship; the prompt text continues to define medium/render language, skin/light/material behavior, geography, people, props, action and text.

## Prompt template

Compile the provider request from the following structure. Replace bracketed fields with approved facts and omit only genuinely inapplicable fields.

```text
创建一张用于后续分镜导演板和视频的场景参考图：[Location ID / Master 或 View ID]。用途是让后续镜头稳定保持[空间地理 / 门内外关系 / 反打方向 / 关键地标 / 安装关系]。这是[空场场景主图 / 已建立地点的新 View]，不是人物肖像、剧情静帧、拼贴或导演板。

空间拓扑：[地点类别、整体体积、主要区域]；[入口、出口、道路、门窗、楼梯、走廊、可操作区域]的相对位置为[明确关系]。固定地标包括[地标及画面/场内位置]；固定家具、重复道具或安装物包括[数量、位置、朝向]。所有元素属于同一可导航空间，不得镜像、遗漏、移动或重新设计。

Anchor 与空间关系：[A01 名称和位置、A02 名称和位置……]；[按需 Top-Down/Blender 空间来源]规定[墙体、通道、固定物、可走区域]；主要动作轴线为[命名锚点 ↔ 命名锚点]，默认工作侧与屏幕方向为[关系]。Blocking Zone 只规定人物可合法活动的区域，不把任何人物固定在其中。

当前 View：摄影机位于[Camera Zone / 门内或门外 / 可见锚点一侧]，朝向[方向 / 目标]；画面必须看见[必要 Anchor、入口、路径、地标]，必须不看见或暂不揭示[可见边界外的事实]。若这是新 View，只改变机位和朝向，并让新露出的区域与当前场景的墙体、天花、开口和固定物自然接合。该 Master View 只建立此方向的空间事实，不锁定后续 Shot 的精确机位、景别、焦段、机高、构图、前景、景深或人物姿态。

场景状态与材质：[时间、天气、营业/损坏/占用状态]；[墙体、地面、玻璃、金属、木材、织物等]的材料、磨损和反射关系保持稳定。主光来自[方向、高度、软硬、色温或实际光源]；阴影、环境光与色彩关系使入口、空间深度和关键结构清晰可辨。

版式：采用[景别、机位高度、镜头/FOV 意图]，让[关键拓扑关系]在画面中可读；前景、中景、远景分别为[内容]。默认空场，不出现可识别角色、人物动作、车辆或无关物件；如确需无身份尺度参照，仅允许[明确、无身份的参照]，不得成为视觉主体。

文字策略：[准确可读文字及其承载面 / 仅符号形状 / 无可读文字 / 后期加字预留区域]。无其他 Logo、号码、网址、水印、字幕或签名。

必须保持：[Location + View、空间拓扑、入口出口、地标、固定物数量与位置、当前 Color/Lighting State、时间状态、主光、材质、项目视觉语言]。禁止结果：[额外房间、镜像布局、移动门窗、地标消失、擅自换时间/天气/色调/光源状态、人物剧情、错误文字、拼贴格线、无关道具和本任务已知失败项]。
```

For complete scene-board mode, replace the single-view layout paragraph with: `一张 16:9、2×3 六区完整场景身份板；主视角区域最大，其余依次为反向、左斜、右斜、入口/连接方向和简洁俯视拓扑。六区是同一空场的互补观察，不是六个不同设计。每区保留同一 Anchor ID、门窗、固定物数量、材质、时间状态和主光；俯视区只解释已建立关系。` Also require that each direction can be derived later as a clean standalone view without inheriting grid or annotation graphics.

## QA

Inspect the real image before adoption. For a scene board, first verify all six zones close into one navigable space: corresponding doors, walls, openings, anchors, fixed-object counts, scale and main-light direction agree, and the top-down inset explains rather than contradicts the perspective views. For a clean master/view, confirm it is navigable: the required entrances, paths, Anchor IDs, fixed-object count, declared Camera Zone/side, visible boundary, scale, main light and materials must agree with the accepted Location. Reject a visually attractive image that changes geography, adds a performer to an empty stage, reveals protected information, or only resembles the project style without preserving the actual space. Do not reject a later Shot merely because it uses a different lens, height, composition or foreground inside the same legal Zone.
