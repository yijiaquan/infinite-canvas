# Prop Plate Prompt Method

Use this reference for a production-ready `Prop + State` image: a recurring object, an object that will be held, opened, read, transferred, damaged or otherwise needs continuity. It compiles one current prop specification into one OpenAI-compatible image request. It is not a scene still, a character portrait or a storyboard panel.

## What one plate establishes

One plate proves the same object can be recognized and used again. It must make these layers separately readable:

- **Stable prop identity:** silhouette, proportions, scale, material, permanent marks and functional construction.
- **Current State:** accepted open/closed condition, contents, damage, contamination, readable-text policy and ownership/custody when visible.
- **Reuse job:** what a later image or Shot must preserve — shape, operation, scale, state, or a specific contact/installation relation.

For a rope, cuff, strap, hose, cable, tether or inserted connector that remains consequential across Shots, its `State` also names the carrier, both endpoints, connection mechanism and current mode (`attached / sliding / slack / detached / inserted`). The plate establishes the reusable mechanism; the relevant director-board Panels establish the in-scene relationship. Do not create a new prop just because the camera changes.

Create a new `Prop` only when the persistent object, its basic construction or its enduring function is different. Create a new `State` when an open/closed condition, contents, sustained damage, surface condition, text, quantity, holder, attachment endpoint or connection mode must remain continuous. A one-off hand position, action beat or screen-side position remains in the Shot rather than becoming a new plate.

## Reference input

For a new prop, the target prop is the only subject and no visual reference is required. For a state, repair, variant or established prop, put the current prop reference in `Image 1`.

- `Image 1` controls only the target prop's shape, materials, scale, permanent marks and declared current State.
- Add a character reference only when wear, installation, grip scale or ownership must be visually demonstrated; it does not redesign the prop or become the plate subject.
- Add a Location + View only when the prop's placement or installation cannot be understood on a neutral background; it controls only that necessary spatial relation.

Pass only the needed real images in this exact order and state the role and non-control boundary in the final prompt.

## Prompt template

Compile the provider prompt from the following structure. Replace all bracketed fields with project facts; omit a section only when it is genuinely inapplicable.

```text
创建一张可供后续图片和视频复用的电影级道具参考板。唯一主体是 [道具名称 / Prop ID / State ID]；用途是让后续镜头稳定保持[识别 / 握持 / 佩戴 / 安装 / 开启 / 转交 / 损坏状态]。不要把它画成剧情场景、角色肖像或多个无关物品的拼贴。

稳定形制：道具为[物体类别与基本用途]，[整体轮廓与长宽厚比例]，[真实尺度或中性尺度参照]。主材质为[材料、表面工艺、固有色、反射或粗糙关系]；次要材质为[材料]。必须保留[接缝、铰链、扣件、开口、把手、接口、齿形、封口、永久凹痕、制造标记或其他识别结构]，并清楚说明各部件的相对位置与连接关系。

当前状态：此刻道具处于[开 / 关 / 折叠 / 展开 / 完好 / 损坏 / 已使用]状态；[内容物、可见程度、污渍、烧痕、裂纹、缺失部件、数量、持有人或放置位置]为[精确状态]。若它是跨镜连接道具，明确[归属者]、[端点 A]、[端点 B]、[连接路径/长度或滑动机制]与[attached / sliding / slack / detached / inserted 当前模式]。这些是当前 State，不得反过来改变道具的基础轮廓、材料、功能或制造结构。

可操作性：[说明开启方向、可抓握区、活动部件、安装面、接口或佩戴关系]必须直观可读，足以让后续镜头正确表现使用方式；不要额外演出剧情动作。

版式与尺度：采用[单一英雄视图 / 正侧必要视图 / 全貌加局部结构细节]，道具在画面中占[比例]；[需要的结构局部]清晰可见。背景为[干净中性背景 / 受控安装环境]，不出现无关角色、叙事环境或额外复制品。

光线与材质：使用[主光方向、高度、软硬和色温]，让[材质纹理、边缘轮廓、活动部件、状态痕迹]可读；不得用过强戏剧阴影遮挡结构或让不同视图的材质看起来不一致。

视觉语言：服从项目已声明的[媒介/真实度、主要识别通道、轮廓与材质重点、空间密度、色光响应和禁区]；它只能影响本板的表现方式，不得篡改道具的形制、状态、用途、数量或剧情归属。

文字策略：[exact readable 的准确文字、位置与承载面 / graphic-only 符号布局 / 无可读文字且承载面保持空白 / 后期加字的清晰预留区域]。不得生成额外 Logo、编号、网址、水印或无来源文字。

必须保持：[道具 ID、形制、比例、材料、关键结构、数量和当前 State]。禁止结果：[错材质、错误开合方向、结构断裂、比例漂移、额外复制品、错误内容物、错误持有人、无关人物、无关场景和本任务已知失败项]。
```

## QA

Inspect the real image before adoption. Reject it when the object cannot be recognized from its silhouette and structure, scale is ambiguous, functional parts do not connect plausibly, state conflicts with itself, permanent marks drift, an extra copy appears, text violates the selected policy, or a character/environment overwhelms the prop reference. For a linked prop, its connector, both attachment interfaces and declared operating mode must be recognizable; the actual attachment in each Shot is checked separately in the relevant director-board Panel. A successful request or file is not proof that the plate is usable.
