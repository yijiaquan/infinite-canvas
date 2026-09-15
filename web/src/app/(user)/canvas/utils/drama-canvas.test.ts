import assert from "node:assert/strict";
import test from "node:test";
import { prepareDramaClipNodes, dramaAncestorIds, dramaDisplayNode, expandDramaAncestors, findDramaClipStageNode, isDramaNodeHidden, previewDramaClipRepair, applyDramaClipRepair, repairDramaClipGroupLayout } from "./drama-canvas";
import { CanvasNodeType } from "../types";

const clips = [
    { id: "clip-2", title: "Second", position: 2, archived: false },
    { id: "clip-1", title: "First", position: 1, archived: false },
    { id: "archived", title: "Archived", position: 3, archived: true },
];

test("collapsed groups hide descendants without changing stored dimensions or positions", () => {
    const { nodes } = prepareDramaClipNodes([], [], [clips[1]]);
    const before = structuredClone(nodes);
    assert.equal(nodes[0].metadata?.dramaCollapsed, true);
    assert.equal(isDramaNodeHidden(nodes[0], nodes), false);
    assert.equal(isDramaNodeHidden(nodes[1], nodes), true);
    assert.equal(isDramaNodeHidden(nodes[2], nodes), true);
    assert.equal(dramaDisplayNode(nodes[0]).width, 320);
    assert.equal(dramaDisplayNode(nodes[0]).height, 96);
    assert.deepEqual(nodes, before);
    const expanded = expandDramaAncestors(nodes, nodes[1].id);
    assert.equal(isDramaNodeHidden(expanded[1], expanded), false);
    assert.equal(dramaDisplayNode(expanded[0]).width, before[0].width);
    assert.equal(dramaDisplayNode(expanded[0]).height, before[0].height);
    expanded.forEach((node, index) => assert.deepEqual(node.position, before[index].position));
});

test("ancestor expansion handles nested groups and terminates on malformed cycles", () => {
    const first = prepareDramaClipNodes([], [], clips).nodes;
    const nodes = first.map((node) => (node.id === first[3].id ? { ...node, metadata: { ...node.metadata, groupId: first[0].id } } : node));
    assert.deepEqual(dramaAncestorIds(nodes[4], nodes), [nodes[3].id, nodes[0].id]);
    assert.equal(isDramaNodeHidden(nodes[4], nodes), true);
    const expanded = expandDramaAncestors(nodes, nodes[4].id);
    assert.equal(expanded[0].metadata?.dramaCollapsed, false);
    assert.equal(expanded[3].metadata?.dramaCollapsed, false);
    assert.equal(isDramaNodeHidden(expanded[4], expanded), false);
    const cyclic = nodes.map((node) => (node.id === nodes[0].id ? { ...node, metadata: { ...node.metadata, groupId: nodes[3].id } } : node));
    assert.deepEqual(dramaAncestorIds(cyclic[0], cyclic), [cyclic[3].id]);
    assert.equal(dramaAncestorIds(cyclic[4], cyclic).length, 2);
    assert.equal(isDramaNodeHidden(cyclic[4], cyclic), true);
    assert.equal(expandDramaAncestors(cyclic, cyclic[4].id).length, cyclic.length);
});

test("creates ordered groups with only actual storyboard inputs and no generation overrides", () => {
    const result = prepareDramaClipNodes([], [], clips);
    assert.deepEqual(result.createdClipIds, ["clip-1", "clip-2"]);
    assert.equal(result.nodes.length, 6);
    assert.equal(result.connections.length, 2);
    for (const clipId of result.createdClipIds) {
        const group = result.nodes.find((node) => node.metadata?.dramaClipId === clipId && node.type === "group")!;
        const board = result.nodes.find((node) => node.metadata?.dramaClipId === clipId && node.type === "image")!;
        const video = result.nodes.find((node) => node.metadata?.dramaClipId === clipId && node.type === "video")!;
        assert.equal(board.metadata?.groupId, group.id);
        assert.equal(video.metadata?.groupId, group.id);
        assert.ok(result.connections.some((edge) => edge.fromNodeId === board.id && edge.toNodeId === video.id));
        assert.ok(!result.connections.some((edge) => edge.fromNodeId === group.id || edge.toNodeId === group.id));
        for (const node of [board, video]) {
            assert.equal(node.metadata?.excludeUpstreamText, true);
            for (const key of ["prompt", "content", "model", "seconds", "size", "steps"]) assert.ok(!(key in node.metadata!));
            assert.ok(node.position.x >= group.position.x && node.position.x + node.width <= group.position.x + group.width);
            assert.ok(node.position.y >= group.position.y && node.position.y + node.height <= group.position.y + group.height);
        }
    }
});

