import { firstString, normalizeDirectStatus, readDirectError, readPath, readString } from "./shared";
import type { DirectProtocolAdapter } from "./types";

export const comfyUIDirectProtocol: DirectProtocolAdapter = {
    rawAuthorization: true,
    pollPath: (taskId) => `/api/ai/comfyui/tasks/${encodeURIComponent(taskId)}`,
    pollURL(baseUrl, taskId) {
        return `${this.pollPath(taskId)}?baseUrl=${encodeURIComponent(baseUrl.trim().replace(/\/+$/, ""))}`;
    },
    readTaskId: (payload) => firstString(readPath(payload, "task_id"), readPath(payload, "prompt_id")),
    readCreatedVideoStatus: (payload) => normalizeDirectStatus(readString(readPath(payload, "status"))),
    readImagePoll(payload) {
        const urls = Array.isArray(readPath(payload, "image_urls")) ? (readPath(payload, "image_urls") as unknown[]).map(readString).filter(Boolean) : [];
        const status = normalizeDirectStatus(readString(readPath(payload, "status")));
        return { urls, done: status === "completed" || status === "failed", error: readComfyUIError(payload) };
    },
    readAudioPoll(payload) {
        const status = normalizeDirectStatus(readString(readPath(payload, "status")));
        const url = readString(readPath(payload, "audio_url"));
        return { url, done: status === "completed" || status === "failed", error: readComfyUIError(payload) || (status === "completed" && !url ? "ComfyUI 任务完成但没有音频输出" : "") };
    },
    readVideoPoll(payload, pollId, model) {
        const status = normalizeDirectStatus(readString(readPath(payload, "status")));
        const url = readString(readPath(payload, "video_url"));
        const error = readComfyUIError(payload) || (status === "completed" && !url ? "ComfyUI 任务完成但没有视频输出" : "");
        return { id: pollId, task_id: pollId, status: error ? "failed" : status, progress: status === "completed" ? 100 : 0, ...(url ? { video_url: url, url } : {}), ...(error ? { error: { message: error } } : {}), model };
    },
    readError: readComfyUIError,
};

function readComfyUIError(payload: unknown) {
    return readDirectError(payload) || firstString(readPath(payload, "error.message"), readPath(payload, "message"));
}
