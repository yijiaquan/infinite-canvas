import { nanoid } from "nanoid";

import type { CanvasAgentPhase } from "../types";

export const CANVAS_AGENT_ACTION_NAMES = [
    "get_drama_project", "get_drama_episode", "get_drama_clips", "get_drama_assets",
    "update_drama_project", "update_drama_episode", "create_drama_clip", "update_drama_clip",
    "reorder_drama_clips", "archive_drama_clip", "restore_drama_clip",
    "create_drama_asset", "update_drama_asset", "generate_drama_asset_candidate", "register_drama_asset_version",
    "get_drama_binding", "update_drama_binding", "prepare_drama_clip_nodes", "repair_drama_clip_group_layout", "update_drama_generation_node",
    "get_drama_runs", "preview_drama_run", "enqueue_drama_run", "cancel_drama_run", "recheck_drama_run",
    "get_drama_adoptions", "adopt_drama_output", "export_drama_episode",
    "get_canvas_summary",
    "get_selected_nodes",
    "query_canvas_nodes",
    "get_node",
    "get_media_content",
    "get_upstream_nodes",
    "get_downstream_nodes",
    "get_connected_nodes",
    "get_generation_config",
    "get_generation_task",
    "read_skill_file",
    "set_agent_state",
    "create_primary_script_node",
    "create_text_node",
    "update_text_node",
    "update_node",
    "delete_node",
    "create_connection",
    "delete_connection",
    "create_group",
    "arrange_nodes",
    "generate_image",
    "edit_image",
    "upscale_image",
    "generate_video",
    "upscale_video",
    "generate_audio",
    "get_media_task_status",
] as const;

export type CanvasAgentActionName = (typeof CANVAS_AGENT_ACTION_NAMES)[number];

export type CanvasAgentAction = {
    id: string;
    name: CanvasAgentActionName;
    arguments: Record<string, unknown>;
};

export type CanvasAgentToolResult = {
    ok: boolean;
    code?: string;
    message?: string;
    [key: string]: unknown;
};

export type CanvasAgentToolDefinition = {
    type: "function";
    function: {
        name: CanvasAgentActionName;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, unknown>;
            required?: string[];
            additionalProperties: false;
        };
    };
};

export type ParsedCanvasAgentJson = {
    parsed: boolean;
    actions: CanvasAgentAction[];
    reply: string;
    error?: string;
};

const STRING = { type: "string" };
const STRING_ARRAY = { type: "array", items: { type: "string" }, maxItems: 50 };
const PHASES: CanvasAgentPhase[] = ["intake", "concept", "script", "breakdown", "references", "storyboard", "video", "audio", "review", "complete"];
const NODE_TYPES = ["image", "panorama", "text", "config", "video", "audio", "director", "group"];
const ACTION_NAME_SET = new Set<string>(CANVAS_AGENT_ACTION_NAMES);
const DRAMA_REVISION = { type: "integer", minimum: 1 };
const DRAMA_INITIAL_REVISION = { type: "integer", minimum: 0 };
const DRAMA_STAGE = { type: "string", enum: ["storyboard", "video"] };
const DRAMA_ASSET_KIND = { type: "string", enum: ["character", "scene", "prop", "voice", "reference"] };
const DRAMA_BINDING_ROLE = { type: "string", enum: ["character", "scene", "prop", "reference", "voice", "video_reference"] };
const DRAMA_PARAMETERS = {
    type: "object",
    properties: {
        steps: { type: "integer", minimum: 1, maximum: 1000 },
        seed: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
        seconds: { type: "number", exclusiveMinimum: 0, maximum: Number.MAX_SAFE_INTEGER },
        size: { type: "string", maxLength: 100 },
        resolution_name: { type: "string", enum: ["480p", "720p", "1080p"] },
    },
    additionalProperties: false,
};
const DRAMA_GENERATION_DEFAULTS = { type: "object", properties: { image: DRAMA_PARAMETERS, video: DRAMA_PARAMETERS }, additionalProperties: false };
const DRAMA_BINDING_REFERENCES = {
    type: "array",
    maxItems: 16,
    description: "完整绑定列表。order 必须从 0 开始连续；角色名、场景名、道具名和 Look 名由 assetId/versionId 表达，不得写入 role。故事板仅使用 character、scene、prop、reference。",
    items: {
        type: "object",
        properties: {
            assetId: STRING,
            versionId: STRING,
            role: DRAMA_BINDING_ROLE,
            order: { type: "integer", minimum: 0 },
            speaker: { type: "string", description: "仅 role=voice 时填写当前 Clip 的实际说话者；其他职责必须为空字符串。" },
        },
        required: ["assetId", "versionId", "role", "order", "speaker"],
        additionalProperties: false,
    },
};
const DRAMA_SHOT_PROPERTIES = {
    id: STRING, title: STRING, duration: { type: "number", exclusiveMinimum: 0 }, action: STRING,
    dialogue: STRING, speaker: STRING, camera: STRING, sound: STRING, entryState: STRING, exitState: STRING,
};
const DRAMA_CLIP_PROPERTIES = {
    title: STRING, scene: STRING, summary: STRING, entryState: STRING, exitState: STRING,
    shots: { type: "array", maxItems: 200, items: { type: "object", properties: DRAMA_SHOT_PROPERTIES, required: Object.keys(DRAMA_SHOT_PROPERTIES), additionalProperties: false } },
};

function defineTool(name: CanvasAgentActionName, description: string, properties: Record<string, unknown> = {}, required?: string[]): CanvasAgentToolDefinition {
    return {
        type: "function",
        function: {
            name,
            description,
            parameters: {
                type: "object",
                properties,
                required,
                additionalProperties: false,
            },
        },
    };
}

export const CANVAS_AGENT_SKILL_FILE_TOOL = defineTool("read_skill_file", "按相对路径读取当前激活系统 Skill 的附属 Markdown 或文本文件。仅当 SKILL.md 明确引用附属文件时使用。", { skillId: STRING, path: STRING }, ["skillId", "path"]);

