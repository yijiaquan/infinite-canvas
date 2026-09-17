import assert from "node:assert/strict";
import test from "node:test";
import { CanvasNodeType, type CanvasNodeData } from "../types";
import { applyDramaBindingNodes } from "./drama-binding-nodes";

const target: CanvasNodeData = { id: "video-target", type: CanvasNodeType.Video, title: "Video", position: { x: 600, y: 200 }, width: 320, height: 180, metadata: { dramaClipId: "clip", groupId: "clip-group", prompt: "manual prompt" } };
const image = { title: "Identity", assetId: "person", versionId: "version-1", storageId: "image-1", role: "character", order: 0 };
const voice = { title: "Voice", assetId: "voice", versionId: "voice-1", storageId: "audio-1", role: "voice", speaker: "Alice", order: 1 };

test("binding inputs stay outside the target group with fixed version and proper media type, repeated apply is idempotent", () => {
    const video = { title: "Previs", versionId: "previs-1", storageId: "video-1", role: "video_reference", order: 2 };
    const nodes = [target];
    const before = structuredClone(nodes);
    const first = applyDramaBindingNodes(nodes, [], target.id, [image, voice, video]);
    assert.deepEqual(nodes, before);
    assert.equal(first.nodes[0], target);
    assert.deepEqual(
        first.nodes.slice(1).map((node) => node.type),
        [CanvasNodeType.Image, CanvasNodeType.Audio, CanvasNodeType.Video],
    );
    for (const [index, node] of first.nodes.slice(1).entries()) {
        assert.equal(node.metadata?.groupId, undefined);
        assert.equal(node.metadata?.dramaClipId, undefined);
        assert.equal(node.metadata?.dramaBindingTarget, undefined);
        assert.equal(node.metadata?.dramaInputOrder, undefined);
        assert.equal(node.metadata?.dramaAssetVersionId, [image, voice, video][index].versionId);
        assert.equal(node.metadata?.storageKey, `server:${[image, voice, video][index].storageId}`);
        const edge = first.connections.find((edge) => edge.fromNodeId === node.id && edge.toNodeId === target.id);
        assert.equal(edge?.dramaInputOrder, index);
        assert.equal(edge?.dramaInputRole, [image, voice, video][index].role);
    }
    assert.deepEqual(applyDramaBindingNodes(first.nodes, first.connections, target.id, [image, voice, video]), first);
});

test("expression bindings project as image nodes and preserve their dedicated edge role", () => {
    const expression = { title: "Suppressed fear", assetId: "expression-state", versionId: "expression-v1", storageId: "expression-image", role: "expression", order: 0 };
    const result = applyDramaBindingNodes([target], [], target.id, [expression]);
    assert.equal(result.nodes[1].type, CanvasNodeType.Image);
    assert.equal(result.connections[0].dramaInputRole, "expression");
    assert.equal(result.connections[0].dramaInputOrder, 0);
});

test("distant legacy references never expand a Clip group during binding", () => {
    const group: CanvasNodeData = { id: "clip-group", type: CanvasNodeType.Group, title: "Clip", position: { x: 0, y: 0 }, width: 740, height: 300, metadata: { dramaClipId: "clip", dramaRole: "group" } };
    const groupedTarget = { ...target, position: { x: 396, y: 60 } };
    const legacyReference: CanvasNodeData = {
        id: "legacy-reference",
        type: CanvasNodeType.Image,
        title: "Legacy reference",
        position: { x: 1200, y: 19650 },
        width: 220,
        height: 140,
        metadata: { dramaClipId: "clip", dramaRole: "reference", groupId: group.id, dramaAssetVersionId: "legacy" },
    };
    const before = structuredClone([group, groupedTarget, legacyReference]);
    const applied = applyDramaBindingNodes(before, [], groupedTarget.id, [image]);
    const resultGroup = applied.nodes.find((node) => node.id === group.id)!;
    const resultLegacy = applied.nodes.find((node) => node.id === legacyReference.id)!;
    const added = applied.nodes.find((node) => node.metadata?.dramaAssetVersionId === image.versionId)!;

    assert.deepEqual(before, [group, groupedTarget, legacyReference]);
    assert.deepEqual({ position: resultGroup.position, width: resultGroup.width, height: resultGroup.height }, { position: group.position, width: 740, height: 300 });
    assert.deepEqual(resultLegacy.position, legacyReference.position);
    assert.equal(resultLegacy.metadata?.groupId, group.id);
    assert.equal(added.metadata?.groupId, undefined);
});

