import assert from "node:assert/strict";
import test from "node:test";

import type { DramaAdoption } from "@/services/api/drama-adoption";
import { CanvasNodeType, type CanvasNodeData } from "../types";
import { mergeDramaAdoptionStates } from "./drama-adoption-state";

const board: CanvasNodeData = {
    id: "board",
    type: CanvasNodeType.Image,
    title: "Storyboard",
    position: { x: 0, y: 0 },
    width: 320,
    height: 180,
    metadata: { dramaClipId: "clip", dramaRole: "storyboard", content: "/api/files/old/content", storageKey: "server:old", status: "success" },
};
const adoption: DramaAdoption = { id: "adoption", clipId: "clip", kind: "image", runId: "repair-run", storageId: "new", clipRevision: 3, revision: 1, updatedAt: "", needsReview: false };

test("adopted media replaces the formal stage node and repeated reconciliation is stable", () => {
    const nodes = [board];
    const updated = mergeDramaAdoptionStates(nodes, [adoption]);
    assert.notEqual(updated, nodes);
    assert.equal(updated[0].metadata?.content, "/api/files/new/content");
    assert.equal(updated[0].metadata?.storageKey, "server:new");
    assert.equal(updated[0].metadata?.dramaRunId, "repair-run");
    assert.equal(mergeDramaAdoptionStates(updated, [adoption]), updated);
});

test("unrelated adoption leaves node collection untouched", () => {
    const nodes = [board];
    assert.equal(mergeDramaAdoptionStates(nodes, [{ ...adoption, clipId: "other" }]), nodes);
    assert.equal(mergeDramaAdoptionStates(nodes, [{ ...adoption, kind: "audio" }]), nodes);
});
