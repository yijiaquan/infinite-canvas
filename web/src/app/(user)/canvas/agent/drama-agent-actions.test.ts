import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import { executeDramaAgentAction } from "./drama-agent-actions";
import { CANVAS_AGENT_TOOLS, isCanvasAgentMediaAction, normalizeCanvasAgentAction, userLikelyRequestedCanvasAction } from "./canvas-agent-tools";
import { persistDramaNodeParameters, resolveDramaNodeParameters } from "../utils/drama-generation";
import { selectVoiceExcerpt } from "../utils/voice-excerpt-analysis";

test("drama edits preserve exact content and do not become media actions", () => {
    const script = "  exact dialogue\n\nending  ";
    const action = normalizeCanvasAgentAction("update_drama_episode", { expectedRevision: 4, script });
    assert.equal(action.arguments.script, script);
    assert.equal(action.arguments.expectedRevision, 4);
    assert.equal(isCanvasAgentMediaAction(action), false);
    assert.ok(CANVAS_AGENT_TOOLS.some((tool) => tool.function.name === "get_drama_assets"));
    assert.ok(CANVAS_AGENT_TOOLS.some((tool) => tool.function.name === "enqueue_drama_run"));
    assert.equal(isCanvasAgentMediaAction(normalizeCanvasAgentAction("enqueue_drama_run", { clipId: "clip", nodeId: "node", requestId: "once" })), true);
    assert.ok(CANVAS_AGENT_TOOLS.some((tool) => tool.function.name === "create_audio_excerpt"));
    assert.equal(isCanvasAgentMediaAction(normalizeCanvasAgentAction("create_audio_excerpt", { sourceNodeId: "video", requestId: "excerpt-once" })), false);
    assert.ok(CANVAS_AGENT_TOOLS.some((tool) => tool.function.name === "find_voice_excerpt"));
    assert.equal(isCanvasAgentMediaAction(normalizeCanvasAgentAction("find_voice_excerpt", { sourceNodeId: "video", requestId: "voice-once" })), false);
});

test("voice excerpt tool normalizes deterministic analysis requests", () => {
    assert.equal(userLikelyRequestedCanvasAction("自动找到视频中人物说话的四秒声音"), true);
    assert.deepEqual(normalizeCanvasAgentAction("find_voice_excerpt", { sourceNodeId: "video", requestId: "voice-once" }).arguments, {
        sourceNodeId: "video", requestId: "voice-once", targetSeconds: 4,
    });
    assert.deepEqual(
        normalizeCanvasAgentAction("find_voice_excerpt", { sourceNodeId: "video", requestId: "voice-once", targetSeconds: 3.5, speaker: "  祁野  ", title: "  祁野候选  " }).arguments,
        { sourceNodeId: "video", requestId: "voice-once", targetSeconds: 3.5, speaker: "祁野", title: "祁野候选" },
    );
    for (const args of [
        { sourceNodeId: "video", requestId: "x", targetSeconds: 0.49 },
        { sourceNodeId: "video", requestId: "x", targetSeconds: 12.1 },
        { sourceNodeId: "video", requestId: "x", targetSeconds: Number.NaN },
        { sourceNodeId: "video", requestId: "x", url: "https://example.com/media.mp4" },
        { sourceNodeId: "video", requestId: "x", storageId: "guessed" },
    ]) assert.throws(() => normalizeCanvasAgentAction("find_voice_excerpt", args));
});

test("voice excerpt selection uses ASR/VAD timestamps rather than generation configuration", () => {
    const selection = selectVoiceExcerpt([
        { startSeconds: 0.2, endSeconds: 0.8, text: "噪声", avgLogProb: -3.8, noSpeechProb: 0.9 },
        { startSeconds: 3, endSeconds: 5.1, text: "我在这里", avgLogProb: -0.2, noSpeechProb: 0.03 },
        { startSeconds: 5.3, endSeconds: 7.4, text: "先听我说完", avgLogProb: -0.1, noSpeechProb: 0.02 },
    ], 4);
    assert.ok(selection);
    assert.equal(selection.startSeconds, 3);
    assert.equal(selection.endSeconds, 7);
    assert.equal(selection.speakerUnverified, true);
    assert.equal(selection.shorterThanTarget, false);
    assert.equal(selectVoiceExcerpt([{ startSeconds: 1, endSeconds: 1.4, text: "太短" }], 4), null);
});

