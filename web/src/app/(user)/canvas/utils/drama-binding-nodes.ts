import type { DramaRunReference } from "@/services/api/drama-runs";
import type { CanvasNodeData, CanvasConnection } from "../types";
import { CanvasNodeType } from "../types";

export function applyDramaBindingNodes(nodes: CanvasNodeData[], connections: CanvasConnection[], targetId: string, inputs: (DramaRunReference & { title: string })[]) {
    const targets = nodes.filter((node) => node.id === targetId);
    if (targets.length > 1) throw new Error("目标节点 ID 重复，请先修复画布");
    const target = targets[0];
    if (!target?.metadata?.dramaClipId) return { nodes, connections };
    const plannedIds = new Set<string>();
    // 整批检查通过后才构造结果，不能覆盖同 ID 的无关节点或连线。
    const plan = inputs.map((input) => {
        const versionId = input.versionId || input.storageId;
        const speakerKey = input.role === "voice" ? input.speaker || "" : "";
        const isVoice = input.role === "voice";
        const sharedId = isVoice ? `drama:${encodeURIComponent(target.metadata!.dramaClipId!)}:reference:${encodeURIComponent(versionId)}:${encodeURIComponent(speakerKey)}` : `drama:reference:${encodeURIComponent(versionId)}`;
        const reusable = nodes.filter(
            (node) =>
                node.metadata?.dramaRole === "reference" && node.metadata?.dramaAssetVersionId === input.versionId && (!isVoice || (node.metadata?.dramaClipId === target.metadata!.dramaClipId && node.id.endsWith(`:${encodeURIComponent(speakerKey)}`))),
        );
        const ownedLegacy = reusable.find((node) => node.metadata?.dramaBindingTarget === targetId);
        const existing = nodes.find((node) => node.id === sharedId) || ownedLegacy || reusable[0];
        const id = existing?.id || sharedId;
        if (plannedIds.has(id)) throw new Error("输入绑定重复，请检查素材版本、用途和说话者");
        plannedIds.add(id);
        const type = input.role === "voice" ? CanvasNodeType.Audio : input.role === "video_reference" ? CanvasNodeType.Video : CanvasNodeType.Image;
        const matches = nodes.filter((node) => node.id === id);
        if (
            matches.length > 1 ||
            (existing && (existing.type !== type || existing.metadata?.dramaRole !== "reference" || existing.metadata?.dramaAssetVersionId !== input.versionId || (isVoice && existing.metadata?.dramaClipId !== target.metadata!.dramaClipId)))
        ) {
            throw new Error("绑定节点 ID 已被其他内容占用，请先修复画布");
        }
        const connection: CanvasConnection = {
            id: `drama:binding:${encodeURIComponent(targetId)}:${encodeURIComponent(versionId)}:${encodeURIComponent(input.role)}:${encodeURIComponent(input.speaker || "")}`,
            fromNodeId: id,
            toNodeId: targetId,
            dramaAssetVersionId: input.versionId,
            dramaInputRole: input.role,
            dramaInputOrder: input.order,
            dramaInputSpeaker: input.speaker,
        };
        const edges = connections.filter((edge) => edge.id === connection.id);
        if (edges.length > 1 || edges.some((edge) => edge.fromNodeId !== id || edge.toNodeId !== targetId)) throw new Error("绑定连线 ID 已被其他连接占用，请先修复画布");
        return { input, id, type, existing, connection };
    });
    let nextNodes = [...nodes];
    const oldInputIds = new Set(nodes.filter((node) => node.metadata?.dramaBindingTarget === targetId).map((node) => node.id));
    const nextEdges = connections.filter((edge) => !(edge.toNodeId === targetId && ((edge.id === `${edge.fromNodeId}:binding` && oldInputIds.has(edge.fromNodeId)) || edge.dramaAssetVersionId)));
    for (const { input, id, type, existing, connection } of plan) {
        if (!existing) {
            const position = { x: target.position.x, y: target.position.y + target.height + 60 + input.order * 190 };
            const overlaps = () =>
                nextNodes
                    .filter((node) => node.type !== CanvasNodeType.Group)
                    .find((node) => position.x < node.position.x + node.width + 20 && position.x + 220 + 20 > node.position.x && position.y < node.position.y + node.height + 20 && position.y + 140 + 20 > node.position.y);
            for (let collision = overlaps(); collision; collision = overlaps()) position.y = collision.position.y + collision.height + 40;
            nextNodes.push({
                id,
                type,
                title: input.title,
                position,
                width: 220,
                height: 140,
                metadata: {
                    ...(input.role === "voice" ? { dramaClipId: target.metadata.dramaClipId } : {}),
                    dramaRole: "reference",
                    dramaAssetVersionId: input.versionId,
                    content: `/api/files/${input.storageId}/content`,
                    storageKey: `server:${input.storageId}`,
                    status: "success",
                },
            });
        } else if (input.role !== "voice" && (existing.metadata?.dramaClipId || existing.metadata?.groupId)) {
            nextNodes = nextNodes.map((node) => {
                if (node.id !== existing.id) return node;
                const { dramaClipId: _dramaClipId, groupId: _groupId, ...metadata } = node.metadata || {};
                return { ...node, metadata };
            });
        }
        nextEdges.push(connection);
    }
    return { nodes: nextNodes, connections: nextEdges };
}
