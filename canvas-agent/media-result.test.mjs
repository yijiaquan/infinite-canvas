import assert from "node:assert/strict";
import test from "node:test";

import { formatCanvasToolResult } from "./media-result.mjs";

test("keeps ordinary tool results as JSON text", () => {
    assert.deepEqual(formatCanvasToolResult({ ok: true, value: 1 }), { isError: false, content: [{ type: "text", text: '{"ok":true,"value":1}' }] });
});

test("maps image and audio payloads to native MCP content", () => {
    assert.equal(formatCanvasToolResult({ ok: true, _mcpMedia: { kind: "image", mimeType: "image/png", data: "abc" } }).content[1].type, "image");
    assert.equal(formatCanvasToolResult({ ok: true, _mcpMedia: { kind: "audio", mimeType: "audio/mpeg", data: "abc" } }).content[1].type, "audio");
});

test("maps inline and linked video payloads to MCP resources", () => {
    assert.equal(formatCanvasToolResult({ ok: true, _mcpMedia: { kind: "video", uri: "canvas-media://node/a", mimeType: "video/mp4", data: "abc" } }).content[1].type, "resource");
    assert.equal(formatCanvasToolResult({ ok: true, _mcpMedia: { kind: "video", uri: "http://127.0.0.1/video", mimeType: "video/mp4", name: "clip" } }).content[1].type, "resource_link");
});
