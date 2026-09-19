# MiniMax H3 Local Production Guide

Use this reference when the selected video engine is the owner's configured local MiniMax H3 workflow. It contains model-specific production facts, not project-control requirements.

## Default

- Use the owner-confirmed local 480p / up-to-15-second route when the current UI workflow still exposes it.
- The current UI workflow determines the actual dimensions, FPS, frame count, model files, nodes and connections for every submission.
- Define editorial Shots from the approved script before grouping them into H3 Clips. A Clip is one non-scene-crossing request up to 15 seconds; it may contain one continuous Shot or a small same-scene sequence with motivated cut points. Do not pad a shorter beat merely to fill 15 seconds. Split another Clip for scene/time changes, complex state handoffs, verified input limits, dialogue/action overload, or real QA evidence.
- Use exactly one H3 mode per Clip and let ComfyUI queue multiple independent requests.

## Modes

| Need | H3 route |
| --- | --- |
| complete variable-panel-board-driven drama with identity/scene/prop/voice references | reference to video (default) |
| a verified repair requiring one exact opening state | first frame to video |
| two intentional endpoint states with one continuous process | first + last frame / FL2VA, explicit test or conditional route |

Reference mode uses one complete 16:9, variable-panel director board as `<Picture 1>` for the actual-duration H3 Clip. It controls planned Shot order, coverage, screen positions, pose/action phases, camera working side, fixed anchors, Look and state handoffs. Then add the complete identity boards of actually visible characters, any required clean single-state expression references for key close-ups, the current complete scene board, and complete prop boards for continuity-critical props that actually appear. Every later Picture declares its control domain and board-layout exclusion. A complete multi-state expression board is upstream-only and must never be connected to H3. A passed same-Clip Blender `*_reference.mp4` controls only camera, blocking, cut timing and motion coverage. Ref2VA normally realizes the planned same-scene Shots in one Clip; FL2VA is a separate endpoint mode and follows its own Base prompt template.

For dialogue, doorway, handoff, reveal, pursuit or group work, also follow [场面调度与 Shot 职责](../../ai-media-prompt-compiler/references/blocking-and-cut-staging.md). Each high-risk Shot declares whether it establishes, completes the one primary change, reacts, inserts a detail or transitions space. H3 must not replay the same door opening, handoff, entrance or reveal in multiple Shots.

After `subject_definitions` maps each source image to reusable visible content, use the same `<Subject N>` for the character, setting, prop or single-state performance throughout `summary`, `retention_analysis` and `detailed_description`. Do not repeat a source `<Picture N>` beside every character or noun: that can turn the source sheet into visible target content. Use `<Picture 1>` only for the complete director-board planning anchor; cite each complete identity, clean single-state expression, scene or prop reference once in its Subject definition, state exactly what it controls, and explicitly exclude white backgrounds, grids, labels, multiple-view layouts and topology diagrams from the target video. Complete expression and Look boards remain upstream-only.

FL2VA is available for explicit tests and conditional endpoint tasks. Select it only when both endpoint frames are purpose-made project states and the prompt can describe one physically plausible process between them. Never select it merely because Ref2VA failed, and never feed a previous generated raw tail forward automatically.

### Production-keyframe and Subject binding

Use [H3 Ref2VA 统一最终提示词模板](h3-ref2va-final-prompt-template.md) rather than maintaining a second binding block here. In short: `<Picture 1>` is the complete variable-panel director-board anchor; later Pictures are the required complete identity boards, key-close-up clean single-state expression references, current complete scene board and actual critical prop boards, each defining a stable `<Subject N>`; the action prose tracks Subject labels. Omit unused later pictures and disconnect unused image slots instead of repeating a reference or attaching unrelated material.

The current Ref2VA UI exposes a wrapped direct task-input surface rather than historical `ref_*` conditioning ports. Keep `picture_1_keyframe` disconnected. The complete director board remains the planning authority but is not uploaded and receives no Picture label. Bind actual image references from the optional slots in this semantic order: actually visible identity boards, key-close-up clean single-state expression references, current complete scene board, critical prop boards, then other necessary references. Do not infer semantic roles from fixed slot names such as `picture_2_identity` or `picture_3_scene`; the current structured binding and compiled order are authoritative. Use at most eight ordinary image references. When capacity is insufficient, preserve visible identity boards and the current scene board; retain an expression reference ahead of secondary props or general references only when it carries key story information. Change only visible media sources and direct fields on the freshly read UI workflow. Fully replace the saved sample prompt with the current Clip's recompiled six-section prompt before submission.

