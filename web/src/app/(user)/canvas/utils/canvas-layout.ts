import { CanvasNodeType, type CanvasNodeData, type ViewportTransform } from "../types";

const ITEM_GAP = 120;
const CLIP_GROUP_PADDING = 24;
const CLIP_GROUP_HEADER = 60;
const CLIP_GROUP_WIDTH = 740;
const CLIP_CATEGORY = "clip" as const;
const CATEGORY_ORDER = [CanvasNodeType.Image, CanvasNodeType.Panorama, CanvasNodeType.Text, CanvasNodeType.Config, CanvasNodeType.Video, CanvasNodeType.Audio, CanvasNodeType.Director, CanvasNodeType.Group, CLIP_CATEGORY] as const;
const naturalCollator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

type LayoutCategory = CanvasNodeType | typeof CLIP_CATEGORY;

type LayoutItem = {
    key: string;
    category: LayoutCategory;
    label: string;
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

function compareClipItems(a: LayoutItem, b: LayoutItem) {
    const aNumber = a.label.match(/\d+/u)?.[0];
    const bNumber = b.label.match(/\d+/u)?.[0];
    if (aNumber && bNumber) return Number(aNumber) - Number(bNumber) || naturalCollator.compare(a.label, b.label) || a.key.localeCompare(b.key);
    if (aNumber || bNumber) return aNumber ? -1 : 1;
    return a.order.y - b.order.y || a.order.x - b.order.x || a.key.localeCompare(b.key);
}

function buildClipItem(clipId: string, members: CanvasNodeData[]): LayoutItem | null {
    const group = members.find((node) => node.type === CanvasNodeType.Group && node.metadata?.dramaRole === "group");
    const board = members.find((node) => node.metadata?.dramaRole === "storyboard");
    const video = members.find((node) => node.metadata?.dramaRole === "video");
    if (!group || !board || !video) return null;

    const groupHeight = CLIP_GROUP_HEADER + Math.max(board.height, video.height) + CLIP_GROUP_PADDING;
    const result: CanvasNodeData[] = [
        { ...group, position: { x: 0, y: 0 }, width: CLIP_GROUP_WIDTH, height: groupHeight },
        { ...board, position: { x: CLIP_GROUP_PADDING, y: CLIP_GROUP_HEADER }, metadata: { ...board.metadata, groupId: group.id } },
        { ...video, position: { x: CLIP_GROUP_WIDTH - CLIP_GROUP_PADDING - video.width, y: CLIP_GROUP_HEADER }, metadata: { ...video.metadata, groupId: group.id } },
    ];
    const originalArea = bounds(result.map((node) => members.find((member) => member.id === node.id) || node));
    return { key: `clip:${clipId}`, category: CLIP_CATEGORY, label: group.title, order: { x: originalArea.left, y: originalArea.top }, width: CLIP_GROUP_WIDTH, height: groupHeight, nodes: result };
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

    for (const node of nodes) {
        if (assigned.has(node.id) || node.metadata?.dramaRole !== "reference") continue;
        const { groupId: _groupId, ...metadata } = node.metadata || {};
        assigned.add(node.id);
        items.push({ key: `reference:${node.id}`, category: node.type, label: node.title, order: node.position, width: node.width, height: node.height, nodes: [{ ...node, position: { x: 0, y: 0 }, metadata }] });
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
        items.push({ key: `node:${node.id}`, category: node.type, label: node.title, order: node.position, width: area.width, height: area.height, nodes: moveNodes(itemNodes, 0, 0) });
    }

    for (const node of nodes) {
        if (assigned.has(node.id)) continue;
        assigned.add(node.id);
        items.push({ key: `orphan:${node.id}`, category: node.type, label: node.title, order: node.position, width: node.width, height: node.height, nodes: [{ ...node, position: { x: 0, y: 0 } }] });
    }

    const originX = Math.min(...nodes.map((node) => node.position.x));
    const originY = Math.min(...nodes.map((node) => node.position.y));
    const positions = new Map<string, CanvasNodeData>();
    let x = originX;
    for (const category of CATEGORY_ORDER) {
        const column = items.filter((item) => item.category === category);
        if (!column.length) continue;
        column.sort((a, b) => (category === CLIP_CATEGORY ? compareClipItems(a, b) : a.order.y - b.order.y || a.order.x - b.order.x || a.key.localeCompare(b.key)));
        let y = originY;
        for (const item of column) {
            moveNodes(item.nodes, x, y).forEach((node) => positions.set(node.id, node));
            y += item.height + ITEM_GAP;
        }
        x += Math.max(...column.map((item) => item.width)) + ITEM_GAP;
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
