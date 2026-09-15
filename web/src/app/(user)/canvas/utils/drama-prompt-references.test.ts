import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "../types";
import { buildDramaPromptReferences } from "./drama-prompt-references";

describe("buildDramaPromptReferences", () => {
    test("puts the storyboard first and renumbers native labels by media kind", () => {
        const target: CanvasNodeData = { id: "video", type: CanvasNodeType.Video, title: "视频", position: { x: 0, y: 0 }, width: 320, height: 180, metadata: { dramaClipId: "clip", dramaRole: "video" } };
        const identity: CanvasNodeData = { id: "identity", type: CanvasNodeType.Image, title: "角色板", position: { x: 0, y: 0 }, width: 220, height: 140, metadata: { content: "/identity.png" } };
        const voice: CanvasNodeData = { id: "voice", type: CanvasNodeType.Audio, title: "音色", position: { x: 0, y: 0 }, width: 220, height: 140, metadata: { content: "/voice.mp3" } };
        const board: CanvasNodeData = { id: "board", type: CanvasNodeType.Image, title: "导演板", position: { x: 0, y: 0 }, width: 320, height: 180, metadata: { content: "/board.png", dramaRole: "storyboard" } };
        const nodes = [target, identity, voice, board];
        const connections: CanvasConnection[] = [
            { id: "identity-video", fromNodeId: identity.id, toNodeId: target.id, dramaInputOrder: 0 },
            { id: "voice-video", fromNodeId: voice.id, toNodeId: target.id, dramaInputOrder: 1 },
            { id: "board-video", fromNodeId: board.id, toNodeId: target.id },
        ];

        assert.deepEqual(buildDramaPromptReferences(target, nodes, connections).map(({ nodeId, label }) => ({ nodeId, label })), [
            { nodeId: "board", label: "图片1" },
            { nodeId: "identity", label: "图片2" },
            { nodeId: "voice", label: "音频1" },
        ]);
    });
});
