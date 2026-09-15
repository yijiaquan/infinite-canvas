import type { DramaClip } from "@/services/api/drama";
import type { CanvasConnection, CanvasNodeData, CanvasNodeType } from "../types";

type ClipSummary = Pick<DramaClip, "id" | "title" | "position" | "archived">;

export const DRAMA_CLIP_GROUP_WIDTH = 740;
export const DRAMA_CLIP_GROUP_HEIGHT = 300;
export const DRAMA_CLIP_COLUMN_GAP = 64;
export const DRAMA_CLIP_ROW_GAP = 48;
const MAX_DRAMA_CLIP_COLUMNS = 4;

function dramaClipColumnCount(count: number): number {
    if (count <= 1) return 1;
    // 展开后的 Clip 分组较宽，用少量列替代单条纵向长带，同时保持批次接近方形。
    return Math.min(MAX_DRAMA_CLIP_COLUMNS, Math.max(1, Math.ceil(Math.sqrt((count * DRAMA_CLIP_GROUP_HEIGHT) / DRAMA_CLIP_GROUP_WIDTH))));
}

export type DramaRepairPart = "group" | "storyboard" | "video" | "link";
export type DramaRepairSelection = { clipId: string; parts: DramaRepairPart[] };
export type DramaClipRepairPlan = {
    clipId: string;
    title: string;
    parts: { part: DramaRepairPart; requires: DramaRepairPart[]; node?: CanvasNodeData; connection?: CanvasConnection }[];
    blockedReasons: string[];
};
export type DramaRepairPreview = { clips: DramaClipRepairPlan[] };

