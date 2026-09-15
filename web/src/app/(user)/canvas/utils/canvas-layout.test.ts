import assert from "node:assert/strict";
import test from "node:test";

import { CanvasNodeType, type CanvasNodeData } from "../types";
import { fitViewportToNodes, organizeCanvasNodes } from "./canvas-layout";

function clipNodes(index: number): CanvasNodeData[] {
    const clipId = `clip-${String(index).padStart(2, "0")}`;
    const x = (index % 4) * 400;
    const y = Math.floor(index / 4) * 348;
    const groupId = `${clipId}:group`;
    return [
        { id: groupId, type: CanvasNodeType.Group, title: clipId, position: { x, y }, width: 740, height: 1650 + index * 700, metadata: { dramaClipId: clipId, dramaRole: "group" } },
        { id: `${clipId}:board`, type: CanvasNodeType.Image, title: "board", position: { x: x + 24, y: y + 60 }, width: 320, height: 180, metadata: { dramaClipId: clipId, dramaRole: "storyboard", groupId, prompt: `board-${index}` } },
        { id: `${clipId}:video`, type: CanvasNodeType.Video, title: "video", position: { x: x + 396, y: y + 60 }, width: 320, height: 180, metadata: { dramaClipId: clipId, dramaRole: "video", groupId, prompt: `video-${index}` } },
        { id: `${clipId}:ref`, type: CanvasNodeType.Image, title: "ref", position: { x: x - 1200, y: y + 900 }, width: 220, height: 300, metadata: { dramaClipId: clipId, dramaRole: "reference", groupId, dramaInputOrder: 1 } },
    ];
}

function area(nodes: CanvasNodeData[]) {
    return {
        left: Math.min(...nodes.map((node) => node.position.x)),
        top: Math.min(...nodes.map((node) => node.position.y)),
        right: Math.max(...nodes.map((node) => node.position.x + node.width)),
        bottom: Math.max(...nodes.map((node) => node.position.y + node.height)),
    };
}

test("organizes 27 clip clusters without overlap and repairs inflated groups", () => {
    const source = Array.from({ length: 27 }, (_, index) => clipNodes(index)).flat();
    const result = organizeCanvasNodes(source);
    const clusters = Array.from({ length: 27 }, (_, index) => result.filter((node) => node.metadata?.dramaClipId === `clip-${String(index).padStart(2, "0")}`));
    clusters.forEach((nodes) => {
        const group = nodes.find((node) => node.metadata?.dramaRole === "group")!;
        const reference = nodes.find((node) => node.metadata?.dramaRole === "reference")!;
        assert.equal(group.height, 264);
        assert.equal(reference.metadata?.groupId, undefined);
    });
    const areas = clusters.map(area);
    for (let i = 0; i < areas.length; i += 1)
        for (let j = i + 1; j < areas.length; j += 1) {
            const overlaps = areas[i].left < areas[j].right && areas[i].right > areas[j].left && areas[i].top < areas[j].bottom && areas[i].bottom > areas[j].top;
            assert.equal(overlaps, false, `clusters ${i} and ${j} overlap`);
        }
});

test("layout is idempotent and preserves production metadata", () => {
    const source = [...clipNodes(0), ...clipNodes(1)];
    const once = organizeCanvasNodes(source);
    const twice = organizeCanvasNodes(once);
    assert.deepEqual(twice, once);
    assert.equal(twice.find((node) => node.id === "clip-00:video")?.metadata?.prompt, "video-0");
});

test("ordinary group descendants retain their relative geometry", () => {
    const group: CanvasNodeData = { id: "group", type: CanvasNodeType.Group, title: "group", position: { x: 500, y: 500 }, width: 500, height: 400 };
    const child: CanvasNodeData = { id: "child", type: CanvasNodeType.Text, title: "child", position: { x: 580, y: 620 }, width: 100, height: 80, metadata: { groupId: "group", prompt: "keep" } };
    const result = organizeCanvasNodes([group, child, ...clipNodes(0)]);
    const nextGroup = result.find((node) => node.id === "group")!;
    const nextChild = result.find((node) => node.id === "child")!;
    assert.deepEqual({ x: nextChild.position.x - nextGroup.position.x, y: nextChild.position.y - nextGroup.position.y }, { x: 80, y: 120 });
    assert.equal(nextChild.metadata?.prompt, "keep");
});

test("fits organized content into the visible viewport", () => {
    const viewport = fitViewportToNodes(organizeCanvasNodes(clipNodes(0)), 1200, 800);
    assert.ok(viewport.k > 0 && viewport.k <= 1);
    assert.ok(Number.isFinite(viewport.x));
    assert.ok(Number.isFinite(viewport.y));
});
