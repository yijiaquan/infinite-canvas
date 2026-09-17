import type { DramaRunReference } from "@/services/api/drama-runs";
import type { CanvasNodeData, CanvasConnection } from "../types";
import { CanvasNodeType } from "../types";

export function applyDramaBindingNodes(nodes: CanvasNodeData[], connections: CanvasConnection[], targetId: string, inputs: (DramaRunReference & { title: string })[]) {
    const targets = nodes.filter((node) => node.id === targetId);
    if (targets.length > 1) throw new Error("目标节点 ID 重复，请先修复画布");
    const target = targets[0];
    if (!target?.metadata?.dramaClipId) return { nodes, connections };
    const plannedIds = new Map<string, CanvasNodeType>();
    const plannedBindings = new Set<string>();
    // 整批检查通过后才构造结果，不能覆盖同 ID 的无关节点或连线。
    const plan = inputs.map((input) => {
        const versionId = input.versionId || input.storageId;
        const type = input.role === "voice" ? CanvasNodeType.Audio : input.role === "video_reference" ? CanvasNodeType.Video : CanvasNodeType.Image;
        const bindingKey = `${input.assetId}\x00${versionId}\x00${input.role}\x00${input.speaker || ""}`;
        if (plannedBindings.has(bindingKey)) throw new Error("输入绑定重复，请检查素材版本、用途和说话者");
        plannedBindings.add(bindingKey);
        // Asset versions are canvas-global. Speaker, sequence and Clip ownership
        // belong to the binding edge, so one Voice node can feed every relevant Clip.
        const sharedId = `drama:reference:${encodeURIComponent(versionId)}`;
        const registeredStorageKey = `server:${input.storageId}`;
        const sourceNode = nodes.find(
            (node) =>
                node.id !== targetId &&
                node.type === type &&
                node.metadata?.dramaAssetId === input.assetId &&
                node.metadata?.storageKey === registeredStorageKey &&
                node.metadata?.dramaRole !== "storyboard" &&
                node.metadata?.dramaRole !== "video" &&
                node.metadata?.dramaRole !== "group",
        );
        const reusable = nodes.filter((node) => node.type === type && node.metadata?.dramaRole === "reference" && node.metadata?.dramaAssetVersionId === input.versionId);
        const ownedLegacy = reusable.find((node) => node.metadata?.dramaBindingTarget === targetId);
        const existing = sourceNode || nodes.find((node) => node.id === sharedId) || ownedLegacy || reusable[0];
        const id = existing?.id || sharedId;
        const plannedType = plannedIds.get(id);
        if (plannedType && plannedType !== type) throw new Error("同一素材版本不能映射为不同媒体类型");
        plannedIds.set(id, type);
        const matches = nodes.filter((node) => node.id === id);
        if (
            matches.length > 1 ||
            (existing &&
                (existing.type !== type ||
                    (existing !== sourceNode && (existing.metadata?.dramaRole !== "reference" || existing.metadata?.dramaAssetVersionId !== input.versionId))))
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
        return { input, id, type, existing, sourceNode, connection };
    });
    let nextNodes = [...nodes];
    const oldInputIds = new Set(nodes.filter((node) => node.metadata?.dramaBindingTarget === targetId).map((node) => node.id));
    let nextEdges = connections.filter((edge) => !(edge.toNodeId === targetId && ((edge.id === `${edge.fromNodeId}:binding` && oldInputIds.has(edge.fromNodeId)) || edge.dramaAssetVersionId)));
    for (const { input, id, type, existing, sourceNode, connection } of plan) {
        const materialized = nextNodes.find((node) => node.id === id);
        if (!materialized) {
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
                    dramaRole: "reference",
                    dramaAssetVersionId: input.versionId,
                    content: `/api/files/${input.storageId}/content`,
                    storageKey: `server:${input.storageId}`,
                    status: "success",
                },
            });
        } else if (materialized.metadata?.dramaClipId || materialized.metadata?.groupId) {
            nextNodes = nextNodes.map((node) => {
                if (node.id !== materialized.id) return node;
                const { dramaClipId: _dramaClipId, groupId: _groupId, ...metadata } = node.metadata || {};
                return { ...node, metadata };
            });
        }
        if (sourceNode && materialized?.metadata?.dramaAssetVersionId !== input.versionId) {
            nextNodes = nextNodes.map((node) => (node.id === id ? { ...node, metadata: { ...node.metadata, dramaAssetVersionId: input.versionId } } : node));
        }
        nextEdges.push(connection);
    }
    // Older releases created a Voice reference for every Clip and speaker. Merge
    // only system binding edges, leaving user-created media and manual links intact.
    for (const item of plan) {
        const duplicates = nextNodes.filter((node) => node.id !== item.id && node.type === item.type && node.metadata?.dramaRole === "reference" && node.metadata?.dramaAssetVersionId === item.input.versionId);
        for (const duplicate of duplicates) {
            const hasManualLink = nextEdges.some((edge) => (edge.fromNodeId === duplicate.id || edge.toNodeId === duplicate.id) && !edge.dramaAssetVersionId);
            if (hasManualLink) continue;
            nextEdges = nextEdges.map((edge) => (edge.fromNodeId === duplicate.id && edge.dramaAssetVersionId === item.input.versionId ? { ...edge, fromNodeId: item.id } : edge));
            nextNodes = nextNodes.filter((node) => node.id !== duplicate.id);
        }
    }
    const seenBindingEdges = new Set<string>();
    nextEdges = nextEdges.filter((edge) => {
        if (!edge.dramaAssetVersionId) return true;
        if (seenBindingEdges.has(edge.id)) return false;
        seenBindingEdges.add(edge.id);
        return true;
    });
    const directlyBoundVersionIds = new Set(plan.filter((item) => item.sourceNode).map((item) => item.input.versionId));
    if (directlyBoundVersionIds.size) {
        const connectedNodeIds = new Set(nextEdges.flatMap((edge) => [edge.fromNodeId, edge.toNodeId]));
        nextNodes = nextNodes.filter((node) => !(node.id.startsWith("drama:reference:") && node.metadata?.dramaRole === "reference" && directlyBoundVersionIds.has(node.metadata.dramaAssetVersionId || "") && !connectedNodeIds.has(node.id)));
    }
    return { nodes: nextNodes, connections: nextEdges };
}