test("audio excerpt tool normalizes safe operations and rejects unsafe input", () => {
    assert.equal(userLikelyRequestedCanvasAction("从视频1截取四秒人物声音"), true);
    assert.equal(userLikelyRequestedCanvasAction("分离这个视频的音频"), true);
    assert.deepEqual(normalizeCanvasAgentAction("create_audio_excerpt", { sourceNodeId: "video", requestId: "full-track" }).arguments, {
        sourceNodeId: "video",
        requestId: "full-track",
    });
    assert.deepEqual(
        normalizeCanvasAgentAction("create_audio_excerpt", { sourceNodeId: "audio", requestId: "clip", startSeconds: 1, endSeconds: 5, title: "  祁野样本  " }).arguments,
        { sourceNodeId: "audio", requestId: "clip", startSeconds: 1, endSeconds: 5, title: "祁野样本" },
    );
    assert.doesNotThrow(() => normalizeCanvasAgentAction("create_audio_excerpt", { sourceNodeId: "video", requestId: "half-second", startSeconds: 0, endSeconds: 0.5 }));
    for (const args of [
        { sourceNodeId: "video", requestId: "x", startSeconds: 1 },
        { sourceNodeId: "video", requestId: "x", endSeconds: 2 },
        { sourceNodeId: "video", requestId: "x", startSeconds: -1, endSeconds: 2 },
        { sourceNodeId: "video", requestId: "x", startSeconds: 1, endSeconds: 1.49 },
        { sourceNodeId: "video", requestId: "x", startSeconds: 2, endSeconds: 1 },
        { sourceNodeId: "video", requestId: "x", startSeconds: Number.NaN, endSeconds: 2 },
        { sourceNodeId: "video", requestId: "x", storageId: "guessed" },
        { sourceNodeId: "video", requestId: "x", url: "https://example.com/media.mp4" },
    ]) {
        assert.throws(() => normalizeCanvasAgentAction("create_audio_excerpt", args));
    }
});

test("upscale tools normalize safe defaults and reject unsupported resolutions", () => {
    const image = normalizeCanvasAgentAction("upscale_image", { sourceNodeId: "image-source" });
    assert.deepEqual(image.arguments, { sourceNodeId: "image-source", resolution: "2k", model: "vosr2" });
    assert.equal(isCanvasAgentMediaAction(image), true);

    const video = normalizeCanvasAgentAction("upscale_video", { sourceNodeId: "video-source" });
    assert.deepEqual(video.arguments, { sourceNodeId: "video-source", resolution: "1080p" });
    assert.equal(isCanvasAgentMediaAction(video), true);

    assert.throws(() => normalizeCanvasAgentAction("upscale_image", { sourceNodeId: "image-source", resolution: "8k" }));
    assert.throws(() => normalizeCanvasAgentAction("upscale_video", { sourceNodeId: "video-source", resolution: "4k" }));
});