export const CANVAS_AGENT_TOOLS: CanvasAgentToolDefinition[] = [
    defineTool("get_drama_project", "读取当前正式集画布所属项目与分集，含来源正文、改编蓝图、风格和版本。"),
    defineTool("get_drama_episode", "读取当前集的正式剧本与版本。"),
    defineTool("get_drama_clips", "读取当前集所有 Clip、镜头、顺序与版本，包括回收站。"),
    defineTool("get_drama_assets", "读取当前剧集项目的共享资产与固定版本。"),
    defineTool("update_drama_project", "按已读取版本局部更新当前项目正文与公开图片/视频默认参数，不自动改编或生成。", { expectedRevision: DRAMA_REVISION, title: STRING, sourceType: { type: "string", enum: ["novel", "script"] }, sourceText: STRING, adaptation: STRING, globalStyle: STRING, generationDefaults: DRAMA_GENERATION_DEFAULTS }, ["expectedRevision"]),
    defineTool("update_drama_episode", "按已读取版本局部更新当前集正式剧本，不创建另一份剧本节点。", { expectedRevision: DRAMA_REVISION, title: STRING, script: STRING }, ["expectedRevision"]),
    defineTool("create_drama_clip", "在当前集创建一个 Clip 与实际 Shot，不创建画布节点、不提交媒体生成。每个 Shot 使用独立稳定 ID。", DRAMA_CLIP_PROPERTIES, ["title"]),
    defineTool("update_drama_clip", "按已读取版本局部更新当前集 Clip，保留未指定字段；shots 为完整替换，保留原 Shot ID。不能修改归属、排序或回收站。", { clipId: STRING, expectedRevision: DRAMA_REVISION, ...DRAMA_CLIP_PROPERTIES }, ["clipId", "expectedRevision"]),
    defineTool("reorder_drama_clips", "按完整 Clip ID 顺序重排当前集制作中 Clip；服务端逐项校验当前版本。", { clipIds: STRING_ARRAY }, ["clipIds"]),
    defineTool("archive_drama_clip", "按版本把当前集 Clip 移入回收站。", { clipId: STRING, expectedRevision: DRAMA_REVISION }, ["clipId", "expectedRevision"]),
    defineTool("restore_drama_clip", "按版本从回收站恢复当前集 Clip。", { clipId: STRING, expectedRevision: DRAMA_REVISION }, ["clipId", "expectedRevision"]),
    defineTool("create_drama_asset", "创建当前漫剧项目的共享资产定义，不生成媒体。", { title: STRING, kind: DRAMA_ASSET_KIND, parentId: STRING, description: STRING }, ["title", "kind"]),
    defineTool("update_drama_asset", "按版本局部更新当前项目资产定义或采用版本。", { assetId: STRING, expectedRevision: DRAMA_REVISION, title: STRING, parentId: STRING, description: STRING, adoptedVersionId: STRING, defaultVoiceVersionId: STRING, archived: { type: "boolean" } }, ["assetId", "expectedRevision"]),
    defineTool("generate_drama_asset_candidate", "为当前项目资产创建候选媒体节点；按 Agent 自动生成设置决定是否提交，节点会保留资产归属。", { assetId: STRING, kind: { type: "string", enum: ["image", "audio"] }, prompt: STRING, title: STRING, sourceNodeIds: STRING_ARRAY, voice: STRING, instructions: STRING }, ["assetId", "kind", "prompt", "sourceNodeIds"]),
    defineTool("register_drama_asset_version", "把当前画布真实且已保存的媒体节点登记为资产版本；不能传 storageId 或路径。", { assetId: STRING, nodeId: STRING, note: STRING, expectedRevision: DRAMA_REVISION }, ["assetId", "nodeId", "expectedRevision"]),
    defineTool("get_drama_binding", "读取当前 Clip 指定阶段的版本化资产绑定。", { clipId: STRING, stage: DRAMA_STAGE }, ["clipId", "stage"]),
    defineTool("update_drama_binding", "按版本完整替换当前 Clip 指定阶段绑定，并同步共享参考节点与连线。首次创建绑定使用 expectedRevision=0。role 只能表示素材用途，不能写 character_identity、scene_geography、style、project_look 等自定义名称。", { clipId: STRING, stage: DRAMA_STAGE, expectedRevision: DRAMA_INITIAL_REVISION, references: DRAMA_BINDING_REFERENCES }, ["clipId", "stage", "expectedRevision", "references"]),
    defineTool("prepare_drama_clip_nodes", "幂等准备或安全修复指定 Clip 的分组、故事板、视频节点和标准连线，不移动已有内容。", { clipIds: STRING_ARRAY }, ["clipIds"]),
    defineTool("repair_drama_clip_group_layout", "仅恢复明确 Clip 组的可见边界：不移动节点、不改提示词、参数、素材、绑定或连线；会将遗留参考节点移出分组成员关系。", { clipIds: STRING_ARRAY }, ["clipIds"]),
    defineTool("update_drama_generation_node", "只更新当前 Clip 的故事板或视频节点源提示词与公开参数，并保存正式画布。源提示词使用图片N、视频N、音频N画布令牌，禁止写入仅供预览/提交快照使用的<Picture N>/<Video N>/<Audio N>提供方标签。", { clipId: STRING, nodeId: STRING, stage: DRAMA_STAGE, prompt: STRING, parameters: DRAMA_PARAMETERS }, ["clipId", "nodeId", "stage", "prompt"]),
    defineTool("get_drama_runs", "读取当前集运行记录，可按 Clip 过滤。", { clipId: STRING }),
    defineTool("preview_drama_run", "按当前节点、绑定和项目默认参数构建不可变输入快照并预估消耗。", { clipId: STRING, nodeId: STRING, requestId: STRING }, ["clipId", "nodeId"]),
    defineTool("enqueue_drama_run", "按当前节点、绑定和项目默认参数构建输入；仅在 Agent 自动生成已启用时入队。", { clipId: STRING, nodeId: STRING, requestId: STRING }, ["clipId", "nodeId", "requestId"]),
    defineTool("cancel_drama_run", "取消当前 Clip 的运行；退款规则由服务端按任务是否开始执行。", { clipId: STRING, runId: STRING }, ["clipId", "runId"]),
    defineTool("recheck_drama_run", "重新核实当前 Clip 的未知或执行中运行状态，不重复提交。", { clipId: STRING, runId: STRING }, ["clipId", "runId"]),
    defineTool("get_drama_adoptions", "读取当前集采用结果，可按 Clip 过滤。", { clipId: STRING }),
    defineTool("adopt_drama_output", "从已完成运行的真实输出序号采用结果，不接受任意 storageId。", { clipId: STRING, runId: STRING, outputIndex: { type: "integer", minimum: 0 }, expectedRevision: { type: "integer", minimum: 0 }, clipRevision: DRAMA_REVISION }, ["clipId", "runId", "outputIndex", "expectedRevision", "clipRevision"]),
    defineTool("export_drama_episode", "导出当前集按 Clip 顺序采用的视频与 manifest；partial=false 时缺片即拒绝。", { partial: { type: "boolean" } }),
    defineTool("get_canvas_summary", "读取当前画布摘要、节点、连线、模型配置和任务状态。"),
    defineTool("get_media_content", "读取当前画布一个已完成媒体节点的真实内容。图片和音频直接返回；视频在大小允许时内联，否则返回已验证资源链接。", { nodeId: STRING }, ["nodeId"]),
    defineTool("get_selected_nodes", "读取用户当前选中的真实画布节点。"),
    defineTool("query_canvas_nodes", "当默认上下文中没有目标节点 ID 时，按 ID、关键词或类型只读查询画布节点；找到 ID 后再用 get_node 读取详情。", {
        nodeId: STRING,
        keyword: STRING,
        type: { type: "string", enum: NODE_TYPES },
        page: { type: "integer", minimum: 1 },
        pageSize: { type: "integer", minimum: 1, maximum: 50 },
    }),
    defineTool("get_node", "按真实节点 ID 读取节点。", { nodeId: STRING }, ["nodeId"]),
    defineTool("get_upstream_nodes", "读取指定节点的所有直接上游节点。", { nodeId: STRING }, ["nodeId"]),
    defineTool("get_downstream_nodes", "读取指定节点的所有直接下游节点。", { nodeId: STRING }, ["nodeId"]),
    defineTool("get_connected_nodes", "读取指定节点直接连接的上下游节点。", { nodeId: STRING }, ["nodeId"]),
    defineTool("get_generation_config", "读取全局模型和渠道，以及当前画布 Agent 独立保存的图片质量、图片尺寸、视频清晰度、视频尺寸、时长和声音配置。"),
    defineTool("get_generation_task", "读取指定媒体节点的真实生成任务状态。", { nodeId: STRING }, ["nodeId"]),
    defineTool(
        "set_agent_state",
        "保存当前创作阶段、已确认方案和正式参考，供刷新后继续。",
        {
            phase: { type: "string", enum: PHASES },
            brief: STRING,
            targetDurationSeconds: { type: "number", minimum: 1 },
            approvedPlan: STRING,
            approvedNodeIds: STRING_ARRAY,
            referenceNodeIds: STRING_ARRAY,
        },
        ["phase"],
    ),
    defineTool(
        "create_primary_script_node",
        "仅用于新创作流程首次创建正式主剧本或总制作稿，固定使用主剧本节点尺寸。",
        { title: STRING, content: STRING, sourceNodeIds: STRING_ARRAY, projectTitle: STRING },
        ["title", "content", "projectTitle"],
    ),
    defineTool(
        "create_text_node",
        "创建镜头、角色、产品、场景、声音说明和其他普通文本节点；不得用于首次正式主剧本。",
        { title: STRING, content: STRING, sourceNodeIds: STRING_ARRAY },
        ["title", "content"],
    ),
    defineTool("update_text_node", "更新现有文本节点的标题或正文。", { nodeId: STRING, title: STRING, content: STRING }, ["nodeId"]),
    defineTool("update_node", "只更新现有节点标题；不允许任意字段覆盖。", { nodeId: STRING, title: STRING }, ["nodeId", "title"]),
    defineTool("delete_node", "使用画布现有删除链路删除节点及关联连线。", { nodeId: STRING }, ["nodeId"]),
    defineTool("create_connection", "在两个真实节点之间创建来源连线。", { fromNodeId: STRING, toNodeId: STRING }, ["fromNodeId", "toNodeId"]),
    defineTool("delete_connection", "删除指定真实连线。", { connectionId: STRING }, ["connectionId"]),
    defineTool("create_group", "把两个或更多节点放进本项目 group 节点。", { title: STRING, nodeIds: STRING_ARRAY }, ["nodeIds"]),
    defineTool("arrange_nodes", "整理指定节点；不传 nodeIds 时整理当前画布顶层节点。", { nodeIds: STRING_ARRAY }),
    defineTool(
        "generate_image",
        "创建图片节点和来源连线，并按 Agent 自动生成设置决定是否提交现有图片任务链路。sourceNodeIds 只放真实直接来源，独立生成必须传空数组；其中图片按数组顺序编号为图片1、图片2。",
        {
            prompt: STRING,
            title: STRING,
            sourceNodeIds: STRING_ARRAY,
            size: STRING,
            count: { type: "integer", minimum: 1, maximum: 15 },
        },
        ["prompt", "sourceNodeIds"],
    ),
    defineTool(
        "edit_image",
        "创建图片编辑节点和来源连线，并按 Agent 自动生成设置决定是否提交现有图片编辑链路；必须提供至少一个真实图片来源节点，图片按 sourceNodeIds 顺序编号。",
        { prompt: STRING, title: STRING, sourceNodeIds: STRING_ARRAY, size: STRING, count: { type: "integer", minimum: 1, maximum: 15 } },
        ["prompt", "sourceNodeIds"],
    ),
    defineTool(
        "upscale_image",
        "对一个已有内容的真实图片节点进行高清修复与超分，创建专用高清处理节点和来源连线，并按 Agent 自动生成设置决定是否提交。默认使用 VOSR 2.0，保留原图。",
        {
            sourceNodeId: STRING,
            resolution: { type: "string", enum: ["2k", "4k"], description: "保持原始比例的目标长边档位，默认 2k。" },
            model: { type: "string", enum: ["vosr2", "seedvr2"], description: "高清模型，默认 vosr2。" },
            title: STRING,
        },
        ["sourceNodeId"],
    ),
    defineTool(
        "generate_video",
        "创建视频节点和来源连线，并按 Agent 自动生成设置决定是否提交现有视频任务链路。sourceNodeIds 只放真实直接来源，独立生成必须传空数组；其中图片、视频、音频分别按各自顺序编号。",
        {
            prompt: { type: "string", description: "完整视频提示词，可包含多个内部镜头。有已确认定稿且用户未要求修改时，直接完整填入定稿，不得摘要、删减或另写一版；保留镜头顺序、时间区间、对白/旁白全文和资产引用说明。各镜头时长之和须等于本次视频总时长；不能将各镜统一改成默认 videoSeconds，也不因有分镜就强制拆成多个生成任务。" },
            model: { type: "string", description: "当前视频模型名称，仅用于标注；实际使用前端配置的模型，不覆盖配置。" },
            title: STRING,
            sourceNodeIds: STRING_ARRAY,
            size: STRING,
            seconds: { type: "integer", minimum: -1, maximum: 30, description: "本次视频任务的总时长（秒），不是每个内部镜头的时长。按 videoDuration 的合法范围或离散值填写已确认时长；仅省略时使用当前 videoSeconds 默认值，不得把默认值当成上限。-1 仅用于支持智能时长的模型。" },
            generateAudio: { type: "boolean" },
        },
        ["prompt", "sourceNodeIds"],
    ),
    defineTool(
        "upscale_video",
        "对一个已有内容的真实视频节点进行高清修复与超分，创建专用高清处理节点和来源连线，并按 Agent 自动生成设置决定是否提交。使用 SeedVR2，保留原视频。",
        {
            sourceNodeId: STRING,
            resolution: { type: "string", enum: ["720p", "1080p", "2k"], description: "保持原始比例的目标长边档位，默认 1080p。" },
            title: STRING,
        },
        ["sourceNodeId"],
    ),
    defineTool(
        "generate_audio",
        "创建音频节点和来源连线，并按 Agent 自动生成设置决定是否提交现有音频任务链路。prompt 是实际朗读文本，instructions 是音色/演绎说明；sourceNodeIds 只放真实直接来源，独立生成必须传空数组。",
        { prompt: STRING, title: STRING, sourceNodeIds: STRING_ARRAY, voice: STRING, instructions: STRING },
        ["prompt", "sourceNodeIds"],
    ),
    defineTool("get_media_task_status", "读取图片、视频或音频节点的生成状态。", { nodeId: STRING }, ["nodeId"]),
];

