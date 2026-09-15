import { CanvasNodeType, type CanvasNodeData, type ViewportTransform } from "../types";

const ITEM_GAP = 120;
const CLUSTER_GAP = 48;
const NODE_GAP = 24;
const CLIP_GROUP_PADDING = 24;
const CLIP_GROUP_HEADER = 60;
const CLIP_GROUP_WIDTH = 740;
const MAX_COLUMNS = 4;

type LayoutItem = {
    key: string;
    order: { x: number; y: number };
    width: number;
    height: number;
    nodes: CanvasNodeData[];
};

function bounds(nodes: CanvasNodeData[]) {
    const left = Math.min(...nodes.map((node) => node.position.x));
    const top = Math.min(...nodes.map((node) => node.position.y));
    const right = Math.max(...nodes.map((node) => node.position.x + node.width));
    const bottom = Math.max(...nodes.map((node) => node.position.y + node.height));
    return { left, top, width: right - left, height: bottom - top };
}

function moveNodes(nodes: CanvasNodeData[], x: number, y: number): CanvasNodeData[] {
    const area = bounds(nodes);
    return nodes.map((node) => ({ ...node, position: { x: node.position.x - area.left + x, y: node.position.y - area.top + y } }));
}

function buildClipItem(clipId: string, members: CanvasNodeData[]): LayoutItem | null {
    const group = members.find((node) => node.type === CanvasNodeType.Group && node.metadata?.dramaRole === "group");
    const board = members.find((node) => node.metadata?.dramaRole === "storyboard");
    const video = members.find((node) => node.metadata?.dramaRole === "video");
    if (!group || !board || !video) return null;

    const references = members.filter((node) => node.metadata?.dramaRole === "reference").sort((a, b) => (a.metadata?.dramaInputOrder ?? 0) - (b.metadata?.dramaInputOrder ?? 0) || a.id.localeCompare(b.id));
    const refColumns = Math.min(3, Math.max(1, references.length));
    const refColumnWidths = Array.from({ length: refColumns }, (_, column) => Math.max(0, ...references.filter((_, index) => index % refColumns === column).map((node) => node.width)));
    const refRows = Math.ceil(references.length / refColumns);
    const refRowHeights = Array.from({ length: refRows }, (_, row) => Math.max(0, ...references.slice(row * refColumns, (row + 1) * refColumns).map((node) => node.height)));
    const referenceWidth = refColumnWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, refColumns - 1) * NODE_GAP;
    const referenceHeight = refRowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, refRows - 1) * NODE_GAP;
    const groupHeight = CLIP_GROUP_HEADER + Math.max(board.height, video.height) + CLIP_GROUP_PADDING;
    const width = Math.max(CLIP_GROUP_WIDTH, referenceWidth);
    const groupTop = references.length ? referenceHeight + CLUSTER_GAP : 0;
    const groupLeft = (width - CLIP_GROUP_WIDTH) / 2;
    const result: CanvasNodeData[] = [
        { ...group, position: { x: groupLeft, y: groupTop }, width: CLIP_GROUP_WIDTH, height: groupHeight },
        { ...board, position: { x: groupLeft + CLIP_GROUP_PADDING, y: groupTop + CLIP_GROUP_HEADER }, metadata: { ...board.metadata, groupId: group.id } },
        { ...video, position: { x: groupLeft + CLIP_GROUP_WIDTH - CLIP_GROUP_PADDING - video.width, y: groupTop + CLIP_GROUP_HEADER }, metadata: { ...video.metadata, groupId: group.id } },
    ];
    let refY = 0;
    for (let row = 0; row < refRows; row += 1) {
        let refX = (width - referenceWidth) / 2;
        for (let column = 0; column < refColumns; column += 1) {
            const reference = references[row * refColumns + column];
            if (reference) {
                const { groupId: _groupId, ...metadata } = reference.metadata || {};
                result.push({ ...reference, position: { x: refX, y: refY }, metadata });
            }
            refX += refColumnWidths[column] + NODE_GAP;
        }
        refY += refRowHeights[row] + NODE_GAP;
    }
    const originalArea = bounds(members);
    return { key: `clip:${clipId}`, order: { x: originalArea.left, y: originalArea.top }, width, height: groupTop + groupHeight, nodes: result };
}