test("formal drama tools reject raw storage, duplicate order and hidden generation parameters", () => {
    assert.deepEqual(normalizeCanvasAgentAction("get_media_content", { nodeId: "media-node" }).arguments, { nodeId: "media-node" });
    assert.throws(() => normalizeCanvasAgentAction("get_media_content", { nodeId: "media-node", url: "https://example.com/private" }));
    assert.throws(() => normalizeCanvasAgentAction("register_drama_asset_version", { assetId: "asset", storageId: "guessed", nodeId: "node", expectedRevision: 1 }));
    assert.throws(() =>
        normalizeCanvasAgentAction("update_drama_binding", {
            clipId: "clip",
            stage: "video",
            expectedRevision: 1,
            references: [
                { assetId: "a", versionId: "v1", role: "identity", order: 0, speaker: "" },
                { assetId: "b", versionId: "v2", role: "scene", order: 0, speaker: "" },
            ],
        }),
    );
    assert.throws(() =>
        normalizeCanvasAgentAction("update_drama_binding", {
            clipId: "clip",
            stage: "storyboard",
            expectedRevision: 0,
            references: [{ assetId: "a", versionId: "v1", role: "character_identity", order: 0, speaker: "" }],
        }),
    );
    assert.throws(() =>
        normalizeCanvasAgentAction("update_drama_binding", {
            clipId: "clip",
            stage: "storyboard",
            expectedRevision: 0,
            references: [{ assetId: "a", versionId: "v1", role: "character", order: 1, speaker: "" }],
        }),
    );
    assert.deepEqual(
        normalizeCanvasAgentAction("update_drama_binding", {
            clipId: "clip",
            stage: "storyboard",
            expectedRevision: 0,
            references: [
                { assetId: "a", versionId: "v1", role: "character", order: 0, speaker: "" },
                { assetId: "b", versionId: "v2", role: "reference", order: 1, speaker: "" },
            ],
        }).arguments.references,
        [
            { assetId: "a", versionId: "v1", role: "character", order: 0, speaker: "" },
            { assetId: "b", versionId: "v2", role: "reference", order: 1, speaker: "" },
        ],
    );
    assert.throws(() => normalizeCanvasAgentAction("update_drama_generation_node", { clipId: "clip", nodeId: "node", stage: "video", prompt: "x", parameters: { hidden_node: true } }));
    assert.throws(() => normalizeCanvasAgentAction("update_drama_generation_node", { clipId: "clip", nodeId: "node", stage: "video", prompt: "x", parameters: { steps: true } }));
    assert.throws(() => normalizeCanvasAgentAction("update_drama_generation_node", { clipId: "clip", nodeId: "node", stage: "video", prompt: "x", parameters: { resolution_name: "4k" } }));
    assert.equal(normalizeCanvasAgentAction("update_drama_binding", { clipId: "clip", stage: "storyboard", expectedRevision: 0, references: [] }).arguments.expectedRevision, 0);
    const prompt = "  镜头一\n\n对白保持  ";
    const action = normalizeCanvasAgentAction("update_drama_generation_node", { clipId: "clip", nodeId: "node", stage: "video", prompt, parameters: { steps: 12, seconds: 8 } });
    assert.equal(action.arguments.prompt, prompt);
    assert.equal("parameters" in normalizeCanvasAgentAction("update_drama_generation_node", { clipId: "clip", nodeId: "node", stage: "video", prompt }).arguments, false);
    assert.deepEqual(normalizeCanvasAgentAction("generate_drama_asset_candidate", { assetId: "asset", kind: "image", prompt: "portrait", sourceNodeIds: [] }).arguments.sourceNodeIds, []);
    assert.deepEqual(normalizeCanvasAgentAction("update_drama_project", { expectedRevision: 2, generationDefaults: { image: { steps: 20 }, video: { seconds: 12, resolution_name: "720p" } } }).arguments.generationDefaults, {
        image: { steps: 20 },
        video: { seconds: 12, resolution_name: "720p" },
    });
    assert.throws(() => normalizeCanvasAgentAction("update_drama_project", { expectedRevision: 2, generationDefaults: { video: { workflow_node: "hidden" } } }));
});

test("drama nodes persist the same effective parameters used for a run", () => {
    const parameters = resolveDramaNodeParameters({ seconds: 6, resolution_name: "720p", steps: 20 }, { seconds: "8", size: "16:9", dramaParameters: { seconds: 10, resolution_name: "480p" } });
    assert.deepEqual(parameters, { seconds: 10, resolution_name: "480p", steps: 20, size: "16:9" });
    assert.deepEqual(persistDramaNodeParameters({}, parameters), {
        dramaParameters: parameters,
        seconds: "10",
        size: "16:9",
        vquality: "480p",
    });
});