test("repeated preparation is idempotent and preserves manual edits and layout", () => {
    const first = prepareDramaClipNodes([], [], clips);
    first.nodes[1] = { ...first.nodes[1], title: "Hand edited", position: { x: -40, y: 75 }, metadata: { ...first.nodes[1].metadata, prompt: "Keep this" } };
    const snapshot = structuredClone(first);
    const second = prepareDramaClipNodes(first.nodes, first.connections, clips);
    assert.deepEqual(second.nodes, snapshot.nodes);
    assert.equal(second.nodes, first.nodes);
    assert.equal(second.connections, first.connections);
    assert.deepEqual(second.createdClipIds, []);
    assert.deepEqual(second.existingClipIds, ["clip-1", "clip-2"]);
});

test("explicit group layout repair shrinks only the group and unparents legacy references", () => {
    const first = prepareDramaClipNodes([], [], [clips[1]]);
    const group = first.nodes[0];
    const legacyReference = { id: "legacy-reference", type: CanvasNodeType.Image, title: "Reference", position: { x: 999, y: 19650 }, width: 220, height: 140, metadata: { dramaClipId: "clip-1", dramaRole: "reference" as const, groupId: group.id } };
    const beforePositions = first.nodes.map((node) => ({ id: node.id, position: structuredClone(node.position) }));
    const repaired = repairDramaClipGroupLayout([{ ...group, height: 19710 }, ...first.nodes.slice(1), legacyReference], ["clip-1"]);
    const repairedGroup = repaired.nodes.find((node) => node.id === group.id)!;
    const repairedReference = repaired.nodes.find((node) => node.id === legacyReference.id)!;

    assert.equal(repairedGroup.height, 300);
    assert.equal(repairedReference.metadata?.groupId, undefined);
    for (const before of beforePositions) assert.deepEqual(repaired.nodes.find((node) => node.id === before.id)?.position, before.position);
    assert.deepEqual(repairedReference.position, legacyReference.position);
});

test("workbench resolution prefers the current formal Clip node over historical duplicates", () => {
    const prepared = prepareDramaClipNodes([], [], [clips[1]]);
    const formal = prepared.nodes.find((node) => node.id === "drama:clip-1:video")!;
    const historical = { ...formal, id: "historical-video", metadata: { ...formal.metadata, prompt: "old prompt" } };
    const edited = { ...formal, metadata: { ...formal.metadata, prompt: "current canvas prompt" } };
    const nodes = [historical, ...prepared.nodes.map((node) => (node.id === formal.id ? edited : node))];

    assert.equal(findDramaClipStageNode(nodes, "clip-1", "video")?.id, formal.id);
    assert.equal(findDramaClipStageNode(nodes, "clip-1", "video")?.metadata?.prompt, "current canvas prompt");
});

test("batch preview has no side effects and reordered preparation preserves stable IDs and layout", () => {
    const initial = prepareDramaClipNodes([], [], [clips[1]]);
    initial.nodes[0].position = { x: -200, y: 90 };
    const before = structuredClone(initial);
    const reordered = clips.map((clip) => ({ ...clip, position: 4 - clip.position }));
    const preview = prepareDramaClipNodes(initial.nodes, initial.connections, reordered);
    assert.deepEqual(initial, before);
    assert.deepEqual(preview.createdClipIds, ["clip-2"]);
    assert.deepEqual(preview.existingClipIds, ["clip-1"]);
    assert.deepEqual(preview.nodes.slice(0, initial.nodes.length), before.nodes);
    const applied = prepareDramaClipNodes(initial.nodes, initial.connections, reordered);
    assert.deepEqual(applied, preview);
    const repeat = prepareDramaClipNodes(applied.nodes, applied.connections, reordered);
    assert.equal(repeat.nodes, applied.nodes);
    assert.equal(repeat.connections, applied.connections);
});

test("partial deletion, deleted edges and deleted prepared groups require repair", () => {
    const first = prepareDramaClipNodes([], [], [clips[1]]);
    const fragments = prepareDramaClipNodes(first.nodes.slice(1), first.connections, [clips[1]]);
    assert.deepEqual(fragments.missingClipIds, ["clip-1"]);
    assert.equal(fragments.nodes.length, 2);
    assert.deepEqual(prepareDramaClipNodes(first.nodes, [], [clips[1]]).missingClipIds, ["clip-1"]);
    assert.deepEqual(prepareDramaClipNodes([], [], [clips[1]], ["clip-1"]).missingClipIds, ["clip-1"]);
    assert.deepEqual(prepareDramaClipNodes([], first.connections, [clips[1]]).missingClipIds, ["clip-1"]);
});

