# Look / Color Continuity

本页把项目的色彩与灯光意图传递到场景、分镜导演板、Shot 和视频。它是轻量创作方法，不是 Color Lock、审批、评分、逐镜色卡或新的连续性账本。

## 核心原则

- 锁定的是视觉语言，不是每个像素、每个镜头的曝光值或同一套滤镜。
- 摄影机、构图、人物表演和局部明暗可以随剧情变化；肤色逻辑、阴影/高光倾向、黑位、饱和度边界、强调色职责和有动机光源必须继承。
- `Color State` 说明当前叙事段落允许怎样改变色彩关系；`Lighting State` 说明当前 Shot 中哪些真实光源亮、灭、闪烁、遮挡或改变强弱。二者不能混为“换一个滤镜”。
- 颜色语义必须按当前作品定义。红色不天然等于危险，蓝色也不天然等于安全；只有剧本、世界和导演意图赋予它们职责后才成立。

## 继承层级

```text
Project Look text + Global Project Palette
  -> Scene Look + optional child Scene Palette
    -> Sequence / Beat Color State
      -> Shot Lighting State
        -> adaptive-panel director board
          -> generated video
```

- `Project Look`：全片的媒介/真实度、基础色域、肤色、阴影、高光、黑位、对比、饱和度、材质响应、强调色和禁区；`Global Project Palette` 是它的图片母色板。
- `Scene Look`：继承 Project Look，再写本地点的时间/天气、主光/辅光/实景光、墙面与材质反射、局部强调色，以及不可无故改变的光源锚点。只有持久、可复用的特殊场景色彩家族才建立一个继承 Global Project Palette 的 `Scene Palette` 子色板。
- `Color State`：只在剧情真的改变观众感受或信息时使用，例如“正常运转 / 警报介入 / 断电余光”。它改变综合色彩关系，不重建地点。
- `Lighting State`：当前 Shot 的可观察光源状态，例如 `LIGHT-RED-ALARM=闪烁`、`LIGHT-CEILING-02=熄灭`、门外冷光进入范围扩大。它必须有 Scene Bible 中真实来源或当前剧情新发生的可见来源。

同一 Scene、Color State 与 Lighting State 可跨多个 Shot 复用。换景别、机位、Camera Zone、人物位置或表情不自动创建新状态。

## 轻量字段

项目/普通短视频简报只需记录：

- `Look route: text_only | project_look_board`；
- Look ID；
- current Global Project Palette ID；
- 用于提炼全局色域的代表性 Scene Master 或文字场景族；
- 基础色域与综合色彩倾向；
- 肤色保护；
- 阴影、高光、黑位、对比和饱和度；
- 材质/表面响应；
- 强调色及其叙事职责；
- 禁止色、禁止漂移和允许破格条件。

重复或关键场景再记录：

- Scene Look ID 与继承的 Project Look；
- 按需的 Scene Palette ID、父 Global Palette、保留锚点、局部替换/新增颜色及适用边界；
- 当前默认 Color State；
- `Light Source Map`：Light ID、依附的 Anchor ID、位置/方向、颜色或色温倾向、照射范围、默认状态与可发生变化；
- 墙面、皮肤、服装、金属、潮湿表面等对这些光源的可观察响应；
- 本场特殊强调色及其来源。

Shot 只解析当前有效的 `Color State + Lighting State`，不复制整份 Look Bible。

## Global Project Palette 与 Scene Palette

默认生产色板是一张供生成模型识别全片综合色域关系的 `Global Project Palette`，不是完整 LookDev 展示板，也不是随意挑选的一排颜色。它先从文字 Project Look 与可用的 2–4 张代表性 current Scene Master 提炼全片共同色彩；若场景图尚未生成，则先用已确认的主要场景族、时间/天气和有动机光源进行文字推导，之后只有真实 QA 发现全局漂移时才升级版本。

Global Project Palette 固定为 16:9 横向画面，只使用平整、哑光、边缘清晰的矩形纯色色块，并分成三条横向色带：

1. **全局基础与安全锚点**：黑位、基础环境中性色、肤色或中性材质锚点、通用阴影/高光关系；
2. **重复环境与光线色族**：从代表性场景提炼会跨场景复用的日夜、室内外、天气或主要实景光色族；
3. **角色、道具与叙事强调色**：重复服装/道具识别色、警示或信息色，以及其综合色彩职责。