test("drama edits reject missing/stale-shape revisions and scope or ordering overrides", () => {
    for (const args of [{ script: "x" }, { expectedRevision: 0, script: "x" }, { expectedRevision: 1.5, script: "x" }, { expectedRevision: 1, projectId: "other", script: "x" }, { expectedRevision: 1 }]) {
        assert.throws(() => normalizeCanvasAgentAction("update_drama_episode", args));
    }
    assert.throws(() => normalizeCanvasAgentAction("update_drama_clip", { clipId: "x", expectedRevision: 1, archived: true }));
    assert.throws(() => normalizeCanvasAgentAction("update_drama_clip", { clipId: "x", expectedRevision: 1, position: 8 }));
    assert.throws(() => normalizeCanvasAgentAction("get_drama_clips", { projectId: "foreign" }));
});

test("drama shot replacement validates stable IDs, exact dialogue and finite duration", () => {
    const shot = { id: "stable", title: "", duration: 2.25, action: "move", dialogue: "  exact\nline  ", speaker: "Alice", camera: "", sound: "", entryState: "", exitState: "" };
    const action = normalizeCanvasAgentAction("update_drama_clip", { clipId: "clip", expectedRevision: 2, shots: [shot] });
    assert.deepEqual(action.arguments.shots, [shot]);
    for (const shots of [[shot, shot], [{ ...shot, id: " padded " }], [{ ...shot, duration: Infinity }], [{ ...shot, duration: 0 }], [{ ...shot, secret: "x" }], [{ id: "incomplete", duration: 1 }]]) {
        assert.throws(() => normalizeCanvasAgentAction("update_drama_clip", { clipId: "clip", expectedRevision: 2, shots }));
    }
});

test("business actions enforce live scope and revisions before updates and preserve untouched fields", async () => {
    const adapter = axios.defaults.adapter;
    const requests: Array<{ method?: string; data?: string }> = [];
    let current = true;
    let changed = 0;
    const detail = {
        project: { id: "project", title: "Project", sourceType: "novel", sourceText: "original", adaptation: "adopted", globalStyle: "look", revision: 3 },
        episodes: [{ id: "episode", canvasId: "canvas", title: "Episode", script: "kept", revision: 2 }],
    };
    axios.defaults.adapter = async (config) => {
        requests.push({ method: config.method, data: config.data });
        return { status: 200, statusText: "OK", headers: {}, config, data: { code: 0, data: config.method === "get" ? detail : { saved: true } } };
    };
    const context = {
        token: "isolated-test",
        projectId: "project",
        episodeId: "episode",
        canvasId: "canvas",
        isCurrent: () => current,
        onChanged: () => {
            changed++;
        },
        readAssets: async () => ({ assets: [], versions: [] }),
    };
    try {
        const stale = await executeDramaAgentAction(normalizeCanvasAgentAction("update_drama_project", { expectedRevision: 2, title: "new" }), context);
        assert.equal(stale?.ok, false);
        assert.equal(requests.length, 1);
        const saved = await executeDramaAgentAction(normalizeCanvasAgentAction("update_drama_project", { expectedRevision: 3, title: "new" }), context);
        assert.equal(saved?.ok, true);
        assert.equal(changed, 1);
        assert.deepEqual(JSON.parse(requests[2].data!), { title: "new", sourceType: "novel", sourceText: "original", adaptation: "adopted", globalStyle: "look", expectedRevision: 3 });
        const before = requests.length;
        current = false;
        assert.equal((await executeDramaAgentAction(normalizeCanvasAgentAction("create_drama_clip", { title: "Clip" }), context))?.ok, false);
        assert.equal(requests.length, before);
        current = true;
        assert.equal((await executeDramaAgentAction(normalizeCanvasAgentAction("get_drama_assets", {}), { ...context, canvasId: "other" }))?.ok, false);
        assert.equal(changed, 1);
    } finally {
        axios.defaults.adapter = adapter;
    }
});

