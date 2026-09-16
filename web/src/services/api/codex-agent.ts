export type CodexConnection = { endpoint: string; token: string };
const CANVAS_CODEX_CONNECTION_KEY = "canvas-codex-connection";
export type CanvasVoiceAnalysisSegment = {
    startSeconds: number;
    endSeconds: number;
    text: string;
    avgLogProb?: number;
    noSpeechProb?: number;
};
export type CanvasVoiceAnalysisResult = {
    ok: boolean;
    code?: string;
    message?: string;
    language?: string;
    segments?: CanvasVoiceAnalysisSegment[];
};
export type CodexRpcEvent = {
    id?: string | number;
    generation: number;
    method: string;
    params: Record<string, unknown> & {
        threadId?: string; turnId?: string; itemId?: string; delta?: string;
        item?: { id: string; type: string; text?: string };
        turn?: { id: string; status: string; error?: { message: string } };
    };
};
export type CodexToolEvent = { requestId: string; source: "codex" | "external"; generation: number; name: string; arguments: Record<string, unknown> };
export type CodexModel = {
    model: string; displayName: string; defaultReasoningEffort: string; isDefault: boolean;
    supportedReasoningEfforts: Array<{ reasoningEffort: string; description: string }>;
};
type CodexAgentResult = Record<string, unknown> & { error?: string; msg?: string };
export function normalizeCodexEndpoint(endpoint: string) {
    try {
        const url = new URL(endpoint);
        if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
        return url.origin;
    } catch { throw new Error("本地 Agent 地址必须为 http://127.0.0.1:端口"); }
}
export async function parseCodexAgentResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    try { return JSON.parse(text) as T; }
    catch {
        throw new Error("本地地址返回的不是 Canvas Agent 数据，请确认端口与 Agent 启动输出一致");
    }
}
export async function readCodexAgentConfig(endpoint: string): Promise<{ url: string; hasToken: boolean }> {
    const url = normalizeCodexEndpoint(endpoint);
    let response: Response;
    try { response = await fetch(url + "/config", { signal: AbortSignal.timeout(5_000) }); }
    catch { throw new Error("未连接到本地 Agent，请先启动服务，再使用插件自动连接"); }
    const result = await parseCodexAgentResponse<{ url: string; hasToken: boolean; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || "无法读取本地 Agent 状态");
    return result;
}
export function readStoredCodexAgentConnection(): CodexConnection | null {
    try {
        const value = JSON.parse(localStorage.getItem(CANVAS_CODEX_CONNECTION_KEY) || "null");
        if (!value || typeof value.endpoint !== "string" || typeof value.token !== "string" || !value.token.trim()) return null;
        return { endpoint: normalizeCodexEndpoint(value.endpoint), token: value.token.trim() };
    } catch {
        return null;
    }
}
export async function analyzeCanvasVoiceExcerpt(media: Blob, targetSeconds: number, signal?: AbortSignal): Promise<CanvasVoiceAnalysisResult> {
    const connection = readStoredCodexAgentConnection();
    if (!connection) return { ok: false, code: "speech_analysis_unavailable", message: "未连接支持语音分析的本地 Canvas Agent" };
    let response: Response;
    try {
        response = await fetch(connection.endpoint + "/voice-analysis", {
            method: "POST",
            headers: {
                "content-type": "application/octet-stream",
                "x-canvas-agent-token": connection.token,
                "x-canvas-media-mime": media.type || "application/octet-stream",
                "x-canvas-voice-target-seconds": String(targetSeconds),
            },
            body: media,
            signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(100_000)]) : AbortSignal.timeout(100_000),
        });
    } catch (error) {
        return { ok: false, code: "speech_analysis_unavailable", message: "本地语音分析服务不可用：" + (error instanceof Error ? error.message : "未知错误") };
    }
    try {
        const result = await parseCodexAgentResponse<CanvasVoiceAnalysisResult>(response);
        if (!response.ok) return { ok: false, code: result.code || "speech_analysis_unavailable", message: result.message || "本地语音分析服务请求失败" };
        return result;
    } catch (error) {
        return { ok: false, code: "speech_analysis_unavailable", message: error instanceof Error ? error.message : "本地语音分析服务响应无效" };
    }
}
export function createCodexAgentClient(
    connection: CodexConnection,
    canvasId: string,
    tools: unknown[],
    handlers: { rpc: (event: CodexRpcEvent) => void; tool: (event: CodexToolEvent) => void; cancelTool: (requestId: string) => void; ready: () => Promise<void>; reconnecting: (error?: Error) => void; error: (error: Error) => void },
) {
    const clientId = crypto.randomUUID();
    const endpoint = normalizeCodexEndpoint(connection.endpoint);
    const lifetime = new AbortController();
    let codexGeneration = 0;
    let serviceId = "";
    let registered = false;
    let activitySequence = 0;
    let registrationRetry: ReturnType<typeof setTimeout> | undefined;
    const connectionTimeout = setTimeout(() => {
        if (!registered && !lifetime.signal.aborted) fail(new Error("连接本地 Agent 超时，请确认服务仍在运行后重试"));
    }, 12_000);
    const syncCodexGeneration = (generation: number, message: string) => {
        if (!(generation > codexGeneration)) return;
        const previous = codexGeneration;
        codexGeneration = generation;
        handlers.rpc({ generation: previous, method: "bridge/disconnected", params: { message } });
    };
    const request = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
        const response = await fetch(endpoint + path, {
            method: "POST",
            headers: { "content-type": "application/json", "x-canvas-agent-token": connection.token },
            body: JSON.stringify({ clientId, ...body }),
            signal: path === "/rpc" ? lifetime.signal : AbortSignal.any([lifetime.signal, AbortSignal.timeout(30_000)]),
        });
        const result = await parseCodexAgentResponse<CodexAgentResult>(response);
        if (path === "/rpc") syncCodexGeneration(Number(response.headers.get("x-canvas-agent-generation")), result?.error || "Codex 连接已断开");
        if (!response.ok && !(path === "/result" && response.status === 409)) throw new Error(result.error || result.msg || "本地 Codex 请求失败");
        return result as T;
    };
    const rpc = async <T>(method: string, params: Record<string, unknown> = {}): Promise<T> => {
        const generation = codexGeneration;
        let result: T | undefined;
        try { result = await request<T>("/rpc", { method, params, generation }); }
        catch (error) { if (generation === codexGeneration) throw error; }
        if (generation !== codexGeneration) throw new DOMException("Codex 请求已停止", "AbortError");
        return result as T;
    };
    const events = new EventSource(endpoint + "/events?" + new URLSearchParams({ clientId, token: connection.token }));
    const fail = (error: unknown) => {
        if (!lifetime.signal.aborted) handlers.error(error instanceof Error ? error : new Error("本地 Agent 连接已断开"));
    };
    const listen = <T>(name: string, listener: (value: T) => void) => events.addEventListener(name, (event) => {
        try { listener(JSON.parse((event as MessageEvent).data) as T); } catch (error) { fail(error); }
    });
    listen<CodexRpcEvent>("rpc", (event) => {
        if (event.generation !== codexGeneration) return;
        if (event.method === "bridge/disconnected") syncCodexGeneration(event.generation + 1, String(event.params?.message || "Codex 连接已断开"));
        else handlers.rpc({ ...event, params: event.params || {} });
    });
    listen<CodexToolEvent>("tool", (event) => { if (event.source === "external" || event.generation === codexGeneration) handlers.tool(event); });
    listen<{ requestId: string }>("tool-cancel", ({ requestId }) => handlers.cancelTool(requestId));
    const activity = () => ({ sequence: ++activitySequence, observedAt: Date.now() });
    const isActivePage = () => document.visibilityState === "visible" && document.hasFocus();
    const activate = () => {
        if (!registered || !isActivePage() || lifetime.signal.aborted) return;
        void request("/activate", { canvasId, ...activity() }).catch((reason) => {
            if (!lifetime.signal.aborted) handlers.reconnecting(reason instanceof Error ? reason : new Error("本地 Agent 画布激活失败"));
        });
    };
    window.addEventListener("focus", activate);
    window.addEventListener("pageshow", activate);
    document.addEventListener("visibilitychange", activate);
    const register = () => {
        if (lifetime.signal.aborted || events.readyState !== EventSource.OPEN) return;
        clearTimeout(registrationRetry);
        registrationRetry = undefined;
        const currentActivity = isActivePage() ? activity() : undefined;
        void request<{ serviceId: string }>("/connect", { canvasId, tools, activity: currentActivity })
            .then((result) => {
                registered = true;
                clearTimeout(connectionTimeout);
                serviceId = result.serviceId;
                return handlers.ready();
            })
            .catch((reason) => {
                if (lifetime.signal.aborted) return;
                handlers.reconnecting(reason instanceof Error ? reason : new Error("本地 Agent 重新注册失败"));
                clearTimeout(registrationRetry);
                registrationRetry = setTimeout(register, 2_000);
            });
    };
    events.onopen = register;
    events.onerror = () => {
        if (!lifetime.signal.aborted) handlers.reconnecting();
    };
    return {
        rpc,
        stop: () => { codexGeneration += 1; return rpc("bridge/stop"); },
        interrupt: (threadId: string, turnId: string) => rpc("turn/interrupt", { threadId, turnId }),
        get serviceId() { return serviceId; },
        reply: (event: CodexRpcEvent, result?: unknown, error?: { code: number; message: string }) => request("/reply", { id: event.id, generation: event.generation, result, error }),
        result: (requestId: string, result?: unknown, error?: string) => request("/result", { requestId, result, error }),
        connected: () => events.readyState === EventSource.OPEN,
        signal: lifetime.signal,
        close: () => {
            registered = false;
            window.removeEventListener("focus", activate);
            window.removeEventListener("pageshow", activate);
            document.removeEventListener("visibilitychange", activate);
            clearTimeout(registrationRetry);
            clearTimeout(connectionTimeout);
            events.close();
            lifetime.abort();
        },
    };
}
