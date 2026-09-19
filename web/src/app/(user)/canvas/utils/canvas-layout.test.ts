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
        { id: groupId, type: CanvasNodeType.Group, title: `C${String(index + 1).padStart(2, "0")} Clip`, position: { x, y }, width: 740, height: 1650 + index * 700, metadata: { dramaClipId: clipId, dramaRole: "group" } },
        { id: `${clipId}:board`, type: CanvasNodeType.Image, title: "board", position: { x: x + 24, y: y + 60 }, width: 320, height: 180, metadata: { dramaClipId: clipId, dramaRole: "storyboard", groupId, prompt: `board-${index}` } },
        { id: `${clipId}:video`, type: CanvasNodeType.Video, title: "video", position: { x: x + 396, y: y + 60 }, width: 320, height: 180, metadata: { dramaClipId: clipId, dramaRole: "video", groupId, prompt: `video-${index}` } },
        { id: `${clipId}:ref`, type: CanvasNodeType.Image, title: "ref", position: { x: x - 1200, y: y + 900 }, width: 220, height: 300, metadata: { dramaClipId: clipId, dramaRole: "reference", groupId, dramaInputOrder: 1 } },
    ];
}

test("organizes 27 Clip groups in one numbered column and moves references into the image column", () => {
    const leading = [9, 1, 26, 0];
    const source = [...leading, ...Array.from({ length: 27 }, (_, index) => index).filter((index) => !leading.includes(index))].flatMap(clipNodes);
    const result = organizeCanvasNodes(source);
    const groups = result.filter((node) => node.metadata?.dramaRole === "group").sort((a, b) => a.position.y - b.position.y);
    const references = result.filter((node) => node.metadata?.dramaRole === "reference");
    assert.equal(groups.length, 27);
    assert.equal(new Set(groups.map((node) => node.position.x)).size, 1);
    assert.deepEqual(
        groups.map((node) => node.title),
        Array.from({ length: 27 }, (_, index) => `C${String(index + 1).padStart(2, "0")} Clip`),
    );
    assert.equal(new Set(references.map((node) => node.position.x)).size, 1);
    assert.ok(references[0].position.x < groups[0].position.x);
    groups.forEach((group, index) => {
        assert.equal(group.height, 264);
        if (index) assert.ok(group.position.y >= groups[index - 1].position.y + groups[index - 1].height + 120);
    });
    references.forEach((reference) => assert.equal(reference.metadata?.groupId, undefined));
});

test("places each top-level node type in its own ordered column", () => {
    const source: CanvasNodeData[] = [
        { id: "audio", type: CanvasNodeType.Audio, title: "audio", position: { x: 900, y: 20 }, width: 340, height: 160 },
        { id: "image-late", type: CanvasNodeType.Image, title: "image late", position: { x: 20, y: 500 }, width: 340, height: 240 },
        { id: "text", type: CanvasNodeType.Text, title: "text", position: { x: 400, y: 40 }, width: 340, height: 240 },
        { id: "image-early", type: CanvasNodeType.Image, title: "image early", position: { x: 40, y: 100 }, width: 340, height: 240 },
        { id: "video", type: CanvasNodeType.Video, title: "video", position: { x: 700, y: 60 }, width: 420, height: 236 },
    ];
    const result = organizeCanvasNodes(source);
    const byId = new Map(result.map((node) => [node.id, node]));
    assert.equal(byId.get("image-early")?.position.x, byId.get("image-late")?.position.x);
    assert.ok(byId.get("image-early")!.position.y < byId.get("image-late")!.position.y);
    assert.ok(byId.get("image-early")!.position.x < byId.get("text")!.position.x);
    assert.ok(byId.get("text")!.position.x < byId.get("video")!.position.x);
    assert.ok(byId.get("video")!.position.x < byId.get("audio")!.position.x);
});

test("keeps the spatial order of unnumbered Clip titles", () => {
    const later = clipNodes(0).map((node) => (node.metadata?.dramaRole === "group" ? { ...node, title: "开场" } : node));
    const earlier = clipNodes(1).map((node) => ({ ...node, position: { x: node.position.x, y: node.position.y - 500 }, ...(node.metadata?.dramaRole === "group" ? { title: "收尾" } : {}) }));
    const result = organizeCanvasNodes([...later, ...earlier]);
    const groups = result.filter((node) => node.metadata?.dramaRole === "group").sort((a, b) => a.position.y - b.position.y);
    assert.deepEqual(
        groups.map((node) => node.title),
        ["收尾", "开场"],
    );
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