test("auto generation off prepares an idempotent snapshot without enqueueing", async () => {
    const adapter = axios.defaults.adapter;
    const requests: string[] = [];
    const detail = { project: { id: "project", title: "P", sourceType: "script", sourceText: "", adaptation: "", globalStyle: "", revision: 1 }, episodes: [{ id: "episode", canvasId: "canvas", title: "E", script: "", revision: 1 }] };
    const clip = { id: "clip", projectId: "project", episodeId: "episode", title: "C", scene: "", summary: "", entryState: "", exitState: "", shots: [], archived: false, position: 0, revision: 2, createdAt: "", updatedAt: "" };
    axios.defaults.adapter = async (config) => {
        requests.push(String(config.url));
        const data = String(config.url).endsWith("/clips") ? [clip] : detail;
        return { status: 200, statusText: "OK", headers: {}, config, data: { code: 0, data } };
    };
    let buildCalls = 0;
    try {
        const result = await executeDramaAgentAction(normalizeCanvasAgentAction("enqueue_drama_run", { clipId: "clip", nodeId: "node", requestId: "stable-request" }), {
            token: "token",
            projectId: "project",
            episodeId: "episode",
            canvasId: "canvas",
            autoGenerateMedia: false,
            isCurrent: () => true,
            onChanged: () => undefined,
            readAssets: async () => ({ assets: [], versions: [] }),
            buildRunInput: async () => {
                buildCalls++;
                return { input: { requestId: "stable-request", nodeId: "node", kind: "video", model: "m", channelId: "c", prompt: "p", parameters: {}, references: [] } };
            },
        });
        assert.equal(result?.ok, true);
        assert.equal((result?.data as { submitted: boolean }).submitted, false);
        assert.equal(buildCalls, 1);
        assert.equal(
            requests.some((url) => /\/runs$/.test(url)),
            false,
        );
    } finally {
        axios.defaults.adapter = adapter;
    }
});

test("auto generation records the returned run on its canvas node", async () => {
    const adapter = axios.defaults.adapter;
    const detail = { project: { id: "project", title: "P", sourceType: "script", sourceText: "", adaptation: "", globalStyle: "", revision: 1 }, episodes: [{ id: "episode", canvasId: "canvas", title: "E", script: "", revision: 1 }] };
    const clip = { id: "clip", projectId: "project", episodeId: "episode", title: "C", scene: "", summary: "", entryState: "", exitState: "", shots: [], archived: false, position: 0, revision: 2, createdAt: "", updatedAt: "" };
    axios.defaults.adapter = async (config) => {
        const url = String(config.url);
        const data = url.endsWith("/clips") ? [clip] : url.endsWith("/runs") && config.method === "post" ? { id: "run-1", nodeId: "node", status: "queued", outputs: [], snapshot: {} } : detail;
        return { status: 200, statusText: "OK", headers: {}, config, data: { code: 0, data } };
    };
    let recorded: [string, string] | undefined;
    try {
        const result = await executeDramaAgentAction(normalizeCanvasAgentAction("enqueue_drama_run", { clipId: "clip", nodeId: "node", requestId: "stable-request" }), {
            token: "token",
            projectId: "project",
            episodeId: "episode",
            canvasId: "canvas",
            autoGenerateMedia: true,
            isCurrent: () => true,
            onChanged: () => undefined,
            readAssets: async () => ({ assets: [], versions: [] }),
            buildRunInput: async () => ({ input: { requestId: "stable-request", nodeId: "node", kind: "image", model: "m", channelId: "c", prompt: "p", parameters: {}, references: [] } }),
            onRunEnqueued: async (nodeId, run) => {
                recorded = [nodeId, run.id];
            },
        });
        assert.equal((result?.data as { submitted: boolean }).submitted, true);
        assert.deepEqual(recorded, ["node", "run-1"]);
    } finally {
        axios.defaults.adapter = adapter;
    }
});

