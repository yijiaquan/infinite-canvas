import type { CanvasConnection, CanvasNodeData } from "../types";
import { buildNodeMentionReferences, canvasResourceLabel } from "./canvas-resource-references";

export function buildDramaPromptReferences(node: CanvasNodeData, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const counts = { image: 0, video: 0, audio: 0, text: 0 };
    const inputEdges = connections.filter((connection) => connection.toNodeId === node.id);
    return buildNodeMentionReferences(node, nodes, connections)
        .sort((left, right) => {
            const leftNode = nodes.find((item) => item.id === left.nodeId);
            const rightNode = nodes.find((item) => item.id === right.nodeId);
            const rank = (item?: CanvasNodeData) => {
                if (item?.metadata?.dramaRole === "storyboard") return -1;
                return inputEdges.find((edge) => edge.fromNodeId === item?.id)?.dramaInputOrder ?? item?.metadata?.dramaInputOrder ?? Number.MAX_SAFE_INTEGER;
            };
            return rank(leftNode) - rank(rightNode);
        })
        .map((reference) => ({ ...reference, label: canvasResourceLabel(reference.kind, counts[reference.kind]++) }));
}