export function normalizeCanvasAgentAction(name: unknown, args: unknown, id = nanoid()): CanvasAgentAction {
    if (typeof name !== "string" || !ACTION_NAME_SET.has(name)) throw new Error("模型返回了不允许的工具");
    if (args !== undefined && !isRecord(args)) throw new Error(name + " 的 arguments 必须是对象");
    const input = isRecord(args) ? args : {};
    const definition = canvasAgentToolDefinition(name);
    const { properties, required = [] } = definition.function.parameters;
    const unknownKeys = Object.keys(input).filter((key) => !Object.prototype.hasOwnProperty.call(properties, key));
    if (unknownKeys.length) throw new Error(name + " 不支持参数：" + unknownKeys.join("、"));
    const missingKeys = required.filter((key) => input[key] === undefined);
    if (missingKeys.length) throw new Error(name + " 的 arguments 缺少必填参数：" + missingKeys.join("、"));
    const actionName = name as CanvasAgentActionName;
    let normalized: Record<string, unknown> = {};

    switch (actionName) {
        case "get_drama_project":
        case "get_drama_episode":
        case "get_drama_clips":
        case "get_drama_assets":
            break;
        case "update_drama_project":
        case "update_drama_episode":
        case "create_drama_clip":
        case "update_drama_clip": {
            normalized = { ...input };
            if (actionName !== "create_drama_clip") normalized.expectedRevision = boundedInteger(input.expectedRevision, 1, Number.MAX_SAFE_INTEGER);
            if (actionName === "update_drama_clip") normalized.clipId = requiredString(input.clipId, "clipId");
            for (const [key, value] of Object.entries(input)) {
                if (key === "shots" || key === "expectedRevision" || key === "generationDefaults") continue;
                if (typeof value !== "string") throw new Error(key + " 必须是字符串");
            }
            if (input.generationDefaults !== undefined) normalized.generationDefaults = normalizeDramaGenerationDefaults(input.generationDefaults);
            if (input.title !== undefined && !(input.title as string).trim()) throw new Error("标题不能为空");
            if (input.sourceType !== undefined && input.sourceType !== "novel" && input.sourceType !== "script") throw new Error("来源类型无效");
            if (input.shots !== undefined) {
                if (!Array.isArray(input.shots) || input.shots.length > 200) throw new Error("shots 必须是最多200项的数组");
                const ids = new Set<string>();
                for (const shot of input.shots) {
                    if (!isRecord(shot) || Object.keys(shot).some((key) => !(key in DRAMA_SHOT_PROPERTIES))) throw new Error("镜头字段无效");
                    for (const key of Object.keys(DRAMA_SHOT_PROPERTIES).filter((key) => key !== "duration")) if (typeof shot[key] !== "string") throw new Error("镜头缺少文本字段 " + key);
                    if (typeof shot.duration !== "number" || !Number.isFinite(shot.duration) || shot.duration <= 0) throw new Error("镜头时长必须大于零");
                    const id = requiredString(shot.id, "Shot ID");
                    if (id !== shot.id || ids.has(id) || new TextEncoder().encode(id).length > 64) throw new Error("Shot ID 无效或重复");
                    ids.add(id);
                }
            }
            if (actionName !== "create_drama_clip" && !Object.keys(input).some((key) => key !== "clipId" && key !== "expectedRevision")) throw new Error("缺少待更新字段");
            break;
        }
        case "reorder_drama_clips":
            normalized = { clipIds: requiredUniqueStringArray(input.clipIds, "clipIds") };
            break;
        case "archive_drama_clip":
        case "restore_drama_clip":
            normalized = { clipId: requiredString(input.clipId, "clipId"), expectedRevision: boundedInteger(input.expectedRevision, 1, Number.MAX_SAFE_INTEGER) };
            break;
        case "create_drama_asset":
            normalized = {
                title: requiredString(input.title, "title"), kind: enumString(input.kind, "kind", ["character", "scene", "prop", "voice", "reference"]),
                parentId: optionalString(input.parentId), description: typeof input.description === "string" ? input.description : "",
            };
            break;
        case "update_drama_asset": {
            normalized = { assetId: requiredString(input.assetId, "assetId"), expectedRevision: boundedInteger(input.expectedRevision, 1, Number.MAX_SAFE_INTEGER) };
            for (const key of ["title", "parentId", "description", "adoptedVersionId", "defaultVoiceVersionId"] as const) if (input[key] !== undefined) {
                if (typeof input[key] !== "string") throw new Error(key + " 必须是字符串");
                normalized[key] = input[key];
            }
            if (input.archived !== undefined) {
                if (typeof input.archived !== "boolean") throw new Error("archived 必须是布尔值");
                normalized.archived = input.archived;
            }
            if (Object.keys(normalized).length === 2) throw new Error("缺少待更新字段");
            break;
        }
        case "generate_drama_asset_candidate":
            normalized = {
                assetId: requiredString(input.assetId, "assetId"), kind: enumString(input.kind, "kind", ["image", "audio"]),
                prompt: preservedRequiredString(input.prompt, "prompt"), sourceNodeIds: uniqueStringArray(input.sourceNodeIds, "sourceNodeIds"),
                ...(optionalString(input.title) ? { title: optionalString(input.title) } : {}),
                ...(optionalString(input.voice) ? { voice: optionalString(input.voice) } : {}),
                ...(optionalString(input.instructions) ? { instructions: optionalString(input.instructions) } : {}),
            };
            break;
        case "register_drama_asset_version":
            normalized = { assetId: requiredString(input.assetId, "assetId"), nodeId: requiredString(input.nodeId, "nodeId"), note: typeof input.note === "string" ? input.note : "", expectedRevision: boundedInteger(input.expectedRevision, 1, Number.MAX_SAFE_INTEGER) };
            break;
        case "get_drama_binding":
            normalized = { clipId: requiredString(input.clipId, "clipId"), stage: enumString(input.stage, "stage", ["storyboard", "video"]) };
            break;
        case "update_drama_binding": {
            if (!Array.isArray(input.references) || input.references.length > 16) throw new Error("references 必须是最多16项的数组");
            const seenOrders = new Set<number>();
            const references = input.references.map((item) => {
                if (!isRecord(item) || Object.keys(item).some((key) => !["assetId", "versionId", "role", "order", "speaker"].includes(key))) throw new Error("绑定字段无效");
                const order = boundedInteger(item.order, 0, Number.MAX_SAFE_INTEGER);
                if (order === undefined || seenOrders.has(order)) throw new Error("绑定顺序无效或重复");
                seenOrders.add(order);
                const role = enumString(item.role, "role", ["character", "scene", "prop", "reference", "voice", "video_reference"]);
                const speaker = typeof item.speaker === "string" ? item.speaker : "";
                if (role === "voice" ? !speaker.trim() || speaker !== speaker.trim() : Boolean(speaker)) {
                    throw new Error(role === "voice" ? "声音绑定必须填写无首尾空格的实际说话者" : "只有 voice 职责可以填写 speaker");
                }
                return { assetId: requiredString(item.assetId, "assetId"), versionId: requiredString(item.versionId, "versionId"), role, order, speaker };
            }).sort((a, b) => a.order - b.order);
            if (references.some((reference, index) => reference.order !== index)) throw new Error("绑定 order 必须从 0 开始连续编号");
            if (input.stage === "storyboard" && references.some((reference) => reference.role === "voice" || reference.role === "video_reference")) {
                throw new Error("故事板绑定只接受 character、scene、prop、reference 图片职责");
            }
            normalized = { clipId: requiredString(input.clipId, "clipId"), stage: enumString(input.stage, "stage", ["storyboard", "video"]), expectedRevision: boundedInteger(input.expectedRevision, 0, Number.MAX_SAFE_INTEGER), references };
            break;
        }
        case "prepare_drama_clip_nodes":
        case "repair_drama_clip_group_layout":
            normalized = { clipIds: requiredUniqueStringArray(input.clipIds, "clipIds") };
            break;
        case "update_drama_generation_node":
            normalized = {
                clipId: requiredString(input.clipId, "clipId"),
                nodeId: requiredString(input.nodeId, "nodeId"),
                stage: enumString(input.stage, "stage", ["storyboard", "video"]),
                prompt: preservedRequiredString(input.prompt, "prompt"),
                ...(input.parameters === undefined ? {} : { parameters: normalizeDramaParameters(input.parameters) }),
            };
            break;
        case "get_drama_runs":
        case "get_drama_adoptions":
            normalized = optionalString(input.clipId) ? { clipId: optionalString(input.clipId) } : {};
            break;
        case "preview_drama_run":
            normalized = { clipId: requiredString(input.clipId, "clipId"), nodeId: requiredString(input.nodeId, "nodeId"), ...(optionalString(input.requestId) ? { requestId: optionalString(input.requestId) } : {}) };
            break;
        case "enqueue_drama_run":
            normalized = { clipId: requiredString(input.clipId, "clipId"), nodeId: requiredString(input.nodeId, "nodeId"), requestId: requiredString(input.requestId, "requestId") };
            break;
        case "cancel_drama_run":
        case "recheck_drama_run":
            normalized = { clipId: requiredString(input.clipId, "clipId"), runId: requiredString(input.runId, "runId") };
            break;
        case "adopt_drama_output":
            normalized = { clipId: requiredString(input.clipId, "clipId"), runId: requiredString(input.runId, "runId"), outputIndex: boundedInteger(input.outputIndex, 0, Number.MAX_SAFE_INTEGER), expectedRevision: boundedInteger(input.expectedRevision, 0, Number.MAX_SAFE_INTEGER), clipRevision: boundedInteger(input.clipRevision, 1, Number.MAX_SAFE_INTEGER) };
            break;
        case "export_drama_episode":
            if (input.partial !== undefined && typeof input.partial !== "boolean") throw new Error("partial 必须是布尔值");
            normalized = { partial: input.partial === true };
            break;
        case "get_canvas_summary":
        case "get_selected_nodes":
        case "get_generation_config":
            break;
        case "query_canvas_nodes": {
            const nodeType = optionalString(input.type);
            if (nodeType && !NODE_TYPES.includes(nodeType)) throw new Error("无效的节点类型");
            normalized = {
                ...(optionalString(input.nodeId) ? { nodeId: optionalString(input.nodeId) } : {}),
                ...(optionalString(input.keyword) ? { keyword: optionalString(input.keyword) } : {}),
                ...(nodeType ? { type: nodeType } : {}),
                page: boundedInteger(input.page, 1, Number.MAX_SAFE_INTEGER) || 1,
                pageSize: boundedInteger(input.pageSize, 1, 50) || 20,
            };
            break;
        }
        case "get_node":
        case "get_media_content":
        case "get_upstream_nodes":
        case "get_downstream_nodes":
        case "get_connected_nodes":
        case "get_generation_task":
        case "get_media_task_status":
        case "delete_node":
            normalized = { nodeId: requiredString(input.nodeId, "nodeId") };
            break;
        case "read_skill_file":
            normalized = { skillId: requiredString(input.skillId, "skillId"), path: requiredString(input.path, "path") };
            break;
        case "delete_connection":
            normalized = { connectionId: requiredString(input.connectionId, "connectionId") };
            break;
        case "create_connection":
            normalized = {
                fromNodeId: requiredString(input.fromNodeId, "fromNodeId"),
                toNodeId: requiredString(input.toNodeId, "toNodeId"),
            };
            break;
        case "create_primary_script_node":
            normalized = {
                title: requiredString(input.title, "title"),
                content: requiredString(input.content, "content"),
                sourceNodeIds: stringArray(input.sourceNodeIds),
                projectTitle: requiredString(input.projectTitle, "projectTitle"),
            };
            break;
        case "create_text_node":
            normalized = {
                title: requiredString(input.title, "title"),
                content: requiredString(input.content, "content"),
                sourceNodeIds: stringArray(input.sourceNodeIds),
            };
            break;
        case "update_text_node":
            normalized = {
                nodeId: requiredString(input.nodeId, "nodeId"),
                ...(optionalString(input.title) ? { title: optionalString(input.title) } : {}),
                ...(optionalString(input.content) ? { content: optionalString(input.content) } : {}),
            };
            if (!normalized.title && !normalized.content) throw new Error("update_text_node 缺少 title 或 content");
            break;
        case "update_node":
            normalized = { nodeId: requiredString(input.nodeId, "nodeId"), title: requiredString(input.title, "title") };
            break;
        case "set_agent_state": {
            const phase = requiredString(input.phase, "phase") as CanvasAgentPhase;
            if (!PHASES.includes(phase)) throw new Error("无效的 Agent 创作阶段");
            const targetDurationSeconds = positiveNumber(input.targetDurationSeconds);
            normalized = {
                phase,
                ...(optionalString(input.brief) ? { brief: optionalString(input.brief) } : {}),
                ...(targetDurationSeconds !== undefined ? { targetDurationSeconds } : {}),
                ...(optionalString(input.approvedPlan) ? { approvedPlan: optionalString(input.approvedPlan) } : {}),
                ...(input.approvedNodeIds !== undefined ? { approvedNodeIds: stringArray(input.approvedNodeIds) } : {}),
                ...(input.referenceNodeIds !== undefined ? { referenceNodeIds: stringArray(input.referenceNodeIds) } : {}),
            };
            break;
        }
        case "create_group": {
            const nodeIds = stringArray(input.nodeIds);
            if (nodeIds.length < 2) throw new Error("create_group 至少需要两个节点");
            normalized = { nodeIds, ...(optionalString(input.title) ? { title: optionalString(input.title) } : {}) };
            break;
        }
        case "arrange_nodes":
            normalized = { nodeIds: stringArray(input.nodeIds) };
            break;
        case "generate_image":
        case "edit_image": {
            const sourceNodeIds = optionalStringArray(input.sourceNodeIds, "sourceNodeIds");
            normalized = {
                prompt: requiredString(input.prompt, "prompt"),
                ...(sourceNodeIds ? { sourceNodeIds } : {}),
                ...(optionalString(input.title) ? { title: optionalString(input.title) } : {}),
                ...(optionalString(input.size) ? { size: optionalString(input.size) } : {}),
                ...(boundedInteger(input.count, 1, 15) ? { count: boundedInteger(input.count, 1, 15) } : {}),
            };
            if (actionName === "edit_image" && sourceNodeIds && !sourceNodeIds.length) throw new Error("edit_image 缺少图片来源节点");
            break;
        }
        case "upscale_image":
            normalized = {
                sourceNodeId: requiredString(input.sourceNodeId, "sourceNodeId"),
                resolution: input.resolution === undefined ? "2k" : enumString(input.resolution, "resolution", ["2k", "4k"]),
                model: input.model === undefined ? "vosr2" : enumString(input.model, "model", ["vosr2", "seedvr2"]),
                ...(optionalString(input.title) ? { title: optionalString(input.title) } : {}),
            };
            break;
        case "generate_video": {
            const sourceNodeIds = optionalStringArray(input.sourceNodeIds, "sourceNodeIds");
            const seconds = boundedInteger(input.seconds, -1, 30);
            if (input.model !== undefined) optionalString(input.model);
            if (input.generateAudio !== undefined && typeof input.generateAudio !== "boolean") throw new Error("generateAudio 必须是布尔值");
            normalized = {
                prompt: requiredString(input.prompt, "prompt"),
                ...(sourceNodeIds ? { sourceNodeIds } : {}),
                ...(optionalString(input.title) ? { title: optionalString(input.title) } : {}),
                ...(optionalString(input.size) ? { size: optionalString(input.size) } : {}),
                ...(seconds !== undefined ? { seconds } : {}),
                ...(typeof input.generateAudio === "boolean" ? { generateAudio: input.generateAudio } : {}),
            };
            break;
        }
        case "upscale_video":
            normalized = {
                sourceNodeId: requiredString(input.sourceNodeId, "sourceNodeId"),
                resolution: input.resolution === undefined ? "1080p" : enumString(input.resolution, "resolution", ["720p", "1080p", "2k"]),
                ...(optionalString(input.title) ? { title: optionalString(input.title) } : {}),
            };
            break;
        case "generate_audio": {
            const sourceNodeIds = optionalStringArray(input.sourceNodeIds, "sourceNodeIds");
            normalized = {
                prompt: requiredString(input.prompt, "prompt"),
                ...(sourceNodeIds ? { sourceNodeIds } : {}),
                ...(optionalString(input.title) ? { title: optionalString(input.title) } : {}),
                ...(optionalString(input.voice) ? { voice: optionalString(input.voice) } : {}),
                ...(optionalString(input.instructions) ? { instructions: optionalString(input.instructions) } : {}),
            };
            break;
        }
    }

    return { id, name: actionName, arguments: normalized };
}