test("asset version resolves owned node storage and adoption uses completed run output index", async () => {
    const adapter = axios.defaults.adapter;
    const posts: Array<{ url: string; data: Record<string, unknown> }> = [];
    const detail = { project: { id: "project", title: "P", sourceType: "script", sourceText: "", adaptation: "", globalStyle: "", revision: 1 }, episodes: [{ id: "episode", canvasId: "canvas", title: "E", script: "", revision: 1 }] };
    const clip = { id: "clip", projectId: "project", episodeId: "episode", title: "C", scene: "", summary: "", entryState: "", exitState: "", shots: [], archived: false, position: 0, revision: 3, createdAt: "", updatedAt: "" };
    const catalog = { assets: [{ id: "asset", projectId: "project", title: "A", kind: "character" as const, parentId: "", description: "", adoptedVersionId: "", revision: 4, archived: false }], versions: [] };
    axios.defaults.adapter = async (config) => {
        const url = String(config.url);
        if (config.method === "post") {
            posts.push({ url, data: typeof config.data === "string" ? JSON.parse(config.data) : config.data });
            return { status: 200, statusText: "OK", headers: {}, config, data: { code: 0, data: { saved: true } } };
        }
        const data = url.endsWith("/clips")
            ? [clip]
            : url.endsWith("/runs")
              ? [
                    {
                        id: "run",
                        clipId: "clip",
                        nodeId: "video",
                        kind: "video",
                        status: "completed",
                        upstreamId: "",
                        createdAt: "",
                        updatedAt: "",
                        error: "",
                        snapshot: {},
                        outputs: [
                            { storageId: "first", url: "/first", mimeType: "video/mp4" },
                            { storageId: "chosen", url: "/chosen", mimeType: "video/mp4" },
                        ],
                    },
                ]
              : detail;
        return { status: 200, statusText: "OK", headers: {}, config, data: { code: 0, data } };
    };
    const base = { token: "token", projectId: "project", episodeId: "episode", canvasId: "canvas", isCurrent: () => true, onChanged: () => undefined, readAssets: async () => catalog };
    try {
        let resolved: [{ id: string; kind: string }, string] | undefined;
        assert.equal(
            (
                await executeDramaAgentAction(normalizeCanvasAgentAction("register_drama_asset_version", { assetId: "asset", nodeId: "candidate", note: "v1", expectedRevision: 4 }), {
                    ...base,
                    resolveNodeStorage: async (asset, nodeId) => {
                        resolved = [asset, nodeId];
                        return { storageId: "stored" };
                    },
                })
            )?.ok,
            true,
        );
        assert.deepEqual(resolved, [{ id: "asset", kind: "character" }, "candidate"]);
        let projected: unknown;
        const adoption = await executeDramaAgentAction(normalizeCanvasAgentAction("adopt_drama_output", { clipId: "clip", runId: "run", outputIndex: 1, expectedRevision: 0, clipRevision: 3 }), {
            ...base,
            onOutputAdopted: async (input) => {
                projected = input;
                return { nodeId: input.nodeId, storageId: input.output.storageId };
            },
        });
        assert.equal(adoption?.ok, true);
        assert.equal(posts.find((item) => item.url.endsWith("/adoption"))?.data.storageId, "chosen");
        assert.deepEqual(projected, { clipId: "clip", nodeId: "video", kind: "video", runId: "run", output: { storageId: "chosen", url: "/chosen", mimeType: "video/mp4" } });
    } finally {
        axios.defaults.adapter = adapter;
    }
});

