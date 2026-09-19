---
name: blender-whitebox-previs
description: Create and validate one continuous Blender whitebox previs for an accepted variable-duration Clip and its actual-Shot coverage, including local proxy assets, character blocking, cameras, motion and cut timing. Use whenever the owner selects whitebox previs or directly requests Blender; the passed same-Clip preview becomes H3 Video 1, while this Skill does not generate final art, director boards, LibTV output, or H3 video.
---

# Blender Whitebox Previs

## Canvas Production Boundary

进入漫剧生产前读取 [Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md)，先调用 `get_canvas_summary` 并核对真实项目/分集/Clip ID 与 revision。创作源文件可以保留；生产交接写入并读回 Canvas 对象，不维护第二份资产或状态台账。

源提示词只保存语义正文和结构化引用/绑定，不手写提供方媒体编号。下文及专业参考中的 `<Picture N>` / `<Video N>` / `<Audio N>` 是编译后格式的审核示例，仅由预览/提交编译器输出；UI 使用缩略图及图片N/视频N/音频N令牌。旧模板的文件路径/current 标记不构成 Canvas 采用记录，采用必须对应真实持久媒体版本与 QA。


本 Skill 把已经完成分镜覆盖拆解的 Clip 变成可播放、可检查的 Blender 白模预演，先解决空间、调度、机位、运镜和切点，再交给 Visual 制作正式的完整分镜导演板。

实际创建、修改、保存和渲染 Blender 工程时，同时读取 `../blender-workflow/SKILL.md`，采用其中的本机可执行文件、非破坏性版本保存、可编辑结构和媒体验证方法。本 Skill 始终是漫剧白膜的 Clip/Shot 合同与下游交接权威；通用 Blender Skill 不重写分镜、时长、切点或 Canvas 状态。

主人选择“白模预演”、任务直接要求白模预演，或当前制作拆解已经标明该选项时调用本 Skill。Blender 是当前唯一的白模预演路线；未选择的项目沿用正常的 `Clip/分镜覆盖 → 完整导演板 → H3` 路线。

## Scope and boundaries

- 读取已确认剧本和**现有**制作拆解；不重写故事、不重拆 Beat，也不新建平行 storyboard、资产索引或审批步骤。
- 白模场景只使用足以验证体量、空间拓扑、入口、关键道具占位、人物调度和摄影机的代理资产。它不是最终美术、身份板或可交付成片；通过 QA 的预演视频是可复用的 `previs_video` 任务输入资产。
- 默认将当前目标集/段落中所有已规划的 Shot 预演；主人明确限定范围时只做指定 Shot。不能因省事跳过会影响轴线、交接或重要动作的 Shot。
- 预演渲染、关键帧和相机数据是导演依据；正式完整分镜导演板仍由 Visual 通过 owner-configured ComfyUI 图片路线生成，并始终是 H3 的 Shot 规划与最终美术基线，但在 Ref2VA 中不占图片槽、不接入 `picture_1_keyframe`。
- 选择 Blender 白模预演后，每个通过 QA 的同 Clip 预演视频作为 H3 的默认 `<Video 1>` 参考，实际接入 `video_1_frames`。它以一条连续时间线传递实际镜头覆盖的相机路径、工作侧、空间拓扑、人物/道具调度、动作节拍与切点；不控制身份、Look、材质、色彩、最终场景美术、关键道具形制、Voice 或声音，这些仍由 `<Picture 1>`、身份/场景/道具图片和实际 Voice 分别负责。白模不使用配对 `video_1_audio`。一个白模视频只对应一个同场、连续时间的 Clip，不跨场；各 Shot 通过 timeline marker、相机切换与状态交接存在于同一预演中，而不是拆成多条视频。具体输入适配读取 [H3 白模视频参考输入](../minimax-h3-video-production/references/whitebox-video-reference-input.md)。当前 UI 无法验证 `video_1_frames` 时，将此作为白模 → H3 路线的真实阻塞，不静默删掉视频参考。不把白模帧、上一 H3 成片尾帧或无职责的视频当作额外 H3 Picture/Video 输入。
- LibTV 可作为已验证的预演导入目的地；其 CLI/插件不承担 Blender 场景、骨骼、相机或时间轴控制。不要假定单镜导入已经证明整集多机位导入。