export async function parseCanvasAgentJson(content: string, { allowRepair = false }: { allowRepair?: boolean } = {}): Promise<ParsedCanvasAgentJson> {
    const json = extractJsonObject(content);
    let actionPayload = /[{,]\s*["']?actions["']?\s*:/.test(content);
    if (!json && !actionPayload) return { parsed: false, actions: [], reply: content.trim() };
    try {
        let payload: unknown;
        try {
            payload = JSON.parse(json);
        } catch {
            if (!allowRepair) throw new Error("工具 JSON 不是合法 JSON");
            const repairSource = json || stripJsonFence(content);
            const sourceStructure = inspectJsonStructure(repairSource);
            if (!sourceStructure.complete) throw new Error("JSON 输出被截断，本批操作未执行");
            const { jsonrepair } = await import("jsonrepair");
            const repaired = jsonrepair(repairSource);
            if (inspectJsonStructure(repaired).tokens !== sourceStructure.tokens) throw new Error("JSON 修复改变了操作结构，本批操作未执行");
            payload = JSON.parse(repaired);
        }
        if (!isRecord(payload) || !Object.prototype.hasOwnProperty.call(payload, "actions")) return { parsed: false, actions: [], reply: content.trim() };
        actionPayload = true;
        if (!Array.isArray(payload.actions)) throw new Error("actions 必须是数组");
        if (payload.actions.length > 12) throw new Error("单次最多执行 12 个画布操作，请拆分调用");
        const outerKeys = Object.keys(payload).filter((key) => key !== "actions" && key !== "reply");
        if (outerKeys.length) throw new Error("JSON 外层不支持字段：" + outerKeys.join("、") + "；工具参数必须放在对应 action 的 arguments 中");
        const actions = payload.actions.map((item) => {
            if (!isRecord(item)) throw new Error("actions 中的每项必须是工具调用对象");
            const name = item.tool || item.name;
            const misplacedKeys = Object.keys(item).filter((key) => !["id", "tool", "name", "arguments"].includes(key));
            let args = item.arguments;
            if (misplacedKeys.length) {
                if (typeof name !== "string" || !ACTION_NAME_SET.has(name)) throw new Error("模型返回了不允许的工具");
                if (args !== undefined && !isRecord(args)) throw new Error(name + " 的 arguments 必须是对象");
                const supported = canvasAgentToolDefinition(name).function.parameters.properties;
                const unsupported = misplacedKeys.filter((key) => !Object.prototype.hasOwnProperty.call(supported, key));
                if (unsupported.length) throw new Error(name + " 不支持参数：" + unsupported.join("、"));
                const normalizedArgs = { ...(isRecord(args) ? args : {}) };
                const conflicts = misplacedKeys.filter((key) => Object.prototype.hasOwnProperty.call(normalizedArgs, key));
                if (conflicts.length) throw new Error(conflicts.join("、") + " 同时出现在 arguments 内外层");
                misplacedKeys.forEach((key) => { normalizedArgs[key] = item[key]; });
                args = normalizedArgs;
            }
            return normalizeCanvasAgentAction(name, args, typeof item.id === "string" && item.id ? item.id : nanoid());
        });
        return { parsed: true, actions, reply: typeof payload.reply === "string" ? payload.reply.trim() : "" };
    } catch (error) {
        if (actionPayload) return { parsed: false, actions: [], reply: "", error: error instanceof Error ? error.message : "工具 JSON 格式错误" };
        return { parsed: false, actions: [], reply: content.trim() };
    }
}

function canvasAgentToolDefinition(name: string) {
    return name === "read_skill_file" ? CANVAS_AGENT_SKILL_FILE_TOOL : CANVAS_AGENT_TOOLS.find((tool) => tool.function.name === name)!;
}

export function canvasAgentActionLabel(action: CanvasAgentAction) {
    const labels: Record<CanvasAgentActionName, string> = {
        get_drama_project: "正在读取漫剧项目", get_drama_episode: "正在读取当前集", get_drama_clips: "正在读取 Clip", get_drama_assets: "正在读取共享资产",
        update_drama_project: "正在更新漫剧项目", update_drama_episode: "正在更新当前剧本", create_drama_clip: "正在创建 Clip", update_drama_clip: "正在更新 Clip",
        reorder_drama_clips: "正在重排 Clip", archive_drama_clip: "正在归档 Clip", restore_drama_clip: "正在恢复 Clip",
        create_drama_asset: "正在创建漫剧资产", update_drama_asset: "正在更新漫剧资产", generate_drama_asset_candidate: "正在创建资产候选", register_drama_asset_version: "正在登记资产版本",
        get_drama_binding: "正在读取资产绑定", update_drama_binding: "正在更新资产绑定", prepare_drama_clip_nodes: "正在准备 Clip 节点", repair_drama_clip_group_layout: "正在恢复 Clip 分组布局", update_drama_generation_node: "正在更新生成节点",
        get_drama_runs: "正在读取漫剧运行", preview_drama_run: "正在预览漫剧运行", enqueue_drama_run: "正在提交漫剧运行", cancel_drama_run: "正在取消漫剧运行", recheck_drama_run: "正在核实漫剧运行",
        get_drama_adoptions: "正在读取采用结果", adopt_drama_output: "正在采用漫剧输出", export_drama_episode: "正在导出当前集",
        get_canvas_summary: "正在读取画布",
        get_selected_nodes: "正在读取选中节点",
        query_canvas_nodes: "正在查找画布节点",
        get_node: "正在读取节点",
        get_media_content: "正在读取媒体内容",
        get_upstream_nodes: "正在读取上游节点",
        get_downstream_nodes: "正在读取下游节点",
        get_connected_nodes: "正在读取关联节点",
        get_generation_config: "正在读取生成配置",
        get_generation_task: "正在读取任务状态",
        read_skill_file: "正在读取 Skill 文件",
        set_agent_state: "正在保存创作进度",
        create_primary_script_node: "正在创建主剧本节点",
        create_text_node: "正在创建文本节点",
        update_text_node: "正在更新文本节点",
        update_node: "正在更新节点",
        delete_node: "正在删除节点",
        create_connection: "正在创建连线",
        delete_connection: "正在删除连线",
        create_group: "正在创建分组",
        arrange_nodes: "正在整理画布",
        generate_image: "正在创建图片节点",
        edit_image: "正在创建图片编辑节点",
        upscale_image: "正在创建图片高清处理节点",
        generate_video: "正在创建视频节点",
        upscale_video: "正在创建视频高清处理节点",
        generate_audio: "正在创建音频节点",
        get_media_task_status: "正在读取媒体任务",
    };
    return labels[action.name];
}

export function isCanvasAgentMediaAction(action: CanvasAgentAction) {
    return action.name === "generate_image" || action.name === "edit_image" || action.name === "upscale_image" || action.name === "generate_video" || action.name === "upscale_video" || action.name === "generate_audio" || action.name === "generate_drama_asset_candidate" || action.name === "enqueue_drama_run";
}

export function userLikelyRequestedCanvasAction(text: string) {
    return /(?:创建|新增|插入|修改|更新|删除|连接|连线|分组|整理|生成|生图|执行|拆成|拆分|放到画布|开始做|(?:做|制作|添加|补充|移除|去掉).{0,8}(?:视频|音频|配音|旁白))/i.test(text);
}

function extractJsonObject(content: string) {
    const trimmed = stripJsonFence(content);
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    return start >= 0 && end > start ? trimmed.slice(start, end + 1) : "";
}

function stripJsonFence(content: string) {
    return content.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "");
}

function inspectJsonStructure(value: string) {
    const start = value.indexOf("{");
    if (start < 0) return { complete: false, tokens: "" };
    const stack: string[] = [];
    let quote = "";
    let escaped = false;
    let tokens = "";
    let rootEnd = -1;

    for (let index = start; index < value.length; index++) {
        const char = value[index];
        if (rootEnd >= 0) continue;
        if (quote) {
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === quote) quote = "";
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === "{" || char === "[") {
            stack.push(char);
            tokens += char;
            continue;
        }
        if (char !== "}" && char !== "]") continue;
        tokens += char;
        const open = stack.pop();
        if ((char === "}" && open !== "{") || (char === "]" && open !== "[")) return { complete: false, tokens };
        if (!stack.length) rootEnd = index;
    }
    return { complete: rootEnd >= 0 && !value.slice(rootEnd + 1).trim(), tokens };
}