test("binding order changes preserve existing IDs, manual position, prompt and media", () => {
    const first = applyDramaBindingNodes([target], [], target.id, [image, voice]);
    first.nodes[1] = { ...first.nodes[1], title: "Hand renamed", position: { x: -900, y: -400 }, metadata: { ...first.nodes[1].metadata, content: "/chosen.png", prompt: "Keep exact" } };
    const before = structuredClone(first);
    const reordered = applyDramaBindingNodes(first.nodes, first.connections, target.id, [
        { ...voice, order: 0 },
        { ...image, order: 1 },
    ]);
    assert.deepEqual(first, before);
    assert.deepEqual(
        reordered.nodes.map((node) => node.id),
        first.nodes.map((node) => node.id),
    );
    assert.deepEqual(reordered.nodes[1].position, first.nodes[1].position);
    assert.equal(reordered.nodes[1].title, "Hand renamed");
    assert.equal(reordered.nodes[1].metadata?.prompt, "Keep exact");
    assert.equal(reordered.nodes[1].metadata?.content, "/chosen.png");
    assert.equal(reordered.connections.find((edge) => edge.fromNodeId === reordered.nodes[1].id)?.dramaInputOrder, 1);
    assert.equal(reordered.connections.find((edge) => edge.fromNodeId === reordered.nodes[2].id)?.dramaInputOrder, 0);
});

test("removing bindings retains media nodes and unrelated manual connections", () => {
    const first = applyDramaBindingNodes([target], [], target.id, [image, voice]);
    const manual = [
        { id: "manual-input", fromNodeId: "unrelated", toNodeId: target.id },
        { id: "manual-output", fromNodeId: first.nodes[1].id, toNodeId: "another-target" },
    ];
    const removed = applyDramaBindingNodes(first.nodes, [...first.connections, ...manual], target.id, []);
    assert.deepEqual(removed.nodes, first.nodes);
    assert.deepEqual(removed.connections, manual);
    assert.equal(removed.nodes[1].metadata?.content, "/api/files/image-1/content");
});

test("missing or non-drama target is a no-op", () => {
    const nodes = [{ ...target, metadata: {} }];
    const connections = [{ id: "manual", fromNodeId: "a", toNodeId: "b" }];
    for (const id of [target.id, "absent"]) {
        const result = applyDramaBindingNodes(nodes, connections, id, [image]);
        assert.equal(result.nodes, nodes);
        assert.equal(result.connections, connections);
    }
});

test("one Voice version uses a global node while binding edges retain distinct speakers", () => {
    const inputs = [voice, { ...voice, speaker: "Bob", order: 2 }];
    const applied = applyDramaBindingNodes([target], [], target.id, inputs);
    assert.equal(new Set(applied.nodes.map((node) => node.id)).size, 2);
    assert.equal(applied.nodes[1].id, "drama:reference:voice-1");
    assert.equal(applied.nodes[1].metadata?.dramaClipId, undefined);
    assert.deepEqual(applied.connections.map((edge) => edge.dramaInputSpeaker), ["Alice", "Bob"]);
    assert.deepEqual(applyDramaBindingNodes(applied.nodes, applied.connections, target.id, inputs), applied);
});

