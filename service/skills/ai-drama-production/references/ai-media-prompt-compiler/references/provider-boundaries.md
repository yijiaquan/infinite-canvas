# Provider Compilation Boundaries

## Core rule

Keep the shared semantic brief provider-neutral. Before compiling the final prompt, use the selected model's current format, accepted media roles/order, ratio, duration, resolution, audio behavior, and prompt-polarity mechanism. Reinspect the live node/API schema only when the route changed, a required field is uncertain, or a real execution failed. Upstream official documentation is guidance unless that official endpoint is the selected provider.

## Translation rules

- Preserve the meaning and source bindings; change only encoding and supported parameters.
- Do not copy syntax, tags, timing grammar, negative fields, or camera tokens between providers.
- Keep request parameters outside prose when the provider exposes dedicated fields.
- Stop the affected request on unsupported references; never silently demote an identity, composition, start/end, motion, or audio binding to an untyped image.
- Keep a short note of the selected provider format when the project may resume in another task.
- For a production color keyframe, compare the ordered input list with the required identity, geography, and prop references and verify that each reaches a supported image field. Never replace required images with prose-only instructions.
- For the OpenAI-compatible static-image route, read [static-image-reference-batch.md](static-image-reference-batch.md): `reference_image` accepts an ordered IMAGE batch, not a stitched reference canvas. Preserve its declared order and role boundaries in the actual request.

## Known strategy differences

- Structured image models commonly benefit from labeled sections, explicit reference roles, and separate change/preserve instructions.
- Some diffusion/image providers support native negative fields; some require positive rewriting; others expose provider parameters such as `--no`. Static-image compilation follows the verified selected image provider rather than habit.
- MiniMax H3 uses its official Base or Ref2VA structure. Do not add a separate negative-prompt field, suffix, section, or project-specific word blacklist; keep the official section labels, media tags and timing grammar, while writing descriptive prose in natural Chinese and retaining dialogue, lyrics, and visible text in their original language.
- H3 exact base and Ref2VA section order, media numbering, Voice/Audio/Subject/Speaker/Line mappings, and sound formatting belong to the current MiniMax H3 authority in the video-production Skill.
- Current video production has one provider route: MiniMax H3. Use its official three/six-section grammar. Ref2VA may compile either one continuous Shot or a small same-scene multi-Shot Clip; `[Shot 2]` and later require strictly increasing cut times inside the selected duration. FL2VA is a conditional endpoint test mode using the official alignment line and Base three-section grammar. Do not invent provider tags or timing syntax, and do not use a previous generated raw tail as an automatic endpoint.
- A provider's marketing prompt examples are guidance, not proof of the live local ComfyUI node schema.
- For OpenAI-compatible image nodes, use the owner's configured local or third-party endpoint saved in ComfyUI. A model ID such as gpt-image-2 does not imply the official OpenAI endpoint. Never silently fall back to another provider.

## Exact-provider handoff

The provider-owning compiler must receive:

1. semantic requirements and invariants;
2. ordered typed reference bindings;
3. profile-specific data;
4. requested parameters and verified capability limits;
5. task-specific constraint pairs.

It returns the final provider prompt, ordered inputs, and request parameters to the executing media workflow. Save those details with the generated output when useful for reproduction or repair; they are not a project approval package.