test("new groups are outside existing bounds and ID collisions never overwrite nodes", () => {
    const first = prepareDramaClipNodes([], [], [clips[1]]);
    const right = Math.max(...first.nodes.map((node) => node.position.x + node.width));
    const second = prepareDramaClipNodes(first.nodes, first.connections, [clips[0]]);
    assert.ok(second.nodes.slice(first.nodes.length).every((node) => node.position.x >= right + 120));
    const unrelated = [{ ...first.nodes[0], metadata: {} }];
    const collision = prepareDramaClipNodes(unrelated, [], [clips[1]]);
    assert.deepEqual(collision.missingClipIds, ["clip-1"]);
    assert.equal(collision.nodes, unrelated);
    assert.deepEqual(prepareDramaClipNodes([], [], [clips[1], clips[1]]).createdClipIds, ["clip-1"]);
});

test("batch preparation packs new Clip groups into a compact grid without moving existing nodes", () => {
    const batch = Array.from({ length: 27 }, (_, index) => ({ id: `clip-${index + 1}`, title: `Clip ${index + 1}`, position: index + 1, archived: false }));
    const existing = [{ id: "asset", type: CanvasNodeType.Image, title: "Asset", position: { x: -600, y: -120 }, width: 420, height: 240, metadata: {} }];
    const before = structuredClone(existing);
    const prepared = prepareDramaClipNodes(existing, [], batch);
    const groups = prepared.nodes.filter((node) => node.metadata?.dramaRole === "group");

    assert.deepEqual(prepared.nodes[0], before[0]);
    assert.equal(groups.length, 27);
    assert.equal(new Set(groups.map((group) => `${group.position.x}:${group.position.y}`)).size, groups.length);
    assert.ok(groups.every((group) => group.position.x >= -60));
    assert.equal(new Set(groups.map((group) => group.position.x)).size, 4);
    assert.equal(new Set(groups.map((group) => group.position.y)).size, 7);
    assert.ok(Math.max(...groups.map((group) => group.position.y)) < 2_000);
});

test("repair preview lists missing parts and explicit application restores only selected parts", () => {
    const first = prepareDramaClipNodes([], [], [clips[1]]);
    const groupOnly = [first.nodes[0]];
    const before = structuredClone(groupOnly);
    const preview = previewDramaClipRepair(groupOnly, [], [clips[1]]);
    assert.deepEqual(
        preview.clips[0].parts.map((item) => item.part),
        ["storyboard", "video", "link"],
    );
    assert.deepEqual(preview.clips[0].blockedReasons, []);
    assert.deepEqual(groupOnly, before);
    const applied = applyDramaClipRepair(groupOnly, [], [clips[1]], preview, [{ clipId: "clip-1", parts: ["storyboard"] }]);
    assert.equal(applied.nodes.length, 2);
    assert.equal(applied.nodes[0], groupOnly[0]);
    assert.equal(applied.nodes[1].id, first.nodes[1].id);
    assert.equal(applied.connections.length, 0);
    assert.equal(previewDramaClipRepair(applied.nodes, [], [clips[1]]).clips[0].parts.length, 2);
    assert.throws(() => applyDramaClipRepair(groupOnly, [], [clips[1]], preview, [{ clipId: "clip-1", parts: ["link"] }]));
    assert.throws(() => applyDramaClipRepair(applied.nodes, [], [clips[1]], preview, [{ clipId: "clip-1", parts: ["storyboard"] }]));
});

test("restoring a deleted group preserves surviving custom IDs, positions, prompts and edge IDs", () => {
    const first = prepareDramaClipNodes([], [], [clips[1]]);
    const survivors = first.nodes.slice(1).map((node, index) => ({ ...node, id: `custom-${index}`, position: { x: 1200 + index * 500, y: -300 }, metadata: { ...node.metadata, groupId: "custom-group", prompt: "hand-edited", content: "kept-media" } }));
    const edges = [{ id: "custom-edge", fromNodeId: "custom-0", toNodeId: "custom-1" }];
    const before = structuredClone(survivors);
    const preview = previewDramaClipRepair(survivors, edges, [clips[1]]);
    assert.deepEqual(
        preview.clips[0].parts.map((item) => item.part),
        ["group"],
    );
    const applied = applyDramaClipRepair(survivors, edges, [clips[1]], preview, [{ clipId: "clip-1", parts: ["group"] }]);
    assert.deepEqual(applied.nodes.slice(0, 2), before);
    assert.equal(applied.nodes[2].id, "custom-group");
    assert.equal(applied.connections, edges);
    assert.deepEqual(prepareDramaClipNodes(applied.nodes, edges, [clips[1]]).existingClipIds, ["clip-1"]);
});

