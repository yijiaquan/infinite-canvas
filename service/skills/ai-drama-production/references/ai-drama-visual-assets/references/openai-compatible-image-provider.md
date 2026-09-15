# OpenAI-Compatible Static Image Route

Use this guide for the owner's configured local or purchased third-party OpenAI-compatible image service in ComfyUI.

## Important Distinction

Keep these separate:

- adapter/node: for example OpenAIConcurrentImageBatchGenerate;
- actual provider: the service that receives the request;
- model request ID: for example gpt-image-2.

A node or model name containing OpenAI does not mean the official OpenAI endpoint is being used.

## Default Route

The repository default is the provider already configured by the owner in ComfyUI. When node-level base_url and api_key are blank, use the saved ComfyUI settings. Do not replace them, ask the owner to choose HTTP/HTTPS, or perform official OpenAI account/organization/billing checks.

Current endpoint precedence may be:

1. explicit node base_url;
2. saved ComfyUI Base URL;
3. OPENAI_BASE_URL;
4. code default.

The normal project route should resolve to the owner's saved local or third-party service. Never silently fall back to the official default when the saved route is missing.

Do not write API keys, tokens, or full sensitive endpoints into project files, prompts, workflow JSON, or logs.

## Normal Production

For a working configured route:

1. prepare the image prompt, reference images, size, quality, format, and output folder;
2. submit the image request through the saved `OpenAI兼容_图片生成与编辑_v01` workflow;
3. let the provider adapter handle its own concurrency/queue;
4. inspect the actual returned images;
5. accept or make a targeted repair.

Normal successful production does not need project-level technical reports or a pause before submission.

A business batch may be split mechanically when the node has a job limit. This does not create another owner decision.

## When to Inspect the Route

Inspect endpoint resolution or node fields only when:

- the saved route is missing or unexpectedly changed;
- the node/provider rejects authentication or request fields;
- the selected model/profile is unsupported;
- output format differs from the request;
- a real submission result is unknown;
- the owner deliberately changes provider/model class.

For a missing saved route, stop the affected request before sending it to an unintended official endpoint. Report the simple actionable problem: which configured route is missing or mismatched. Do not turn it into a project-level security approval ceremony.

## Prompt and Reference Inputs

Compile against the actual provider fields. Bind required identity, scene, prop, or source-board images to real supported image inputs. Do not replace them with prose such as “follow the approved board”.

Official model documentation may guide prompt wording, but it does not prove the third-party service's access, pricing, model mapping, or field behavior. When its behavior differs, use the actual configured service.

## Failure and Retry

A confirmed provider-before-submit or terminal failure may be repaired and submitted again within the same creative request. If submission may have occurred but its result is unknown, inspect provider/ComfyUI history and outputs before repeating that exact request.

Keep diagnostic details with the media output; do not create a separate project-level execution process.