export function organizeCanvasNodes(nodes: CanvasNodeData[]): CanvasNodeData[] {
    if (nodes.length < 2) return nodes;
    const assigned = new Set<string>();
    const items: LayoutItem[] = [];
    const clipIds = [...new Set(nodes.map((node) => node.metadata?.dramaClipId).filter((id): id is string => Boolean(id)))];

    for (const clipId of clipIds) {
        const members = nodes.filter((node) => node.metadata?.dramaClipId === clipId);
        const item = buildClipItem(clipId, members);
        if (!item) continue;
        item.nodes.forEach((node) => assigned.add(node.id));
        items.push(item);
    }

    const byParent = new Map<string, CanvasNodeData[]>();
    nodes.forEach((node) => {
        const parentId = node.metadata?.groupId;
        if (parentId) byParent.set(parentId, [...(byParent.get(parentId) || []), node]);
    });
    for (const node of nodes) {
        if (assigned.has(node.id) || node.metadata?.groupId) continue;
        const descendants: CanvasNodeData[] = [];
        const visit = (parentId: string) =>
            (byParent.get(parentId) || []).forEach((child) => {
                if (assigned.has(child.id)) return;
                descendants.push(child);
                assigned.add(child.id);
                visit(child.id);
            });
        assigned.add(node.id);
        visit(node.id);
        const itemNodes = [node, ...descendants];
        const area = bounds(itemNodes);
        items.push({ key: `node:${node.id}`, order: node.position, width: area.width, height: area.height, nodes: moveNodes(itemNodes, 0, 0) });
    }

    for (const node of nodes) {
        if (assigned.has(node.id)) continue;
        assigned.add(node.id);
        items.push({ key: `orphan:${node.id}`, order: node.position, width: node.width, height: node.height, nodes: [{ ...node, position: { x: 0, y: 0 } }] });
    }

    items.sort((a, b) => a.order.y - b.order.y || a.order.x - b.order.x || a.key.localeCompare(b.key));
    const columns = Math.min(MAX_COLUMNS, Math.max(1, items.length));
    const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(0, ...items.filter((_, index) => index % columns === column).map((item) => item.width)));
    const rows = Math.ceil(items.length / columns);
    const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(0, ...items.slice(row * columns, (row + 1) * columns).map((item) => item.height)));
    const originX = Math.min(...nodes.map((node) => node.position.x));
    const originY = Math.min(...nodes.map((node) => node.position.y));
    const positions = new Map<string, CanvasNodeData>();
    let y = originY;
    for (let row = 0; row < rows; row += 1) {
        let x = originX;
        for (let column = 0; column < columns; column += 1) {
            const item = items[row * columns + column];
            if (item) moveNodes(item.nodes, x, y).forEach((node) => positions.set(node.id, node));
            x += columnWidths[column] + ITEM_GAP;
        }
        y += rowHeights[row] + ITEM_GAP;
    }
    return nodes.map((node) => positions.get(node.id) || node);
}

export function fitViewportToNodes(nodes: CanvasNodeData[], width: number, height: number): ViewportTransform {
    if (!nodes.length || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, k: 1 };
    const area = bounds(nodes);
    const padding = 48;
    const k = Math.min(1, Math.max(0.05, Math.min((width - padding * 2) / Math.max(1, area.width), (height - padding * 2) / Math.max(1, area.height))));
    return { x: width / 2 - (area.left + area.width / 2) * k, y: height / 2 - (area.top + area.height / 2) * k, k };
}