function requiredString(value: unknown, key: string) {
    if (typeof value !== "string") throw new Error(key + " 必须是字符串");
    const text = value.trim();
    if (!text) throw new Error(key + " 不能为空");
    return text;
}

function preservedRequiredString(value: unknown, key: string) {
    if (typeof value !== "string" || !value.trim()) throw new Error(key + " 不能为空");
    return value;
}

function enumString(value: unknown, key: string, allowed: readonly string[]) {
    const text = requiredString(value, key);
    if (!allowed.includes(text)) throw new Error(key + " 无效");
    return text;
}

function requiredUniqueStringArray(value: unknown, key: string) {
    if (!Array.isArray(value) || !value.length) throw new Error(key + " 必须是非空字符串数组");
    const items = stringArray(value, key);
    if (items.length !== value.length) throw new Error(key + " 不能包含重复项");
    return items;
}

function uniqueStringArray(value: unknown, key: string) {
    if (!Array.isArray(value)) throw new Error(key + " 必须是字符串数组");
    const items = stringArray(value, key);
    if (items.length !== value.length) throw new Error(key + " 不能包含重复项");
    return items;
}

function normalizeDramaParameters(value: unknown) {
    if (value === undefined) return {};
    if (!isRecord(value)) throw new Error("parameters 必须是对象");
    const result: Record<string, string | number> = {};
    const allowed = new Set(["steps", "seed", "seconds", "size", "resolution_name"]);
    for (const [key, item] of Object.entries(value)) {
        if (!allowed.has(key)) throw new Error("不支持的公开参数：" + key);
        if (key === "steps") result[key] = boundedInteger(item, 1, 1000) as number;
        else if (key === "seed") result[key] = boundedInteger(item, 0, Number.MAX_SAFE_INTEGER) as number;
        else if (key === "seconds") result[key] = boundedNumber(item, Number.MIN_VALUE, Number.MAX_SAFE_INTEGER) as number;
        else {
            if (typeof item !== "string" || item.length > 100) throw new Error(key + " 必须是最多100字符的字符串");
            if (key === "resolution_name" && !["480p", "720p", "1080p"].includes(item)) throw new Error("resolution_name 无效");
            result[key] = item;
        }
    }
    return result;
}

