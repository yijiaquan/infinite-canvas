---
name: scene-multiview-consistency
description: Derive a clean stable Location + View from an accepted multi-view scene board or current same-scene reference. Preserve topology, layout, lighting, materials, and prop placement; Visual Skill owns QA and asset adoption.
---

# Scene Multiview Consistency

## Canvas Production Boundary

进入漫剧生产前读取 [Canvas 生产契约](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md)，先调用 `get_canvas_summary` 并核对真实项目/分集/Clip ID 与 revision。创作源文件可以保留；生产交接写入并读回 Canvas 对象，不维护第二份资产或状态台账。

源提示词只保存语义正文和结构化引用/绑定，不手写提供方媒体编号。下文及专业参考中的 `<Picture N>` / `<Video N>` / `<Audio N>` 是编译后格式的审核示例，仅由预览/提交编译器输出；UI 使用缩略图及图片N/视频N/音频N令牌。旧模板的文件路径/current 标记不构成 Canvas 采用记录，采用必须对应真实持久媒体版本与 QA。


Use this skill whenever Visual Skill needs another camera angle or stable viewpoint of one already-established scene. It produces one `scene_view` candidate with a new intended View ID such as `LOC-CELL-VIEW-DOOR-IN`; it does not create character sheets, props, director boards, or a second asset index.

## Required input

- When a current `scene_board` exists, bind it as the full-location geography reference and bind the closest accepted clean Scene Master / View as the local appearance reference. The board controls topology across directions; the clean view controls visible material detail, current light and the nearest known side. Neither may lock the final Shot composition.
- When no scene board exists, bind the current empty-stage `Location + View` or scene master as the real geography reference; never substitute a filename or prose-only description. A character or untracked dramatic action in a master is not a substitute for scene geography.
- Keep the declared geography reference responsible for room volume, wall and ceiling structure, openings, fixed architecture and cross-direction anchor relations. Keep the closest clean Master/View responsible for locally visible prop/furniture placement, current Color/Lighting State, lighting direction, palette, material finish and visual medium. A new View inherits both roles; it does not silently introduce a new color grade, time of day, practical-light state or weather.
- Add character or prop references only when the requested view includes them. Those inputs must not change the scene geography.
- For an axis-sensitive scene, also state the named axis anchors, the intended camera working side, the entrance/landmark that must remain on each viewer-screen side, and the new View's purpose. `门内` / `门外` / `正反打另一侧` are different Views; a prose request for “the other side” is not enough.
- 若当前 Location 已有 Scene Bible，同时读取相关 Anchor ID、按需 Top-Down/Blender 空间关系、Blocking Zone 和目标 `CAM-ZONE-*`。这些信息只约束新 View 的地理合法性；不要求复制旧 Master View 的景别、焦段、机高、构图或人物站位。
- 当前项目选择 Blender 白模预演且该 Shot 已通过时，可将其相机位置/视向、工作侧、画面左右、固定锚点和新 View 目的作为精确的机位目标；其预演视频随后可作为 H3 `<Video N>` 的相机/调度参考，但白模渲染本身不替代真实 `scene_board` / Scene Master / View，也不改变视觉地理参考规则。

## Generation rule

Change only the camera position and viewing direction. Default to a plausible standing human eye height unless the owner specifies another height. Reconstruct only the previously occluded portions that a new camera angle would naturally reveal; they must connect consistently to the visible architecture. Preserve the current Color/Lighting State exactly unless the production breakdown explicitly requests a separate state asset. A new View may change the working side only when the adaptive-panel director-board plan explicitly declares the re-establishing cut or neutral transition; otherwise preserve the current side of the axis.

Follow the [Canvas production contract](../ai-drama-studio-workflow/references/infinite-canvas-production-contract.md): call `get_canvas_summary`, read actual project assets and immutable versions, and use the administrator-configured image channel. Generate each requested angle as a separate canvas candidate, inspect it, and repair only the failed continuity variable. Do not switch providers without authorization.

An accepted new View supports static director-board construction on that camera side. H3 normally receives the current complete scene board as its geography reference; its grid, labels and topology remain reference material, not movie frames. The clean View is not a final Shot composition template: later Panels can vary lens, height, framing, depth and performance inside the established camera area.

## Prompt Handoff

向 Prompt Skill 提供 current `scene_board`（若有）、最接近目标方向的干净 Scene Master / View、指定 Camera Zone/机位/视向和新 View ID，以及必须保持的空间体积、建筑布局、出入口、固定道具、Anchor ID、主光、材质、可见边界和画面媒介。轴线敏感时还提供轴线锚点、工作侧、画面左右锚点与允许的越轴方式。Prompt Skill 按 [location-plate-prompt-method.md](../ai-media-prompt-compiler/references/location-plate-prompt-method.md) 与 [static-image-reference-batch.md](../ai-media-prompt-compiler/references/static-image-reference-batch.md) 生成唯一的静态图语义 brief 与最终图片提示词；本 Skill 不保留另一套可执行提示词模板。

收到最终提示词后，只检查它是否把 `scene_board` 限定为跨方向地理、把干净 Master/View 限定为局部外观与当前 Color/Lighting State、只改变机位/视向、允许合理补足自然被遮挡部分，并禁止增删结构、改变布局、擅自换时间/色调/光源状态、文字、Logo、水印、分镜格或拼贴布局。没有场景板时，当前 Master/View 同时承担两项职责。语义不足时退回 Prompt Skill 修改，不在本 Skill 重写。

## QA

Before accepting a view, compare it with the current scene board when present and the closest clean Master/View: fixed wall/ceiling joints, entrances, rails or other landmarks, prop count and positions, scale, light direction, palette, and material finish must remain continuous. For an axis-sensitive View, also check its declared camera side and screen-side landmark relation. Reject views that merely resemble the style while changing the actual space.

## Handoff

Return the real node/run/storage IDs, intended `Location + View` purpose and semantic View ID to Visual Skill. Visual performs final QA and registers/adopts an immutable version on a separate scene asset, leaving the scene-master ID untouched. Use supported asset kinds and parentId/description for View semantics, not an invented database enum. Candidate history stays in Canvas; this Skill does not silently adopt or update Clip bindings.