## Blender executable resolution

在创建或渲染预演前，先解析本机 Blender 的**完整可执行路径**：

```powershell
$blender = python -X utf8 'D:\work\剪映\.agents\skills\blender-whitebox-previs\scripts\resolve_blender.py'
& $blender --version
```

- 解析顺序是：本次进程的可选 `BLENDER_EXECUTABLE` 覆盖值 → 当前 `PATH` 中的 `blender` → Windows 已安装程序注册表 → 常见本机安装目录。
- 找到后，所有调用都使用 `$blender` 的完整路径，例如 `& $blender --background <file.blend> --python <script.py>`；不要假定裸 `blender` 命令存在。
- 不修改全局或用户级 `PATH`，不写系统环境变量，也不把某台机器的安装目录硬编码进项目预演脚本。
- 若 `BLENDER_EXECUTABLE` 已设置但无效，或所有解析方式都找不到可执行文件，停止白模预演并报告真实阻塞；不要以静态图、拼贴或伪渲染代替。

## Local whitebox resource selection

每个预演 Clip 都先读取 [本机白膜资源映射](references/local-whitebox-resource-map.md)，从已验证的角色、姿势、动作、空间模块和道具中选择最小充分集合，并将一行 `白模资源` 写进既有 Clip/Shot 交接。它规定了源库、追加方式、动作/路径的职责，以及 CMU、未验证 Quaternius 动作等明确排除项。

## Image-guided scene blocking

已有 current 场景主图或 `Location + View` 时，默认以它引导白模空间与第一台虚拟相机；读取 [场景图引导白模重建](references/image-guided-scene-blocking.md)。单图只建立其摄影机一侧的可拍摄空间，反打、门内/门外或新露出空间必须使用对应的已采用 View，不凭文字补造另一侧。

## Workflow

1. 从当前制作拆解取得 Shot、时长、起止状态、空间合同、Camera Area、人物/道具关系、动作阶段、身体表演、动作节拍和摄影/声音落点。主人选择本模式后，在同一份拆解的“可选 Blender 白模预演 → Shot 交接”段填写最小可执行信息；同场多镜还读取既有的 Camera / Body / Information 变化、覆盖变化、切点理由和末态 → 下一开场。字段定义见 [白模预演合同](references/previs-contract.md)。
2. 先按上节解析 `$blender`，再在 `项目/<story>/预演/<episode>/` 建立可复现的项目预演源：项目专用 Blender Python 生成脚本、`.blend`、每 Shot 预演媒体和派生相机合同。所有 Blender 调用均以 `$blender` 的完整路径执行。先检查已有文件；不覆盖主人手工调整过的 `.blend` 或无关项目输出。
3. 若已有 current 场景主图或 `Location + View`，先按场景图引导建立入口、固定锚点、可走区域、遮挡和第一台匹配相机；若 Scene Bible 已提供 Top-Down 空间关系、Anchor ID、Action Axis、Blocking Zone 或 Camera Zone，则在同一共享 `.blend` 中直接复用这些稳定关系，不另建平行地图或 Coverage Board。再以制作拆解声明的空间需求、关键道具和人物画面关系补齐白模拓扑。按资源映射把角色、场景和道具追加为项目副本；角色代理必须有稳定 ID。三人以上、围堵或群像时，具名角色逐一放置到命名锚点，匿名人员可用简单代理集合但必须标成稳定的 `Crowd-A` 等簇，并保留人数、区域、整体朝向、密度和通道；保护、施压、观察、阻挡、护送或控制入口/证据/设备等功能关系还必须落实为实际距离、朝向、视线、遮挡与可通行路径。除了当前 Shot 明确允许的对象，不能在相邻镜头之间静默重排或改变空间权限。只实现当前 Shot 实际要看的位移、转向、接触、反应和动作节拍，不为最终服装或表情建模。
4. 对每个 Shot 在指定 Camera Zone（现有 Camera Area 字段）内设置一条真实摄影机：精确位置、景别、机高/角度、焦距或 FOV、工作侧、前景/主体/后景、起点、唯一主要运动、落点和帧范围。Camera Zone 只限制合法区域与观看方向，不能把某个 Master View 的相机复制成所有 Shot。同一 Location + View 不得默认复用同一相机高度、距离和构图；相邻 Shot 除非明确采用固定覆盖，Camera / Body / Information 通常至少两项发生可读变化。默认采用项目 FPS；未指定时用 24fps。把 Shot ID 写入 timeline marker、相机/目标和输出名，避免混淆不同镜头。
5. 渲染并直接检查真实预演输出。逐 Shot 核对起/中/止帧的 Camera Area、景别/焦段/机高/角度、前景/主体/后景、构图、画面左右、轴线、入口和地标、人物/道具归属、身体重心/躯干/肩膀/四肢的动作是否发生、动作中间态是否可读、镜头是否完成预定路径以及相邻 Shot 的状态交接；多人场面还核对具名角色与 `Crowd-*` 簇的区域、朝向、人数/密度、通道和功能性空间权限只按已声明变化。跨镜绳索、手铐、背带、软管、线缆、牵引物或插入式连接件还核对归属者、两端、路径/余量和模式。每个直接切点还要证明新的景别/观察侧/人物关系至少有一项可读变化，并核对人物相对锚点、行动阶段、朝向和道具归属能从上一末态抵达下一开场。只返修失败 Shot 的场景、调度、动作或摄影机变量。
6. 向下游交接已通过的同 Clip 白模合同：实际各 Shot 的 Camera Area、相机/镜头参数、前景/主体/后景、切点、人物位置/朝向/视线、身体姿态/重心、头肩手腿躯干、动作阶段、固定锚点、各 Shot 编辑时长、Clip 总时长与预演输出路径。Visual 将其转换为完整分镜导演板；Prompt 将其转换为 provider-neutral 摄影与调度语义，并明确 `<Video 1>` 只控制的范围；Video 保持完整导演板为规划权威但不作为 Ref2VA Picture，并按 [H3 白模视频参考输入](../minimax-h3-video-production/references/whitebox-video-reference-input.md) 把该 `previs_video` 接入当前 UI 的 `video_1_frames`。