export function previewDramaClipRepair(nodes: CanvasNodeData[], connections: CanvasConnection[], clips: ClipSummary[]): DramaRepairPreview {
    const preview: DramaRepairPreview = { clips: [] };
    const occupied = [...nodes];
    const clipIds = new Set<string>();
    for (const clip of [...clips].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))) {
        if (clip.archived) continue;
        const plan: DramaClipRepairPlan = { clipId: clip.id, title: clip.title, parts: [], blockedReasons: [] };
        preview.clips.push(plan);
        if (clipIds.has(clip.id)) {
            plan.blockedReasons.push("Clip ID 重复");
            continue;
        }
        clipIds.add(clip.id);
        const prefix = `drama:${encodeURIComponent(clip.id)}`;
        const defaults = { group: `${prefix}:group`, storyboard: `${prefix}:storyboard`, video: `${prefix}:video`, link: `${prefix}:storyboard-video` };
        const members = nodes.filter((node) => node.metadata?.dramaClipId === clip.id);
        const existing: Partial<Record<"group" | "storyboard" | "video", CanvasNodeData>> = {};
        for (const [role, type] of [
            ["group", "group"],
            ["storyboard", "image"],
            ["video", "video"],
        ] as const) {
            const matches = members.filter((node) => node.metadata?.dramaRole === role);
            if (matches.length > 1 || matches.some((node) => node.type !== type)) plan.blockedReasons.push(`${role} 节点重复或类型不匹配`);
            existing[role] = matches[0];
        }
        const canonicalLinks = connections.filter((edge) => edge.id === defaults.link);
        if (canonicalLinks.length > 1) plan.blockedReasons.push("故事板视频连线 ID 重复");
        const canonicalLink = canonicalLinks[0];
        const parentIds = [...new Set([existing.storyboard?.metadata?.groupId, existing.video?.metadata?.groupId].filter((id): id is string => !!id))];
        if (parentIds.length > 1) plan.blockedReasons.push("现有节点属于不同分组");
        const ids = {
            group: existing.group?.id || parentIds[0] || defaults.group,
            storyboard: existing.storyboard?.id || canonicalLink?.fromNodeId || defaults.storyboard,
            video: existing.video?.id || canonicalLink?.toNodeId || defaults.video,
        };
        if (new Set(Object.values(ids)).size !== 3) plan.blockedReasons.push("节点 ID 相互冲突");
        for (const role of ["group", "storyboard", "video"] as const) {
            const matches = occupied.filter((node) => node.id === ids[role]);
            if (matches.length > 1 || (matches.length === 1 && matches[0] !== existing[role])) plan.blockedReasons.push(`${role} 的恢复 ID 已被其他节点占用`);
        }
        for (const role of ["storyboard", "video"] as const) {
            if (existing[role] && existing[role]?.metadata?.groupId !== ids.group) plan.blockedReasons.push(`${role} 的现有分组关系不一致，不能自动修复`);
        }
        if (canonicalLink && (canonicalLink.fromNodeId !== ids.storyboard || canonicalLink.toNodeId !== ids.video)) plan.blockedReasons.push("原连线 ID 已被其他连接占用");
        const links = connections.filter((edge) => edge.fromNodeId === ids.storyboard && edge.toNodeId === ids.video);
        if (links.length > 1 || links.some((edge) => connections.filter((item) => item.id === edge.id).length > 1)) plan.blockedReasons.push("故事板与视频之间存在重复连线");
        const survivors = [existing.storyboard, existing.video].filter((node): node is CanvasNodeData => !!node);
        const left = existing.group?.position.x ?? (survivors.length ? Math.min(...survivors.map((node) => node.position.x)) - 24 : occupied.length ? Math.max(...occupied.map((node) => node.position.x + node.width)) + 120 : 0);
        const top = existing.group?.position.y ?? (survivors.length ? Math.min(...survivors.map((node) => node.position.y)) - 60 : occupied.length ? Math.min(...occupied.map((node) => node.position.y)) : 0);
        const metadata = { dramaClipId: clip.id, excludeUpstreamText: true };
        const children: CanvasNodeData[] = [];
        for (const [role, type, offset, label] of [
            ["storyboard", "image", 24, "导演故事板"],
            ["video", "video", 396, "视频"],
        ] as const) {
            if (existing[role]) continue;
            const node: CanvasNodeData = {
                id: ids[role],
                type: type as CanvasNodeType,
                title: `${clip.title} · ${label}`,
                position: { x: left + offset, y: top + 60 },
                width: 320,
                height: 180,
                metadata: { ...metadata, dramaRole: role, groupId: ids.group, status: "idle", generationMode: type },
            };
            // 只安排新增节点的位置，不挪动已存在的画布内容。
            const others = [...occupied, ...children].filter((item) => item.type !== "group");
            let collision: CanvasNodeData | undefined;
            while (
                (collision = others.find(
                    (item) => node.position.x < item.position.x + item.width + 24 && node.position.x + node.width + 24 > item.position.x && node.position.y < item.position.y + item.height + 24 && node.position.y + node.height + 24 > item.position.y,
                ))
            ) {
                node.position.x = collision.position.x + collision.width + 24;
            }
            children.push(node);
            plan.parts.push({ part: role, requires: existing.group ? [] : ["group"], node });
        }
        if (!existing.group) {
            const bounds = [...survivors, ...children];
            const node: CanvasNodeData = {
                id: ids.group,
                type: "group" as CanvasNodeType,
                title: clip.title,
                position: { x: left, y: top },
                width: Math.max(740, ...bounds.map((child) => child.position.x + child.width - left + 24)),
                height: Math.max(300, ...bounds.map((child) => child.position.y + child.height - top + 24)),
                metadata: { ...metadata, dramaRole: "group", dramaCollapsed: true },
            };
            plan.parts.unshift({ part: "group", requires: [], node });
        }
        if (!links.length) plan.parts.push({ part: "link", requires: (["storyboard", "video"] as const).filter((role) => !existing[role]), connection: { id: defaults.link, fromNodeId: ids.storyboard, toNodeId: ids.video } });
        if (!plan.blockedReasons.length) occupied.push(...plan.parts.flatMap((part) => (part.node ? [part.node] : [])));
    }
    return preview;
}

export function applyDramaClipRepair(
    nodes: CanvasNodeData[],
    connections: CanvasConnection[],
    clips: ClipSummary[],
    preview: DramaRepairPreview,
    selections: DramaRepairSelection[],
): { nodes: CanvasNodeData[]; connections: CanvasConnection[]; repairedClipIds: string[] } {
    const fresh = previewDramaClipRepair(nodes, connections, clips);
    const result = { nodes, connections, repairedClipIds: [] as string[] };
    const selectedClips = new Set<string>();
    for (const selection of selections) {
        if (selectedClips.has(selection.clipId)) throw new Error("重复选择了同一个 Clip");
        selectedClips.add(selection.clipId);
        if (!selection.parts.length) continue;
        const oldPlans = preview.clips.filter((plan) => plan.clipId === selection.clipId);
        const plans = fresh.clips.filter((plan) => plan.clipId === selection.clipId);
        if (oldPlans.length !== 1 || plans.length !== 1 || plans[0].blockedReasons.length || JSON.stringify(oldPlans[0]) !== JSON.stringify(plans[0])) throw new Error("修复预览已变化或存在冲突，请重新预览");
        const plan = plans[0];
        const chosen = new Set(selection.parts);
        if (chosen.size !== selection.parts.length || selection.parts.some((part) => !plan.parts.some((item) => item.part === part))) throw new Error("修复选择无效");
        for (const part of plan.parts.filter((item) => chosen.has(item.part))) {
            if (part.requires.some((required) => !chosen.has(required))) throw new Error("请同时选择缺失的分组或连接端点");
            if (part.node) result.nodes = [...result.nodes, part.node];
            if (part.connection) result.connections = [...result.connections, part.connection];
        }
        result.repairedClipIds.push(selection.clipId);
    }
    return result;
}

