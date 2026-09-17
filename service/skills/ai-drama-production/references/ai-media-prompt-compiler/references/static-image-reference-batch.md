# Ordered Static Image Reference Batch

Use this reference when the OpenAI-compatible static-image route receives one or more real image references. The saved ComfyUI node has one `reference_image` port, but that port accepts an ordered IMAGE batch and uploads every batch item as a separate image. Keep the files separate; never create a collage merely to fit this interface.

## Order and role

Build the batch from continuity-critical inputs only. The final prompt must enumerate the same order and state both the controlled domain and the domain it must not control.

1. `Image 1` is the focus Character + Look when a character is the main subject. It controls face, hair, body proportion, fixed wardrobe and visual identity only.
2. Following images are other visible Character + Look references, one declared subject per image. They control only their own identity and Look.
3. The next image is the current `Location + View`. It controls architecture, topology, openings, landmarks, fixed furniture/prop placement, main light direction, materials and palette only.
4. Remaining images are continuity-critical props. Each controls its shape, material, count, state and ownership only. For a rope, cuff, strap, hose, cable, tether or inserted connector that persists across cuts, declare its carrier, both endpoints, visible path/mechanism and current mode as its controlled state; its prop reference supplies the form/mechanism, while the target keyframe must show the actual in-scene attachment.
5. When `Look route = project_look_board`, append exactly one accepted Palette last. Identity boards and reusable neutral props use the Global Project Palette. A scene master, `Location + View` or complete director board uses its current Scene Palette when one exists; otherwise it uses the Global Project Palette. A Scene Palette already contains inherited global anchors, so never append both parent and child. The selected Palette controls the approved color range, warm/cool balance and accent-color relationship. Medium/render language, skin protection, material response, shadow/highlight treatment and frame density remain explicit text semantics.

An approved Visual Skill example is not a normal project reference. Inspect it outside the request by default. Only after repeated evidence that the static model cannot understand the required board layout may the matching example be appended after every project-content reference and Palette as the final IMAGE. Declare that it controls layout, region proportion, information hierarchy and whitespace only, and cannot control identity, geography, prop design, palette colors, text, story or Shot content. Never register it as a project asset or pass it to H3.

For a scene without a focal character, put the current `Location + View` first. For a prop study, put the target prop first and include character or geography only when the requested view truly needs them. A donor image for camera language may follow only when the selected provider has a verified role-aware field; it never controls identity or geography.

## Production-keyframe exception: geography first

For a production color keyframe in a recurring space, the generic character-first order above is overridden because the location must not be regenerated as a fresh wallpaper:

1. `Image 1` is the current `Location + View`. It controls room topology, openings, fixed architecture, landmarks, fixed furniture/equipment placement, primary light, materials and palette only.
2. If the complete director board must retain already established same-View facts, `Image 2` may be one accepted same-View continuity frame. It controls the visible background, set dressing and fixed anchors. In a multi-character scene, it also preserves the declared zones, facing, density and passageways of every unchanged focus person or `Crowd-*` cluster. It does not freeze any Panel's new action, composition, lens, camera height or performance, and does not replace character identity, Look, prop State or an intentionally new View.
3. Following images are the visible Character + Look references, then the complete `expression` boards required by the target Panels, then only continuity-critical props; when `Look route = project_look_board`, append the current Scene Palette last when one exists for this scene, otherwise append the Global Project Palette. Never append both. Each expression board controls only its declared state IDs and visible face/body reaction language; its grid, labels, text, white background and other states must not appear in the director board.

For an actual new angle, omit the old same-View keyframe and first create or reuse the correct `Location + View`; an old shot frame cannot invent the unseen side of a room. In the brief, state a narrow `allowed change` for any chained keyframe—for example, “only the seated character turns toward the doorway and raises the right hand”—then explicitly preserve the fixed background and light. For a group, the allowed change must name the only actor or `Crowd-*` cluster that moves, enters, exits or reorganizes; all other declared zones remain. This chain is a static-image request input, not a new asset type, an H3 time Picture or an approval step.

When deriving a clean Scene Master / `scene_view` from a current multi-view `scene_board`, put the scene board first as the cross-direction geography source and the closest clean Master/View second as the local material/light source. The output must be one clean standalone view with no board grid, labels, other angles or topology inset. These clean derivatives serve static director-board construction; the complete current `scene_board` remains the normal H3 geography Picture for recurring or multi-direction Locations, with its layout explicitly excluded from final frames.

## Request discipline

- Write `Image N: controls ...; does not control ...` in the semantic brief, then pass the actual images in exactly that order.
- Use accepted current assets, not filenames, prose descriptions or unadopted candidates. A required reference must remain an image input.
- Send only the images needed to preserve this generation. If the selected provider rejects the count, reduce noncritical references first; do not demote an identity, geography or required prop reference to prose. A linked prop that affects action or the next Shot is required, even if a thin line happens to be visible in the keyframe.
- The reference batch is request input, not a new project asset, director board or delivery image. It is never rendered, adopted or shown to the audience.
- For a complete adaptive-panel director board, use the geography-first order above whenever the recurring set matters: current `Location + View`, applicable same-View continuity anchor, visible character identities, applicable complete `expression` boards, then only the props that affect the Clip. The output remains one complete adaptive-layout board generated in one request, not independent stills.
- For the OpenAI-compatible static-image node, set `number_images = 1` for every normal asset or keyframe request. One request, one business object, one candidate image, one dedicated output prefix. A duplicate-looking return is not a second adopted asset and does not itself justify an automatic retry; inspect the executed request and output prefix first. Only a deliberately requested variant set may use more than one image, and each candidate must remain unadopted until directly viewed.