test("voice binding accepts multiple labelled speakers in one Shot", async () => {
    const adapter = axios.defaults.adapter;
    const posts: string[] = [];
    const detail = { project: { id: "project", title: "P", sourceType: "script", sourceText: "", adaptation: "", globalStyle: "", revision: 1 }, episodes: [{ id: "episode", canvasId: "canvas", title: "E", script: "", revision: 1 }] };
    const clip = { id: "clip", projectId: "project", episodeId: "episode", title: "C02", scene: "", summary: "", entryState: "", exitState: "", shots: [{ id: "shot", title: "", duration: 2, action: "", dialogue: "Alice：实际对白\nBob：回应", speaker: "双人同镜", camera: "", sound: "", entryState: "", exitState: "" }], archived: false, position: 0, revision: 2, createdAt: "", updatedAt: "" };
    const references = [
        { assetId: "visual", versionId: "visual-v1", role: "character", order: 0, speaker: "" },
        { assetId: "voice", versionId: "voice-v1", role: "voice", order: 1, speaker: "Alice" },
		{ assetId: "voice-bob", versionId: "voice-bob-v1", role: "voice", order: 2, speaker: "Bob" },
    ];
    const catalog = {
        assets: [
            { id: "visual", projectId: "project", title: "Visual", kind: "character" as const, parentId: "", description: "", adoptedVersionId: "", revision: 1, archived: false },
            { id: "voice", projectId: "project", title: "Voice", kind: "voice" as const, parentId: "", description: "", adoptedVersionId: "", revision: 1, archived: false },
			{ id: "voice-bob", projectId: "project", title: "Voice Bob", kind: "voice" as const, parentId: "", description: "", adoptedVersionId: "", revision: 1, archived: false },
        ],
        versions: [
            { id: "visual-v1", assetId: "visual", storageId: "visual-storage", note: "", createdAt: "" },
            { id: "voice-v1", assetId: "voice", storageId: "voice-storage", note: "", createdAt: "" },
			{ id: "voice-bob-v1", assetId: "voice-bob", storageId: "voice-bob-storage", note: "", createdAt: "" },
        ],
    };
    axios.defaults.adapter = async (config) => {
        const url = String(config.url);
        if (config.method === "post") {
            posts.push(url);
            return { status: 200, statusText: "OK", headers: {}, config, data: { code: 0, data: { id: "binding", clipId: "clip", stage: "video", revision: 1, references } } };
        }
        const data = url.endsWith("/clips") ? [clip] : url.includes("/bindings/video") ? { id: "binding", clipId: "clip", stage: "video", revision: 0, references: [{ assetId: "visual", versionId: "visual-v1", role: "character", order: 0, speaker: "" }] } : detail;
        return { status: 200, statusText: "OK", headers: {}, config, data: { code: 0, data } };
    };
    const context = { token: "token", projectId: "project", episodeId: "episode", canvasId: "canvas", isCurrent: () => true, onChanged: () => undefined, readAssets: async () => catalog, applyBinding: async () => undefined };
    try {
        const invalid = await executeDramaAgentAction(normalizeCanvasAgentAction("update_drama_binding", { clipId: "clip", stage: "video", expectedRevision: 0, references: [...references.slice(0, 1), { ...references[1], speaker: "Qiye" }] }), context);
        assert.equal(invalid?.ok, false);
        assert.match(invalid?.message || "", /Alice.*Bob/);
        assert.equal(posts.length, 0);
        const saved = await executeDramaAgentAction(normalizeCanvasAgentAction("update_drama_binding", { clipId: "clip", stage: "video", expectedRevision: 0, references }), context);
        assert.equal(saved?.ok, true);
        assert.equal(posts.length, 1);
    } finally {
        axios.defaults.adapter = adapter;
    }
});

test("generation node rejects provider media tags in source prompts", async () => {
    const adapter = axios.defaults.adapter;
    const detail = { project: { id: "project", title: "P", sourceType: "script", sourceText: "", adaptation: "", globalStyle: "", revision: 1 }, episodes: [{ id: "episode", canvasId: "canvas", title: "E", script: "", revision: 1 }] };
    const clip = { id: "clip", projectId: "project", episodeId: "episode", title: "C", scene: "", summary: "", entryState: "", exitState: "", shots: [], archived: false, position: 0, revision: 1, createdAt: "", updatedAt: "" };
    axios.defaults.adapter = async (config) => ({ status: 200, statusText: "OK", headers: {}, config, data: { code: 0, data: String(config.url).endsWith("/clips") ? [clip] : detail } });
    try {
        const result = await executeDramaAgentAction(
            normalizeCanvasAgentAction("update_drama_generation_node", {
                clipId: "clip",
                nodeId: "node",
                stage: "video",
                prompt: "<Picture 1> is the storyboard",
                parameters: {},
            }),
            {
                token: "token",
                projectId: "project",
                episodeId: "episode",
                canvasId: "canvas",
                isCurrent: () => true,
                onChanged: () => undefined,
                readAssets: async () => ({ assets: [], versions: [] }),
                updateGenerationNode: async () => ({ updated: true }),
            },
        );
        assert.equal(result?.ok, false);
        assert.match(result?.message || "", /源提示词不能包含提供方媒体标签/);
    } finally {
        axios.defaults.adapter = adapter;
    }
});