## QA and repair

- `Blender exited successfully`、存在 `.blend`、存在渲染文件或 LibTV 导入成功均不足以代表通过；必须检查实际预演画面及其 Shot 映射。
- 场景图引导的首个建立镜还要对照真实场景图检查入口/锚点相对位置、可走区域、主要遮挡、画面左右、主光和相机工作侧；不一致时先修空间或相机，不把错误留给人物动作或 H3。
- 用作 H3 视频参考前确认 MP4 可解码、画幅/FPS 和当前 Clip 时长一致；它可以包含该 Clip 实际 N 个镜头的已规划切换、相机路径和连续调度，不是只能含一个镜头。没有 UI/标签/拼贴或无动机跨场跳切，且真实绑定 `video_N_frames`。参考长度按已验证范围处理，短镜头必要余量不得添加新剧情。
- 发生空间、轴线、遮挡、镜头、时长或动作错误时，先修对应白模 Shot 再重新渲染。不要把本应由预演解决的问题留给 H3 随机调度。
- 连续 Shot 若只是复用同一高度、距离、方向、人物站姿和构图，且没有明确固定覆盖理由，先回到相机/调度设计；空间一致不等于摄影机和身体不动。
- 白模已通过而正式分镜导演板仍漂移时，先修 Visual/Prompt 的相机合同、目标 Panel 或场景参考；只有整板正确而 H3 未完成对应表演时才走 H3 retake。
- 预演不提供幻灯片、静态推拉或板面动画替代。需要的是真实 Blender 场景、演员代理、关键帧与摄影机渲染。

## Handoff

交给 Visual、Prompt 和 Video 的是同一 Clip 的已通过合同与 `previs_video`，不是第二份剧情真源。维持“Clip/分镜覆盖 → 完整导演板规划语义 + 白模 `<Video 1>` → H3”一对一关系：整板负责正式画面与 Shot 顺序但不进入 Ref2VA 图片槽，预演视频负责同一 Clip 的空间、调度、运镜与切点。