function normalizeDramaGenerationDefaults(value: unknown) {
    if (!isRecord(value) || Object.keys(value).some((key) => key !== "image" && key !== "video")) throw new Error("generationDefaults 只支持 image 和 video");
    const result: Partial<Record<"image" | "video", Record<string, string | number | boolean>>> = {};
    if (value.image !== undefined) result.image = normalizeDramaParameters(value.image);
    if (value.video !== undefined) result.video = normalizeDramaParameters(value.video);
    return result;
}

function optionalString(value: unknown) {
    if (value === undefined) return "";
    if (typeof value !== "string") throw new Error("可选文本参数必须是字符串");
    return value.trim();
}

function stringArray(value: unknown, key = "节点 ID") {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new Error(key + " 必须是字符串数组");
    if (value.length > 50) throw new Error("节点 ID 数组最多允许 50 项，请拆分调用");
    return [...new Set(value.map((item) => {
        if (typeof item !== "string" || !item.trim()) throw new Error(key + " 必须是字符串数组");
        return item.trim();
    }))];
}

function optionalStringArray(value: unknown, key: string) {
    if (value === undefined) return undefined;
    return stringArray(value, key);
}

function positiveNumber(value: unknown) {
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 1) throw new Error("数值必须是大于等于 1 的数字");
    return value;
}

function boundedInteger(value: unknown, min: number, max: number) {
    const number = boundedNumber(value, min, max);
    if (number !== undefined && !Number.isInteger(number)) throw new Error("数值必须是整数");
    return number;
}

function boundedNumber(value: unknown, min: number, max: number) {
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error("数值必须在 " + min + " 到 " + max + " 之间");
    return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
