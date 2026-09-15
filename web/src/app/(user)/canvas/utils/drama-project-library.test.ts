import assert from "node:assert/strict";
import test from "node:test";

import type { DramaProjectDetail } from "@/services/api/drama";
import type { CanvasProject } from "../stores/use-canvas-store";
import { CanvasNodeType } from "../types";
import { buildDramaProjectLibrary } from "./drama-project-library";

const canvas = (id: string, updatedAt: string, dramaProjectId?: string, dramaEpisodeId?: string): CanvasProject => ({
    id,
    dramaProjectId,
    dramaEpisodeId,
    title: id,
    createdAt: updatedAt,
    updatedAt,
    nodes: id === "episode-2" ? [{ id: "node", type: CanvasNodeType.Text, title: "节点", position: { x: 0, y: 0 }, width: 100, height: 100, metadata: {} }] : [],
    connections: [],
    chatSessions: [],
    activeChatId: null,
    agentConfig: null,
    autoTitlePending: false,
    backgroundMode: "lines",
    showImageInfo: false,
    viewport: { x: 0, y: 0, k: 1 },
    sidePanel: { open: true, width: 280 },
    agentPanel: { open: false, width: 464 },
});

test("groups episode canvases under one drama project and keeps ordinary canvases separate", () => {
    const detail = {
        project: { id: "drama", title: "万法有息", sourceType: "novel", sourceText: "", adaptation: "", globalStyle: "", revision: 1, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" },
        episodes: [
            { id: "ep-2", projectId: "drama", canvasId: "episode-2", title: "第二集", position: 2, script: "", revision: 1, createdAt: "2026-09-02T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z" },
            { id: "ep-1", projectId: "drama", canvasId: "episode-1", title: "第一集", position: 1, script: "", revision: 1, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" },
        ],
    } satisfies DramaProjectDetail;
    const result = buildDramaProjectLibrary([canvas("ordinary", "2026-09-03T00:00:00Z"), canvas("episode-1", "2026-09-04T00:00:00Z", "drama", "ep-1"), canvas("episode-2", "2026-09-05T00:00:00Z", "drama", "ep-2")], [detail]);

    assert.deepEqual(
        result.ordinaryProjects.map((item) => item.id),
        ["ordinary"],
    );
    assert.equal(result.dramaProjects.length, 1);
    assert.deepEqual(
        result.dramaProjects[0].episodes.map((item) => item.id),
        ["ep-1", "ep-2"],
    );
    assert.equal(result.dramaProjects[0].entryEpisode?.id, "ep-2");
    assert.equal(result.dramaProjects[0].nodeCount, 1);
});