test("legacy per-Clip Voice copies are merged into one global node without losing speaker edges", () => {
    const secondTarget: CanvasNodeData = { ...target, id: "clip-two-video", metadata: { ...target.metadata, dramaClipId: "clip-two", groupId: "clip-two-group" } };
    const legacyVoice: CanvasNodeData = {
        id: "drama:clip:reference:voice-1:Alice",
        type: CanvasNodeType.Audio,
        title: "Voice",
        position: { x: -300, y: 120 },
        width: 220,
        height: 140,
        metadata: { dramaClipId: "clip", dramaRole: "reference", dramaAssetVersionId: "voice-1", content: "/api/files/audio-1/content", storageKey: "server:audio-1", status: "success" },
    };
    const legacyEdge = { id: "drama:binding:video-target:voice-1:voice:Alice", fromNodeId: legacyVoice.id, toNodeId: target.id, dramaAssetVersionId: "voice-1", dramaInputRole: "voice", dramaInputOrder: 1, dramaInputSpeaker: "Alice" };
    const result = applyDramaBindingNodes([target, secondTarget, legacyVoice], [legacyEdge], secondTarget.id, [{ ...voice, speaker: "Bob", order: 0 }]);
    const voices = result.nodes.filter((node) => node.metadata?.dramaAssetVersionId === "voice-1");
    assert.equal(voices.length, 1);
    assert.equal(voices[0].metadata?.dramaClipId, undefined);
    assert.deepEqual(result.connections.map((edge) => ({ from: edge.fromNodeId, target: edge.toNodeId, speaker: edge.dramaInputSpeaker })), [
        { from: voices[0].id, target: target.id, speaker: "Alice" },
        { from: voices[0].id, target: secondTarget.id, speaker: "Bob" },
    ]);
});

test("storyboard and video targets share the same asset node with target-specific edges", () => {
    const board = { ...target, id: "storyboard-target", type: CanvasNodeType.Image, metadata: { ...target.metadata, dramaRole: "storyboard" as const } };
    const first = applyDramaBindingNodes([target, board], [], board.id, [{ ...image, order: 3 }]);
    const shared = applyDramaBindingNodes(first.nodes, first.connections, target.id, [{ ...image, order: 0 }]);
    const referenceNodes = shared.nodes.filter((node) => node.metadata?.dramaRole === "reference");
    assert.equal(referenceNodes.length, 1);
    assert.deepEqual(
        shared.connections.map(({ fromNodeId, toNodeId, dramaInputOrder }) => ({ fromNodeId, toNodeId, dramaInputOrder })),
        [
            { fromNodeId: referenceNodes[0].id, toNodeId: board.id, dramaInputOrder: 3 },
            { fromNodeId: referenceNodes[0].id, toNodeId: target.id, dramaInputOrder: 0 },
        ],
    );
    const removedFromBoard = applyDramaBindingNodes(shared.nodes, shared.connections, board.id, []);
    assert.equal(removedFromBoard.nodes.filter((node) => node.metadata?.dramaRole === "reference").length, 1);
    assert.deepEqual(
        removedFromBoard.connections.map((edge) => edge.toNodeId),
        [target.id],
    );
});

test("registered canvas asset node connects directly to storyboard and video without a reference copy", () => {
    const source: CanvasNodeData = {
        id: "asset-source",
        type: CanvasNodeType.Image,
        title: "Project Look",
        position: { x: -400, y: 120 },
        width: 220,
        height: 140,
        metadata: {
            dramaAssetId: image.assetId,
            content: "/api/files/image-1/content",
            storageKey: `server:${image.storageId}`,
            status: "success",
        },
    };
    const board = { ...target, id: "storyboard-target", type: CanvasNodeType.Image, metadata: { ...target.metadata, dramaRole: "storyboard" as const } };
    const first = applyDramaBindingNodes([source, target, board], [], board.id, [{ ...image, order: 2 }]);
    const shared = applyDramaBindingNodes(first.nodes, first.connections, target.id, [{ ...image, order: 0 }]);

    assert.equal(shared.nodes.length, 3);
    assert.equal(shared.nodes.filter((node) => node.metadata?.dramaRole === "reference").length, 0);
    assert.equal(shared.nodes.find((node) => node.id === source.id)?.metadata?.dramaAssetVersionId, image.versionId);
    assert.deepEqual(
        shared.connections.map(({ fromNodeId, toNodeId, dramaInputOrder }) => ({ fromNodeId, toNodeId, dramaInputOrder })),
        [
            { fromNodeId: source.id, toNodeId: board.id, dramaInputOrder: 2 },
            { fromNodeId: source.id, toNodeId: target.id, dramaInputOrder: 0 },
        ],
    );
});

