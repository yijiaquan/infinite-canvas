import assert from "node:assert/strict";
import test from "node:test";

import { parseCodexAgentResponse } from "./codex-agent";

test("parses Canvas Agent JSON responses", async () => {
    const result = await parseCodexAgentResponse<{ url: string }>(new Response(JSON.stringify({ url: "http://127.0.0.1:3210" })));
    assert.equal(result.url, "http://127.0.0.1:3210");
});

test("reports when the configured port returns HTML", async () => {
    await assert.rejects(
        parseCodexAgentResponse(new Response("<!DOCTYPE html><title>Other service</title>")),
        /不是 Canvas Agent 数据/,
    );
});