每条色带内部按综合色彩关系排列 3–6 个大色块。三条色带清楚分组、间距统一、留白稳定，背景使用中性浅灰或米白。颜色名称、职责、肤色保护、材质与灯光响应保存在文字 Project Look 中，由后续提示词继承；色板本身只提供可视色域、冷暖比例与强调色关系。

`Scene Palette` 是按需子色板，稳定 ID 为 `LOOK-SCENE-<LOCATION>-<STATE>`。它只服务一个特殊 `hero_recurring` 场景或一组会跨多个 Shot/Clip 复用的明确色彩状态。子色板声明父 `LOOK-PROJECT-*`，保留全局黑位/中性或肤色锚点、饱和度边界和主要强调色职责，只在第二条环境/光线色带及必要的局部强调色中替换或增加本场有真实来源的颜色。它同样只由分组的纯色色块组成，不转成场景缩略图、材质球、人物示例或综合色彩球。

色卡最终生图提示词使用纯正向目标描述，只写画面应当包含的布局、色块数量、排列顺序、颜色和综合色彩关系。内部排除项只用于 lint，不输出为 negative prompt、否定式段落或“不要/禁止/避免”列表。

推荐正向结构：

```text
创建一张 16:9 Global Project Palette。中性浅灰背景上排列三条清楚分组的横向色带，全部由边缘清晰、平整哑光、尺寸协调、间距统一的矩形纯色色块组成。第一条“全局基础与安全锚点”依次呈现：<黑位/中性环境/肤色或材质锚点/通用阴影与高光颜色>。第二条“重复环境与光线色族”依次呈现：<从代表性场景 1–4 提炼的环境与有动机光线颜色>。第三条“角色、道具与叙事强调色”依次呈现：<重复识别色与强调色及其职责>。三条色带留白充足、综合色彩关系清晰，形成一张统一全片的电影项目母色板。
```

Scene Palette 推荐正向结构：

```text
创建一张 16:9 Scene Palette，所属场景为 <Location / State>，父色板为 <LOOK-PROJECT-ID>。中性浅灰背景上排列三条清楚分组的横向纯色色带。第一条完整保留父色板的 <黑位、中性/肤色锚点、通用阴影与高光关系>。第二条使用本场有真实来源的 <环境色与主光/辅光/实景光颜色>，替换父色板中不适用于本场的环境色族。第三条保留父色板的 <角色/道具/叙事强调色职责>，并加入本场唯一需要的 <局部强调色>。所有色块平整哑光、边缘清晰、间距统一、留白充足，形成与全片母色板一致而具有本场辨识度的电影场景色板。
```

完整 LookDev Board 只在主人明确要求做美术开发展示、或创作团队确实需要人物/场景/材质状态对照时单独制作。它属于可选审阅资产，不替代默认项目配色色卡，也不作为后续正式静态图片的默认综合色彩参考。

生成规则：

1. 在 Bible 或内容简报中静默选择 `text_only` 或 `project_look_board`，不另建确认、锁或报告。
2. 下列任一情况必须选择 `project_look_board`：非通用的强风格媒介/渲染语言；跨多个场景、时间或天气仍需统一色域；明确的冷暖关系；定制肤色、阴影、高光、黑位、对比、饱和度或材质响应；强调色承担叙事职责；存在需跨资产复用的 Color State；现有结果已出现综合色彩漂移。
3. 只有自然/通用视觉、场景少且综合色彩兼容、没有专门色光/材质/强调色职责，并能由文字 Project Look + Scene Master 稳定继承时，才可选择 `text_only`。
4. `project_look_board` 路线必须在第一张正式身份板、场景、道具或分镜导演板之前生成并采用一张 Global Project Palette。它使用现有 `reference_frame` 类型和 `LOOK-PROJECT-*` ID；一次静态图片请求只生成一张三色带母色板。
5. 身份板与跨场景复用的中性道具必须连接 Global Project Palette。场景主图、Scene View 和完整分镜导演板若所属场景有 current Scene Palette，则只连接该子色板；没有子色板时连接 Global Project Palette。子色板已经继承全局锚点，同一请求不得同时连接父子色板。图片只控制色域、冷暖比例和强调色关系；媒介/渲染语言、肤色保护、阴影、高光、黑位、材质响应、画面密度及参考越权边界继续由文字 Project Look 和当前静态提示词表达。
6. 只有 `hero_recurring` 场景或连续段落具有独特且会跨多个 Shot/Clip 复用的综合色彩家族时，才按需生成 `LOOK-SCENE-<LOCATION>-<STATE>` Scene Palette。它以 current Global Project Palette 和该地点已通过 QA 的 current Scene Master 为真实来源，不凭文字另造一套无关色域；若 Scene Master 尚未建立，先用 Global Project Palette 生成并采用 Scene Master，再派生子色板供后续 View、导演板和必要返修使用。一次警报闪烁、爆炸、临时灯灭、局部遮挡或单镜曝光变化继续使用 `Color State / Lighting State`，不新建 Scene Palette；`standard / transient` 场景默认不生成。
7. 已在制作中的项目不因新增色板批量重做旧资产。若 current 文件是包含人物、场景示例、材质球或综合色彩球的旧式 LookDev Board，保留旧版本，并在下一次实际色板工作时为同一稳定 ID 生成新版本。新色板通过真实画面 QA 后才成为 current；旧资产只有在真实画面 QA 证明色彩漂移时才定向返修。
8. 若真实摄影需要曝光、白平衡或摄像机校准，可另用真实灰卡/ColorChecker；它不等于本页的创作 Look Board，也不作为 AI 画面风格板。