test("direct binding removes only an orphaned system reference copy", () => {
    const source: CanvasNodeData = {
        id: "asset-source",
        type: CanvasNodeType.Image,
        title: "Project Look",
        position: { x: -400, y: 120 },
        width: 220,
        height: 140,
        metadata: { dramaAssetId: image.assetId, storageKey: `server:${image.storageId}`, content: "/source.png", status: "success" },
    };
    const copy: CanvasNodeData = {
        ...source,
        id: `drama:reference:${image.versionId}`,
        metadata: { dramaRole: "reference", dramaAssetVersionId: image.versionId, storageKey: `server:${image.storageId}`, content: "/copy.png", status: "success" },
    };
    const oldBinding = { id: "old-binding", fromNodeId: copy.id, toNodeId: target.id, dramaAssetVersionId: image.versionId };
    const manual = { id: "manual", fromNodeId: "manual-source", toNodeId: "manual-target" };
    const result = applyDramaBindingNodes([source, copy, target], [oldBinding, manual], target.id, [image]);

    assert.deepEqual(
        result.nodes.map((node) => node.id),
        [source.id, target.id],
    );
    assert.equal(
        result.connections.some((edge) => edge.fromNodeId === source.id && edge.toNodeId === target.id),
        true,
    );
    assert.equal(result.connections.includes(manual), true);
});

test("different Clips share one image node while keeping target-specific binding metadata", () => {
    const clipTwoVideo: CanvasNodeData = {
        ...target,
        id: "clip-two-video",
        metadata: { ...target.metadata, dramaClipId: "clip-two", groupId: "clip-two-group" },
    };
    const clipTwoBoard: CanvasNodeData = {
        ...clipTwoVideo,
        id: "clip-two-board",
        type: CanvasNodeType.Image,
        metadata: { ...clipTwoVideo.metadata, dramaRole: "storyboard" },
    };
    const clipOneBoard: CanvasNodeData = { ...target, id: "clip-one-board", type: CanvasNodeType.Image, metadata: { ...target.metadata, dramaRole: "storyboard" } };
    let result = applyDramaBindingNodes([target, clipOneBoard, clipTwoVideo, clipTwoBoard], [], clipOneBoard.id, [{ ...image, role: "character", order: 2 }]);
    result = applyDramaBindingNodes(result.nodes, result.connections, target.id, [{ ...image, role: "character", order: 0 }]);
    result = applyDramaBindingNodes(result.nodes, result.connections, clipTwoBoard.id, [{ ...image, role: "scene", order: 3 }]);
    result = applyDramaBindingNodes(result.nodes, result.connections, clipTwoVideo.id, [{ ...image, role: "character", order: 1 }]);

    const references = result.nodes.filter((node) => node.metadata?.dramaRole === "reference");
    assert.equal(references.length, 1);
    assert.equal(references[0].id, "drama:reference:version-1");
    assert.equal(references[0].metadata?.dramaClipId, undefined);
    assert.equal(references[0].metadata?.groupId, undefined);
    assert.deepEqual(
        result.connections.map((edge) => ({ target: edge.toNodeId, role: edge.dramaInputRole, order: edge.dramaInputOrder })),
        [
            { target: clipOneBoard.id, role: "character", order: 2 },
            { target: target.id, role: "character", order: 0 },
            { target: clipTwoBoard.id, role: "scene", order: 3 },
            { target: clipTwoVideo.id, role: "character", order: 1 },
        ],
    );

    const removed = applyDramaBindingNodes(result.nodes, result.connections, clipTwoBoard.id, []);
    assert.equal(removed.nodes.filter((node) => node.metadata?.dramaRole === "reference").length, 1);
    assert.deepEqual(
        removed.connections.map((edge) => edge.toNodeId),
        [clipOneBoard.id, target.id, clipTwoVideo.id],
    );
});