test("complete deletion requires choosing parent and endpoints and never invents media or prompts", () => {
    const preview = previewDramaClipRepair([], [], [clips[1]]);
    assert.deepEqual(
        preview.clips[0].parts.map((item) => item.part),
        ["group", "storyboard", "video", "link"],
    );
    assert.throws(() => applyDramaClipRepair([], [], [clips[1]], preview, [{ clipId: "clip-1", parts: ["storyboard"] }]));
    const applied = applyDramaClipRepair([], [], [clips[1]], preview, [{ clipId: "clip-1", parts: ["group", "storyboard", "video", "link"] }]);
    assert.equal(applied.nodes.length, 3);
    assert.equal(applied.connections.length, 1);
    for (const node of applied.nodes) {
        assert.equal(node.metadata?.prompt, undefined);
        assert.equal(node.metadata?.content, undefined);
    }
    assert.deepEqual(previewDramaClipRepair(applied.nodes, applied.connections, [clips[1]]).clips[0].parts, []);
});

test("repair rejects duplicate roles, foreign ID collisions and changed structure without mutation", () => {
    const first = prepareDramaClipNodes([], [], [clips[1]]);
    const fragments = first.nodes.slice(0, 2);
    const preview = previewDramaClipRepair(fragments, [], [clips[1]]);
    const cases = [[...fragments, { ...fragments[1], id: "duplicate-board" }], [...fragments, { ...first.nodes[2], metadata: {} }], fragments.map((node) => (node.type === "image" ? { ...node, metadata: { ...node.metadata, groupId: "foreign" } } : node))];
    for (const nodes of cases) {
        const before = structuredClone(nodes);
        assert.ok(previewDramaClipRepair(nodes, [], [clips[1]]).clips[0].blockedReasons.length);
        assert.throws(() => applyDramaClipRepair(nodes, [], [clips[1]], preview, [{ clipId: "clip-1", parts: ["video", "link"] }]));
        assert.deepEqual(nodes, before);
    }
    const moved = fragments.map((node) => ({ ...node, position: { x: node.position.x + 100, y: node.position.y } }));
    assert.throws(() => applyDramaClipRepair(moved, [], [clips[1]], preview, [{ clipId: "clip-1", parts: ["video", "link"] }]));
    assert.throws(() => applyDramaClipRepair(fragments, [], [{ ...clips[1], archived: true }], preview, [{ clipId: "clip-1", parts: ["video"] }]));
});

test("repair preserves dangling stable edges and restores a missing node with its original ID", () => {
    const first = prepareDramaClipNodes([], [], [clips[1]]);
    const fragments = [first.nodes[0], first.nodes[2]];
    const edge = { ...first.connections[0], fromNodeId: "custom-deleted-board" };
    const preview = previewDramaClipRepair(fragments, [edge], [clips[1]]);
    assert.deepEqual(
        preview.clips[0].parts.map((item) => item.part),
        ["storyboard"],
    );
    assert.equal(preview.clips[0].parts[0].node?.id, "custom-deleted-board");
    const applied = applyDramaClipRepair(fragments, [edge], [clips[1]], preview, [{ clipId: "clip-1", parts: ["storyboard"] }]);
    assert.equal(applied.connections[0], edge);
    assert.deepEqual(prepareDramaClipNodes(applied.nodes, applied.connections, [clips[1]]).existingClipIds, ["clip-1"]);
});

test("link-only repair leaves every node unchanged and rejects conflicting or duplicate edge IDs", () => {
    const first = prepareDramaClipNodes([], [], [clips[1]]);
    const preview = previewDramaClipRepair(first.nodes, [], [clips[1]]);
    assert.deepEqual(
        preview.clips[0].parts.map((item) => item.part),
        ["link"],
    );
    const applied = applyDramaClipRepair(first.nodes, [], [clips[1]], preview, [{ clipId: "clip-1", parts: ["link"] }]);
    assert.equal(applied.nodes, first.nodes);
    const duplicate = [first.connections[0], { ...first.connections[0], id: "duplicate-link" }];
    assert.ok(previewDramaClipRepair(first.nodes, duplicate, [clips[1]]).clips[0].blockedReasons.length);
    const collision = [{ ...first.connections[0], toNodeId: "other-video" }];
    assert.ok(previewDramaClipRepair(first.nodes, collision, [clips[1]]).clips[0].blockedReasons.length);
});