## Execution Source of Truth

Before every H3 submission, reload the current UI JSON for the selected mode and derive the API graph only from that freshly read workflow:

- text to video: `MiniMax-H3_01_文生视频_3070Ti-8GB.json`;
- first + last frame / FL2VA (explicit test or endpoint task): `MiniMax-H3_02_首尾帧生视频_3070Ti-8GB.json`;
- reference to video / Ref2VA: `MiniMax-H3_03_参考生视频_3070Ti-8GB.json`.

Never reconstruct a graph from this guide, a remembered node chain, historical model filenames or a previous API payload.

The current Ref2VA workflow serves no-dialogue, one-speaker and multi-speaker Shots through its direct optional inputs. Leave all `audio_N` slots unused for no dialogue; bind only the actual speaker samples in `audio_1` onward for dialogue, without blank or duplicate audio. `video_N_audio` is reserved for the paired soundtrack of a real reference video and is not a substitute for a character Voice sample. The visible task controls are prompt, duration, megapixels, aspect ratio, seed, Turbo LoRA, LoRA strength, first-stage steps and output prefix. If the current UI workflow cannot be read or converted, diagnose the actual route problem and stop the affected request; do not hand-build a replacement processing graph.

## Frames and Inputs

- Start with only necessary references. The current H3-03 wrapper exposes up to 9 pictures, 3 video-frame inputs with their paired audio inputs, and 3 independent audio inputs; the current UI note records a 12-file mixed-reference ceiling. Treat its freshly read UI and live schema as authoritative for actual limits and media duration rather than this guide.
- Ref2VA starts with one complete variable-panel director board. Add only distinct necessary references, including a planned clean single-state expression child reference for a key close-up or one QA-proven later-Shot composition/state anchor with explicit scope. Never connect the complete expression board. FL2VA instead binds two QA-passed endpoint frames through its current UI workflow. Do not directly upload a previous generated video tail as an automatic endpoint; when continuity repair needs tail evidence, use it only through the image-edit route to repair the affected Panel or create one narrowly scoped clean state image.
- Every connected image must be a distinct necessary asset with one declared role. Reject an exact duplicate file/content hash, a repeated copy under another filename, near-identical time keyframes with no declared beat change, a static-only same-View continuity anchor, an unrelated current/legacy asset, or a prior `SHOT-xxx_FINAL` frame used only to occupy a slot. After connecting the final media set, renumber each media type contiguously and make every Picture/Video/Audio tag match the actual order; no prompt tag may name an absent slot.
- Reference audio cannot be the only reference type; include an image or video.
- Presentation order is images, then each video with its paired soundtrack, then standalone audios.
- Picture, Video, and Audio tags each use their own 1-based numbering.

### Whitebox-video direct input

Use this only after the Blender preview has passed its own Shot QA. Re-read the selected UI workflow and live schema before every submission. Bind its rendered frame sequence through the current workflow's exposed `video_N_frames` input. The whitebox source audio is not a character Voice and therefore leaves that matching `video_N_audio` input unused. Do not reconstruct the retired `LoadVideo → GetVideoComponents → ref_videos.*` chain from this guide: follow the updated UI workflow's existing source branch, if one is needed, and change no hidden wrapper body nodes. Replace the sample's Picture/Audio bindings, prompt and output prefix with this Shot's actual set before conversion/submission.

The current guide records reference video as 2–15 seconds and no more than 15 seconds total per media type. When the editorial use is shorter than the accepted minimum, render the same continuous camera state in a 2-second-or-longer H3/previs container and trim only in Bcut; do not add a second event, Cut or camera behavior to fill time.

Give every reference a clear purpose and non-purpose. Voice reference controls timbre/delivery; it does not replace the exact target Line.

Attach Voice references by exact H3-Shot Speaker, never by visible cast. An on-screen dialogue Line gets only that visible Subject's Voice. Off-screen dialogue or voiceover gets only the actual unseen speaker/narrator Voice, but the audio remains `<Audio N>` and the voice remains `(Sx)`; do not invent a `<Subject N>` for a disembodied voice. Picture, Audio, Subject and Speaker number independently. For `无台词`, attach no character Voice audio and omit Audio / Speaker / dialogue bindings entirely. Ambient sound, Foley and SFX do not require a character Voice reference.

## Official Prompt Format

Use the official MiniMax H3 prompt-writing references:

- https://github.com/MiniMax-AI/MiniMax-H3/tree/main/skills/h3-prompt-writing
- https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/VIDEO_PROMPT_WRITING_GUIDE_base_en.md
- https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/VIDEO_PROMPT_WRITING_GUIDE_ref_en.md

### Base Modes

T2VA uses exactly:

    integrated_multimodal_description: ...

    overall_soundscape: ...

    non_diegetic_music: ...

First-frame, first/last-frame, and last-frame modes add their official alignment syntax before those three sections. Keep those fixed section names and alignment syntax for compatibility, write all descriptive bodies in English, and preserve dialogue, lyrics, and visible on-screen text in their original language; Chinese dialogue uses `<d>[Chinese] ...</d>`. Execute I2VA or L2VA only when the freshly read Canvas UI JSON exposes the required single endpoint.

Set `non_diegetic_music: none` by default. Only include non-diegetic music when the owner explicitly needs it baked into this single video container; normal BGM belongs to a continuous editable Bcut music track.

### Ref2VA

Keep exactly this order:

1. subject_definitions
2. summary
3. retention_analysis
4. detailed_description
5. overall_soundscape
6. non_diegetic_music

Use Picture, Video, Audio and Subject tags consistently. Define reusable visible content as `<Subject N>` from its source board or video; reserve `<Picture 1>` for the complete director board, then use later `<Picture N>` for complete identity, scene and required prop boards plus any QA-proven relationship anchor. The Speaker ID follows target-video speaking order and is not derived from Subject or Audio numbering. Use the official task-type prefix in `summary` and the official relationship markers in `retention_analysis`.

At the start of `detailed_description`, use `[Shot 1]` and establish the Clip from Panel 1 of `<Picture 1>`. Continue through `[Shot N]` with strictly increasing cut times inside the actual Clip duration; each cut realizes the corresponding Panel, adds a real establishment, action, reaction, reverse, insert, reveal or resolve, and preserves the declared state handoff. Split another H3 Clip when scene, geography, time, state, dialogue/action capacity or verified input limits cannot safely remain shared.

When a Blender whitebox `<Video 1>` is connected, declare it in `subject_definitions` and repeat `<Video 1>` where camera path, blocking, cut timing or action timing is directed. Assign camera path, blocking and timing to `<Video 1>` while assigning final identity, Look, scene art, prop form and sound to their declared Picture, Subject and Audio sources. The complete variable-panel director board remains the primary Picture anchor.

For a visible character voice:

    <Audio 1> is the voice-timbre reference for <Subject 3> (S1).

For a genuinely off-screen voice with no visible body or mouth, keep the Speaker and Audio but omit Subject:

    <Audio 2> is the voice-timbre reference for off-screen Speaker (S2).

Use the `reference` retention relation for timbre. Put the new exact line under the correct `<Subject N> (Sx)` inside `<d>[Language] ...</d>` in `detailed_description`. Do not add a separate negative-prompt field, suffix, section, or project-specific word blacklist; keep the official structure and write the descriptive prose in English.

## Performance

Format correctness is not enough. In detailed_description, direct trigger, body preparation, committed action, response, reaction/choice, and changed end state. Put each spoken line inside a meaningful physical task and show a listener or environment response. A static talking pose with lip motion is performance_flat.

Use one motivated camera behavior selected by the Prompt Skill's [镜头语言与运镜选择](../../ai-media-prompt-compiler/references/camera-direction-playbook.md). Preserve its declared purpose, start relation, trigger, path, speed and endpoint when compiling H3 prose; translate direct vocabulary naturally instead of adding a second camera idea. `Dolly Zoom` and complex pass-through paths are conditional techniques, not default H3 capabilities: only use them when their effect is an approved Beat and current model behavior has been verified. Keep identity/geography rules compact so preservation language does not suppress action.

## Native Dialogue and Voice

Create one clean representative sample per recurring Voice. Reuse the same sample for later Shots unless the character voice intentionally changes.

### Voice-reference gating

For every H3 request, first inspect the complete director board, every Panel's screen-space contract and Shot responsibility, and all exact dialogue Lines.

