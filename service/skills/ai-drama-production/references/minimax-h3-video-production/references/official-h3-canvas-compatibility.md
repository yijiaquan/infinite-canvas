# Official H3 and Infinite Canvas Compatibility

## Authority

- Prompt syntax and model semantics: the installed official `h3-prompt-writing` Skill, pinned from MiniMax H3 `main` commit `d21241f0a4b3acbb34c97dae47fa417b7065e438`.
- Executable inputs: the freshly read Infinite Canvas UI JSON and server schema for the selected workflow.
- Production overlay: `ai-media-prompt-compiler` supplies accepted story, board, performance and sound semantics; `minimax-h3-video-production` owns bindings, submission and media QA.

Do not fork the official guide into a competing local grammar. Local templates are Canvas-ready checklists and must yield whenever the current official Skill differs.

## Current Canvas Mapping

| Official task semantic | Current Canvas workflow | Rule |
| --- | --- | --- |
| T2VA | `MiniMax-H3_01` | Use only when no visual reference is required. |
| I2VA | no dedicated workflow name | Use only if the freshly read `01` or `02` UI JSON explicitly exposes one first-frame input; otherwise report unsupported infrastructure. |
| FL2VA | `MiniMax-H3_02` | Bind the independently QA-approved first and last frames through Canvas frame references. |
| L2VA | no dedicated workflow name | Use only if the freshly read UI JSON explicitly exposes one last-frame input; otherwise report unsupported infrastructure. |
| Ref2VA | `MiniMax-H3_03` | Default drama route; bindings remain version-pinned Canvas references and provider labels are compiled only at preview/submission. |

The official five-mode list describes H3 capability. It does not authorize guessed ComfyUI node wiring. A local 480p workflow also does not become official 2K regeneration merely through Prompt text.

## Format Profile

- Official output duration: integer 4–15 seconds. Input reference-video duration limits are validated separately.
- Base descriptive bodies and all six Ref2VA sections are English. Dialogue, lyrics and visible on-screen text keep their source language.
- Ref2VA uses `[Shot 1]` without a timestamp; every later Shot uses one accumulated cut-in timestamp: `[Shot N] At MM:SS.mmm,`.
- A normal utterance stays in one `<d>`. An intentional cross-cut utterance is split only at the cut, with `<scenetrans>` at both connecting edges and an explicit statement that audio continues uninterrupted. `<cutoff>` is reserved for intentional truncation at the video end.
- Use `(S1,S2)` only when those speakers genuinely speak or sing together.
- Off-screen speech uses `says in an off-screen voiceover` and immediately states that the corresponding on-screen character's lips remain completely closed. Prefer an on-screen speaker or a motivated cut whenever the speaker should be visible.

## Canvas Source and Compiled Prompt

Canvas source nodes keep semantic prose plus structured asset bindings. They do not store manually numbered provider tags. Preview/submission compilation assigns `<Picture N>`, `<Video N>` and `<Audio N>` from current ordered bindings, then produces the official English H3 prompt. Submitted run snapshots remain immutable when the source draft changes.