## 分镜导演板与视频继承

完整分镜导演板先继承 Project Look 与 Scene Look，再逐格解析当前 Color State、Lighting State 和实际可见光源。`project_look_board` 路线下，整板请求必须真实连接唯一一张最具体的 current Palette：有 Scene Palette 时用子色板，否则用 Global Project Palette；只写 Look ID、同时绑定父子色板或只写综合色彩文字都不能替代正确图片绑定。提示词必须把综合色彩要求写成可观察关系，例如：

- 肤色保持自然偏中性，不被警报红光整体染成纯红；
- 红色只来自墙面警报灯并在邻近金属产生有限反射；
- 背景黑位深但保留设备轮廓，屏幕高光不过曝；
- 冷门光只影响门口区域，不成为覆盖全室的蓝色滤镜。

H3 视频继续从完整分镜导演板继承主要 Look。Global Project Palette 与 Scene Palette 都不进入 H3 Picture；若整板无法覆盖一项高风险综合色彩事实，先用当前最具体的 Palette 修正或重做整板，再让 H3 从整板继承。镜内允许随动作发生真实的遮挡、亮灭、闪烁、烟雾散射和局部曝光变化，同时维持已建立的综合色温、肤色、阴影色、黑位与强调色职责。

## Prompt 的 Look Continuity Block

最终图片或视频提示词只写当前请求解析后的紧凑块：

```text
Look continuity:
- inherit: <Project Look ID> / <Scene Look ID>
- color state: <当前综合色彩状态及唯一允许变化>
- lighting state: <Light ID 与可见状态>
- preserve: <肤色、阴影、高光、黑位、材质、强调色职责>
- allowed change: <本 Shot 唯一允许的有动机色光变化>
```

没有独立 Scene Look 或特殊状态时省略对应行。`project_look_board` 路线的静态资产/分镜导演板提示词必须真实连接并引用对应配色色卡；`text_only` 路线只继承文字 Project Look。H3 从完整导演板编译出的规划语义和实际身份/场景/道具参考继承 Look，不上传导演板本身。

## QA 与返修

图片、分镜导演板、视频和整片在真实画面中按需检查：

- 肤色是否仍符合 Project Look，且没有被局部光源全局染色；
- 阴影、高光、黑位、对比、饱和度和材质响应是否在允许范围；
- 强调色是否来自已建立的光源/道具/环境，并仍承担声明的叙事职责；
- `project_look_board` 路线的身份板/中性道具是否继承 current Global Project Palette，场景/View/分镜导演板是否只继承 current Scene Palette 或回退到 Global Project Palette；
- Scene Palette 是否明确继承父色板、保留核心锚点，只改变声明的场景环境/光线颜色；
- 同一 Scene / Color State 的 Shot 是否像同一时间与地点，而不是每镜重置白平衡或套新滤镜；
- Lighting State 的变化是否由画内事件或可解释的光源遮挡/亮灭造成；
- 最终必剪时间线是否有少数可通过调色匹配而不改变叙事光源的偏差。

若画面内容、光源动机和表演正确，仅整体白平衡、曝光、对比或饱和度存在可匹配偏差，走 `post_fix`。若整板已经使用错误 Color State、无来源全局滤镜、肤色或强调色逻辑错误，先修整板目标 Panel，并按 H3 编辑边界重拍独立替换 Shot 或完整 Clip；不能靠后期调色掩盖错误的叙事光源。