- Pass a character's Voice reference only when that character has an exact spoken Line in the selected H3 Shot.
- Do not pass a recurring character's Voice reference merely because that character appears on screen, listens, is off screen, or will speak in a later Shot.
- For a no-dialogue Shot, leave every direct `audio_N` slot unused and provide no Audio tag, Speaker tag or dialogue binding. Never pass a silence file or an unused character Voice sample.
- For a one-speaker Shot, bind only that exact visible/off-screen speaker to `audio_1`; do not add a blank second audio input or a second audio reference.
- For multiple actual speakers, bind only those speaker samples in `audio_1` onward in speaking order. Do not leave a connected direct audio source blank.
- When more than one role speaks, bind only the actual speakers in speaking order and map each `Audio`, visible `Subject` when one exists, Speaker ID, and exact Line explicitly. An unseen speaker has no Subject mapping.

This prevents unused voice conditioning from causing invented dialogue or wrong-character speech.

For native dialogue:

- use Ref2VA;
- bind the character image/video and matching Voice reference;
- map Audio tag, Subject tag, Speaker ID, and target Line explicitly;
- include dialogue source (on-screen / off-screen / voiceover), exact text, language, pronunciation, natural-performance timing window, and performance;
- if exact accepted dialogue, action and intended pauses do not fit the window, split at a real editorial boundary into more Shots; do not accelerate, shorten or paraphrase the Line silently;
- inspect the returned voice, words, pronunciation, mouth timing, A/V sync, ambience, and action sound.

Do not attach the Voice samples of silent on-screen characters as context. Each attached Voice must have one actual Line and an explicit Speaker mapping in the same H3 Shot; otherwise omit it from the ComfyUI request.

Use [主人提供的官方 Audio / Subject / Speaker 实例](h3-ref2va-audio-mapping-example.md) when compiling dialogue. It demonstrates that multiple real speakers remain supported while Audio never consumes a Subject number.

A playable audio track does not prove these checks passed. If dialogue replacement is needed, preserve or rebuild the source ambience/Foley/SFX rather than muting everything and adding dialogue only.

## Execution

For a working current selected H3 UI workflow:

1. prepare the selected mode, prompt, references, dimensions, frame count, and output folder;
2. submit once to ComfyUI;
3. wait for the queued result;
4. inspect the real playable output;
5. accept or make one diagnosed repair.

Technical request/History details stay in the output folder and remain invisible during normal success. Do not require compile-only, project checkpoints, leases, receipts, or owner approvals as normal production steps.

If submission outcome is genuinely unknown, inspect queue, History, and output before retrying the same request. Other projects' distinct queued work does not block this H3 Shot.

## Media QA

Review at normal speed and intended crop:

- story and approved action;
- identity, wardrobe, count, geography, props and light;
- performance vitality and camera;
- dialogue, voice, sync, ambience, SFX and music policy;
- duration, resolution, FPS, frames, audio stream and playback;
- a clean edit point; when a later angle needs state continuity, determine from actual QA whether a color bridge image is required rather than sending the raw tail to H3.

For a whitebox-reference Shot, also compare the accepted result against the actual preview: camera working side and main path, screen-side anchors, actor/prop blocking, action timing and the declared endpoint must match. Do not require pixel similarity or whitebox visual style.

Inspect frames more closely only when fast action, dialogue, continuity, or a visible artifact requires it.

For adjacent accepted H3 Shots, preview roughly 2–3 seconds across the edit before accepting the latter: compare pose, hands/held props, eyeline, screen direction, active Location + View, light, room tone, dialogue tail and action sound. A mismatch is a production-keyframe/asset continuity repair; repair the keyframe of the latter only if its current assets cannot preserve the necessary state.

Do not silently switch to another model after failure. Repair the diagnosed H3 problem or report the real blocker; a new route is unavailable until the owner explicitly connects and verifies it in ComfyUI.

## Retake Boundary

The saved local H3 workflows are text-to-video, first-frame, first-plus-last-frame and Ref2VA. First-plus-last-frame remains a manual test route only; production uses Ref2VA by default. None of them are interval-edit or pixel-local video editors.

For an H3 defect, keep the same complete director board, identity/scene/prop/Voice references and one diagnosed change variable. If the board itself is wrong, use the original whole board and the same references to repair only the affected Panel, then recheck the other Panels and state handoffs. If the board is correct, generate an independent replacement Shot only when natural cut points make replacement valid; otherwise rerun the complete variable-duration Clip. A required reaction, insert or transition may become a targeted Bcut insert only when it already owns an approved Beat and does not silently replace the original Shot's other obligations. State the required preservation explicitly, then inspect the replacement as a full Shot. Do not claim that a prompt can repair only a timestamp range when the graph has no verified edit route.