/**
 * Restore the visible bounds of explicit Clip groups without moving any node.
 * References are inputs, not group children; legacy group membership made
 * distant assets inflate the group height on every binding update.
 */
export function repairDramaClipGroupLayout(nodes: CanvasNodeData[], clipIds: string[]): { nodes: CanvasNodeData[]; repairedClipIds: string[] } {
    const requested = new Set(clipIds);
    if (!requested.size || requested.size !== clipIds.length) throw new Error("Clip 布局修复目标无效或重复");
    const updates = new Map<string, CanvasNodeData>();
    for (const clipId of requested) {
        const members = nodes.filter((node) => node.metadata?.dramaClipId === clipId);
        const groups = members.filter((node) => node.type === "group" && node.metadata?.dramaRole === "group");
        const formal = members.filter((node) => node.metadata?.dramaRole === "storyboard" || node.metadata?.dramaRole === "video");
        if (groups.length !== 1 || formal.length !== 2 || formal.some((node) => node.metadata?.groupId !== groups[0].id)) throw new Error(`Clip ${clipId} 的正式分组结构不完整，不能恢复布局`);
        const group = groups[0];
        const unexpectedChildren = nodes.filter((node) => node.metadata?.groupId === group.id && node.metadata?.dramaRole !== "storyboard" && node.metadata?.dramaRole !== "video" && node.metadata?.dramaRole !== "reference");
        if (unexpectedChildren.length) throw new Error(`Clip ${clipId} 含非正式分组成员，不能自动恢复布局`);
        const requiredHeight = Math.max(DRAMA_CLIP_GROUP_HEIGHT, ...formal.map((node) => node.position.y + node.height - group.position.y + 24));
        if (group.height !== requiredHeight) updates.set(group.id, { ...group, height: requiredHeight });
        for (const reference of nodes.filter((node) => node.metadata?.groupId === group.id && node.metadata?.dramaRole === "reference")) {
            const { groupId: _legacyGroupId, ...metadata } = reference.metadata || {};
            updates.set(reference.id, { ...reference, metadata });
        }
    }
    return { nodes: updates.size ? nodes.map((node) => updates.get(node.id) || node) : nodes, repairedClipIds: [...requested] };
}

export function dramaAncestorIds(node: CanvasNodeData, nodes: CanvasNodeData[]): string[] {
    const byId = new Map(nodes.map((item) => [item.id, item]));
    const seen = new Set([node.id]);
    const ancestors: string[] = [];
    let id = node.metadata?.groupId;
    while (id && !seen.has(id)) {
        seen.add(id);
        const parent = byId.get(id);
        if (!parent || parent.type !== "group") break;
        ancestors.push(id);
        id = parent.metadata?.groupId;
    }
    return ancestors;
}

export function isDramaNodeHidden(node: CanvasNodeData, nodes: CanvasNodeData[]): boolean {
    const ancestors = new Set(dramaAncestorIds(node, nodes));
    return nodes.some((item) => ancestors.has(item.id) && item.metadata?.dramaRole === "group" && item.metadata.dramaCollapsed);
}

export function dramaDisplayNode(node: CanvasNodeData): CanvasNodeData {
    return node.type === "group" && node.metadata?.dramaRole === "group" && node.metadata.dramaCollapsed ? { ...node, width: 320, height: 96 } : node;
}

/**
 * Resolve a Clip's production node from its stable formal ID before considering
 * legacy nodes. This keeps the workbench bound to the canvas node users edit,
 * even when historical or duplicate nodes remain in the canvas.
 */
export function findDramaClipStageNode(nodes: CanvasNodeData[], clipId: string, stage: "storyboard" | "video"): CanvasNodeData | undefined {
    const type = stage === "storyboard" ? "image" : "video";
    const formalId = `drama:${encodeURIComponent(clipId)}:${stage}`;
    const formal = nodes.find((node) => node.id === formalId);
    if (formal?.type === type && formal.metadata?.dramaClipId === clipId && formal.metadata.dramaRole === stage) return formal;

    const legacy = nodes.filter((node) => node.type === type && node.metadata?.dramaClipId === clipId && node.metadata.dramaRole === stage);
    return legacy.length === 1 ? legacy[0] : undefined;
}

export function expandDramaAncestors(nodes: CanvasNodeData[], nodeId: string): CanvasNodeData[] {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return nodes;
    const ancestors = new Set(dramaAncestorIds(node, nodes));
    return nodes.map((item) => (ancestors.has(item.id) && item.metadata?.dramaCollapsed ? { ...item, metadata: { ...item.metadata, dramaCollapsed: false } } : item));
}
export type PreparedDramaNodes = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    createdClipIds: string[];
    existingClipIds: string[];
    missingClipIds: string[];
};

