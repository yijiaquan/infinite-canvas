import assert from "node:assert/strict";
import test from "node:test";
import type { DramaRun } from "@/services/api/drama-runs";
import { CanvasNodeType, type CanvasNodeData } from "../types";
import { mergeDramaRunStates } from "./drama-run-state";

const node: CanvasNodeData = { id: "video", type: CanvasNodeType.Video, title: "Video", position: { x: 90, y: -40 }, width: 320, height: 180, metadata: { dramaRunId: "run", dramaClipId: "clip", prompt: "current draft", status: "idle" } };
const run: DramaRun = {
    id: "run",
    clipId: "clip",
    nodeId: "video",
    kind: "video",
    status: "completed",
    upstreamId: "provider-run",
    createdAt: "",
    updatedAt: "",
    error: "",
    snapshot: { requestId: "request", nodeId: "video", kind: "video", model: "frozen-model", channelId: "channel", prompt: "submitted prompt", parameters: {}, references: [] },
    outputs: [
        { storageId: "first", url: "/first.mp4", mimeType: "video/mp4" },
        { storageId: "second", url: "/second.mp4", mimeType: "video/mp4" },
    ],
};

test("completed run fills first output into empty content while preserving draft and frozen snapshot", () => {
    const nodes = [node];
    const before = structuredClone({ nodes, run });
    const merged = mergeDramaRunStates(nodes, [run]);
    assert.deepEqual({ nodes, run }, before);
    assert.equal(merged[0].metadata?.content, "/first.mp4");
    assert.equal(merged[0].metadata?.storageKey, "server:first");
    assert.equal(merged[0].metadata?.mimeType, "video/mp4");
    assert.equal(merged[0].metadata?.prompt, "current draft");
    assert.equal(merged[0].metadata?.dramaNeedsReview, true);
    assert.equal(merged[0].metadata?.status, "success");
    assert.deepEqual(merged[0].position, node.position);
    assert.equal(run.snapshot.prompt, "submitted prompt");
});

test("new candidate never replaces adopted media or its storage identity", () => {
    const adopted = { ...node, metadata: { ...node.metadata, content: "/adopted.mp4", storageKey: "server:adopted", mimeType: "video/webm", prompt: run.snapshot.prompt } };
    const merged = mergeDramaRunStates([adopted], [run]);
    assert.equal(merged[0].metadata?.content, "/adopted.mp4");
    assert.equal(merged[0].metadata?.storageKey, "server:adopted");
    assert.equal(merged[0].metadata?.mimeType, "video/webm");
    assert.equal(merged[0].metadata?.dramaNeedsReview, false);
});

test("merge matches both run and node IDs and no-op preserves array and object identity", () => {
    const nodes = [node];
    assert.equal(mergeDramaRunStates(nodes, []), nodes);
    assert.equal(mergeDramaRunStates(nodes, [{ ...run, id: "different" }]), nodes);
    assert.equal(mergeDramaRunStates(nodes, [{ ...run, nodeId: "other-node" }]), nodes);
    const unrelated = { ...node, id: "unrelated", metadata: {} };
    const merged = mergeDramaRunStates([node, unrelated], [run]);
    assert.equal(merged[1], unrelated);
    assert.equal(mergeDramaRunStates(merged, [run]), merged);
});

test("pending, failed, unknown and cancelled statuses preserve draft and existing media", () => {
    const adopted = { ...node, metadata: { ...node.metadata, content: "/adopted.mp4" } };
    for (const status of ["queued", "preparing", "submitting", "running", "saving"]) {
        const result = mergeDramaRunStates([adopted], [{ ...run, status }]);
        assert.equal(result[0].metadata?.status, "loading");
        assert.equal(result[0].metadata?.prompt, "current draft");
        assert.equal(result[0].metadata?.content, "/adopted.mp4");
    }
    for (const status of ["failed", "unknown"]) {
        const result = mergeDramaRunStates([adopted], [{ ...run, status, error: "inspect provider" }]);
        assert.equal(result[0].metadata?.status, "error");
        assert.equal(result[0].metadata?.errorDetails, "inspect provider");
        assert.equal(result[0].metadata?.content, "/adopted.mp4");
        assert.equal(result[0].metadata?.prompt, "current draft");
    }
    assert.equal(mergeDramaRunStates([adopted], [{ ...run, status: "cancelled" }])[0].metadata?.status, "success");
    assert.equal(mergeDramaRunStates([node], [{ ...run, status: "cancelled" }])[0].metadata?.status, "idle");
});

test("completed run without outputs does not invent media", () => {
    const merged = mergeDramaRunStates([node], [{ ...run, outputs: [] }]);
    assert.equal(merged[0].metadata?.content, undefined);
    assert.equal(merged[0].metadata?.storageKey, undefined);
});
