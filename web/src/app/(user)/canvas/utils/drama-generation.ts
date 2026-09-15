import { getDramaBinding, listDramaAssets } from "@/services/api/drama-assets";
import { registeredDramaStorageId, uploadDramaMedia, type DramaRunInput } from "@/services/api/drama-runs";
import type { CanvasConnection, CanvasNodeData, CanvasNodeMetadata } from "../types";
import { getDramaProject, listDramaClips } from "@/services/api/drama";

export function resolveDramaNodeParameters(
    defaults: Record<string, string | number | boolean> | undefined,
    metadata: CanvasNodeMetadata | undefined,
): DramaRunInput["parameters"] {
    const parameters: DramaRunInput["parameters"] = { ...defaults };
    if (metadata?.seconds) parameters.seconds = metadata.seconds;
    if (metadata?.size && metadata.size !== "auto") parameters.size = metadata.size;
    if (metadata?.quality && metadata.quality !== "auto") parameters.quality = metadata.quality;
    Object.assign(parameters, metadata?.dramaParameters || {});
    return parameters;
}

export function persistDramaNodeParameters(metadata: CanvasNodeMetadata | undefined, parameters: DramaRunInput["parameters"]): CanvasNodeMetadata {
    const next: CanvasNodeMetadata = { ...metadata, dramaParameters: { ...parameters } };
    if (typeof parameters.seconds === "number" || typeof parameters.seconds === "string") next.seconds = String(parameters.seconds);
    if (typeof parameters.size === "string") next.size = parameters.size;
    if (typeof parameters.resolution_name === "string") next.vquality = parameters.resolution_name;
    return next;
}

function dramaParameterSeconds(value: unknown) {
    const seconds = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(seconds) ? seconds : NaN;
}

export async function buildDramaRunInput(token: string, projectId: string, episodeId: string, node: CanvasNodeData, nodes: CanvasNodeData[], connections: CanvasConnection[], model: string, channelId: string, prompt: string) {
    const clipId = node.metadata?.dramaClipId;
    if (!clipId || !prompt.trim() || !model || !channelId) throw new Error("请填写完整提示词并选择后台模型渠道");
    const stage = node.metadata?.dramaRole === "video" ? "video" : "storyboard";
    const binding = await getDramaBinding(token, projectId, episodeId, clipId, stage);
    const catalog = await listDramaAssets(token, projectId);
    const references: DramaRunInput["references"] = binding.references.map((input) => {
        const version = catalog.versions.find((item) => item.id === input.versionId && item.assetId === input.assetId);
        const asset = catalog.assets.find((item) => item.id === input.assetId);
        if (!version) throw new Error("绑定的素材版本不存在");
        return { assetId: input.assetId, versionId: input.versionId, storageId: version.storageId, title: asset?.title, role: input.role, order: input.order, speaker: input.speaker };
    });
    let boardUpdate: { id: string; metadata: Partial<CanvasNodeMetadata> } | undefined;
    if (stage === "video") {
        const board = nodes.find((item) => item.metadata?.dramaClipId === clipId && item.metadata?.dramaRole === "storyboard");
        if (!board?.metadata?.content || !connections.some((edge) => edge.fromNodeId === board.id && edge.toNodeId === node.id)) throw new Error("请先准备并连接完整导演故事板");
        let storageId = registeredDramaStorageId(board.metadata.storageKey);
        if (!storageId) {
            const response = await fetch(board.metadata.content);
            if (!response.ok) throw new Error("故事板无法读取");
            const saved = await uploadDramaMedia(token, await response.blob(), "storyboard");
            storageId = saved.id;
            boardUpdate = { id: board.id, metadata: { content: saved.url, storageKey: saved.storageKey } };
        }
        references.unshift({ storageId, title: board.title.replace(/\s*·\s*导演故事板\s*$/, " 完整导演板"), role: "storyboard", order: 0 });
    }
    const project = await getDramaProject(token, projectId);
    const parameters = resolveDramaNodeParameters(project.project.generationDefaults?.[stage === "video" ? "video" : "image"], node.metadata);
    if (stage === "video") {
        const clip = (await listDramaClips(token, projectId, episodeId)).find((item) => item.id === clipId && !item.archived);
        if (!clip) throw new Error("当前 Clip 不存在或已归档");
        const clipSeconds = Number(clip.shots.reduce((total, shot) => total + shot.duration, 0).toFixed(3));
        if (!(clipSeconds > 0 && clipSeconds <= 15)) throw new Error("Clip 总时长必须大于0且不超过15秒");
        const requestedSeconds = dramaParameterSeconds(parameters.seconds);
        if (Number.isFinite(requestedSeconds) && requestedSeconds !== clipSeconds) {
            throw new Error(`节点视频时长 ${requestedSeconds}s 与 Clip 镜头总时长 ${clipSeconds}s 不一致，请先更新画布节点参数`);
        }
        parameters.seconds = clipSeconds;
    }
    return {
        input: { requestId: crypto.randomUUID(), nodeId: node.id, kind: stage === "video" ? "video" : "image", model, channelId, prompt: prompt.trim(), parameters, references: references.map((item, order) => ({ ...item, order })) } satisfies DramaRunInput,
        boardUpdate,
    };
}