export function prepareDramaClipNodes(nodes: CanvasNodeData[], connections: CanvasConnection[], clips: ClipSummary[], preparedClipIds: string[] = []): PreparedDramaNodes {
    const result: PreparedDramaNodes = { nodes, connections, createdClipIds: [], existingClipIds: [], missingClipIds: [] };
    const prepared = new Set(preparedClipIds);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edgeIds = new Set(connections.map((edge) => edge.id));
    const seen = new Set<string>();
    const left = nodes.length ? Math.max(...nodes.map((node) => node.position.x + node.width)) + 120 : 0;
    const top = nodes.length ? Math.min(...nodes.map((node) => node.position.y)) : 0;
    const candidateCount = clips.filter((clip) => !clip.archived && !prepared.has(clip.id)).length;
    const columns = dramaClipColumnCount(candidateCount);
    let createdIndex = 0;

    for (const clip of [...clips].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))) {
        if (clip.archived || seen.has(clip.id)) continue;
        seen.add(clip.id);
        const prefix = `drama:${encodeURIComponent(clip.id)}`;
        const ids = { group: `${prefix}:group`, storyboard: `${prefix}:storyboard`, video: `${prefix}:video`, edge: `${prefix}:storyboard-video` };
        const members = nodes.filter((node) => node.metadata?.dramaClipId === clip.id);
        const groups = members.filter((node) => node.metadata?.dramaRole === "group" && node.type === "group");
        const boards = members.filter((node) => node.metadata?.dramaRole === "storyboard" && node.type === "image");
        const videos = members.filter((node) => node.metadata?.dramaRole === "video" && node.type === "video");
        const [group, board, video] = [groups[0], boards[0], videos[0]];
        if (groups.length === 1 && boards.length === 1 && videos.length === 1 && board.metadata?.groupId === group.id && video.metadata?.groupId === group.id && connections.some((edge) => edge.fromNodeId === board.id && edge.toNodeId === video.id)) {
            result.existingClipIds.push(clip.id);
            continue;
        }
        // A prior preparation or surviving fragment requires an explicit repair preview.
        if (
            prepared.has(clip.id) ||
            members.length ||
            [ids.group, ids.storyboard, ids.video].some((id) => nodeIds.has(id)) ||
            edgeIds.has(ids.edge) ||
            connections.some((edge) => [ids.group, ids.storyboard, ids.video].includes(edge.fromNodeId) || [ids.group, ids.storyboard, ids.video].includes(edge.toNodeId))
        ) {
            result.missingClipIds.push(clip.id);
            continue;
        }
        const metadata = { dramaClipId: clip.id, excludeUpstreamText: true };
        const column = createdIndex % columns;
        const row = Math.floor(createdIndex / columns);
        const groupLeft = left + column * (DRAMA_CLIP_GROUP_WIDTH + DRAMA_CLIP_COLUMN_GAP);
        const groupTop = top + row * (DRAMA_CLIP_GROUP_HEIGHT + DRAMA_CLIP_ROW_GAP);
        const created: CanvasNodeData[] = [
            { id: ids.group, type: "group" as CanvasNodeType, title: clip.title, position: { x: groupLeft, y: groupTop }, width: DRAMA_CLIP_GROUP_WIDTH, height: DRAMA_CLIP_GROUP_HEIGHT, metadata: { ...metadata, dramaRole: "group", dramaCollapsed: true } },
            {
                id: ids.storyboard,
                type: "image" as CanvasNodeType,
                title: `${clip.title} · 导演故事板`,
                position: { x: groupLeft + 24, y: groupTop + 60 },
                width: 320,
                height: 180,
                metadata: { ...metadata, dramaRole: "storyboard", groupId: ids.group, status: "idle", generationMode: "image" },
            },
            {
                id: ids.video,
                type: "video" as CanvasNodeType,
                title: `${clip.title} · 视频`,
                position: { x: groupLeft + 396, y: groupTop + 60 },
                width: 320,
                height: 180,
                metadata: { ...metadata, dramaRole: "video", groupId: ids.group, status: "idle", generationMode: "video" },
            },
        ];
        result.nodes = [...result.nodes, ...created];
        result.connections = [...result.connections, { id: ids.edge, fromNodeId: ids.storyboard, toNodeId: ids.video }];
        result.createdClipIds.push(clip.id);
        created.forEach((node) => nodeIds.add(node.id));
        edgeIds.add(ids.edge);
        createdIndex += 1;
    }
    return result;
}