test("a reused legacy Clip reference is promoted without changing its media or position", () => {
    const legacy: CanvasNodeData = {
        id: "legacy-shared-image",
        type: CanvasNodeType.Image,
        title: "Hand renamed",
        position: { x: -300, y: 700 },
        width: 260,
        height: 180,
        metadata: { dramaClipId: "clip", dramaRole: "reference", groupId: "clip-group", dramaAssetVersionId: image.versionId, content: "/chosen.png", prompt: "keep" },
    };
    const otherTarget: CanvasNodeData = { ...target, id: "other-target", metadata: { ...target.metadata, dramaClipId: "other", groupId: "other-group" } };
    const result = applyDramaBindingNodes([target, otherTarget, legacy], [], otherTarget.id, [image]);
    const promoted = result.nodes.find((node) => node.id === legacy.id)!;
    assert.deepEqual(promoted.position, legacy.position);
    assert.equal(promoted.title, legacy.title);
    assert.equal(promoted.metadata?.content, "/chosen.png");
    assert.equal(promoted.metadata?.prompt, "keep");
    assert.equal(promoted.metadata?.dramaClipId, undefined);
    assert.equal(promoted.metadata?.groupId, undefined);
    assert.equal(result.connections[0].fromNodeId, legacy.id);
});

test("manual same-endpoint edges survive both reapply and removing bindings", () => {
    const first = applyDramaBindingNodes([target], [], target.id, [image]);
    const manual = { id: "hand-created-edge", fromNodeId: first.connections[0].fromNodeId, toNodeId: target.id };
    const edges = [...first.connections, manual];
    const reapplied = applyDramaBindingNodes(first.nodes, edges, target.id, [image]);
    assert.equal(
        reapplied.connections.find((edge) => edge.id === manual.id),
        manual,
    );
    assert.equal(reapplied.connections.filter((edge) => edge.id === first.connections[0].id).length, 1);
    assert.deepEqual(applyDramaBindingNodes(first.nodes, edges, target.id, []).connections, [manual]);
});

test("foreign node and edge ID collisions reject entire batch before any changes", () => {
    const generated = applyDramaBindingNodes([target], [], target.id, [image, voice]);
    const collidingNode = { ...generated.nodes[2], title: "Unrelated", metadata: { content: "/private.wav" } };
    const nodes = [target, collidingNode];
    const before = structuredClone(nodes);
    assert.throws(() => applyDramaBindingNodes(nodes, [], target.id, [image, voice]), /ID/);
    assert.deepEqual(nodes, before);
    const foreignEdge = { ...generated.connections[1], fromNodeId: "unrelated", toNodeId: "another-target" };
    const edges = [foreignEdge];
    assert.throws(() => applyDramaBindingNodes([target], edges, target.id, [image, voice]), /ID/);
    assert.deepEqual(edges, [foreignEdge]);
    assert.throws(() => applyDramaBindingNodes([...generated.nodes, generated.nodes[1]], generated.connections, target.id, [image]), /ID/);
    assert.throws(() => applyDramaBindingNodes(generated.nodes, [...generated.connections, generated.connections[0]], target.id, [image]), /ID/);
    assert.throws(() => applyDramaBindingNodes([target], [], target.id, [image, image]), /重复/);
});

test("legacy Clip ownership is promoted while role and version collisions are rejected", () => {
    const first = applyDramaBindingNodes([target], [], target.id, [image]);
    const legacyOwned = { ...first.nodes[1], metadata: { ...first.nodes[1].metadata, dramaClipId: "other" } };
    const promoted = applyDramaBindingNodes([target, legacyOwned], [], target.id, [image]);
    assert.equal(promoted.nodes[1].metadata?.dramaClipId, undefined);
    for (const patch of [{ dramaRole: "storyboard" as const }, { dramaAssetVersionId: "wrong-version" }]) {
        const node = { ...first.nodes[1], metadata: { ...first.nodes[1].metadata, ...patch } };
        assert.throws(() => applyDramaBindingNodes([target, node], [], target.id, [image]), /ID/);
    }
});
