import { apiGet, apiPost } from "./request";
export function registeredDramaStorageId(key?: string) {
    return key && /^server:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key) ? key.slice(7) : "";
}

export type DramaRunReference = { storageId: string; role: string; order: number; assetId?: string; versionId?: string; title?: string; speaker?: string };
export type DramaInputMapping = { referenceOrder: number; storageId: string; port: string; tag: string; kind: "image" | "video" | "embedded_audio" | "audio"; presentationOrder: number; speaker?: string };
export type DramaRunInput = {
    requestId: string;
    nodeId: string;
    kind: "image" | "video";
    model: string;
    channelId: string;
    prompt: string;
    parameters: Record<string, string | number | boolean>;
    references: DramaRunReference[];
};
export type DramaRun = {
    id: string;
    clipId: string;
    nodeId: string;
    kind: "image" | "video";
    status: string;
    upstreamId: string;
    createdAt: string;
    updatedAt: string;
    error: string;
    snapshot: DramaRunInput & { inputMapping?: DramaInputMapping[] };
    outputs: { storageId: string; url: string; mimeType: string }[];
};
const runsBase = (projectId: string, episodeId: string, clipId: string) => `/api/v1/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/clips/${encodeURIComponent(clipId)}/runs`;
export const listDramaRuns = (token: string, projectId: string, episodeId: string, clipId: string) => apiGet<DramaRun[]>(runsBase(projectId, episodeId, clipId), undefined, token);
export const listDramaEpisodeRuns = (token: string, projectId: string, episodeId: string) => apiGet<DramaRun[]>(`/api/v1/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/runs`, undefined, token);
export const enqueueDramaRun = (token: string, projectId: string, episodeId: string, clipId: string, input: DramaRunInput) => apiPost<DramaRun>(runsBase(projectId, episodeId, clipId), input, token);
export const previewDramaRun = (token: string, projectId: string, episodeId: string, clipId: string, input: DramaRunInput) =>
    apiPost<{ snapshot: DramaRun["snapshot"]; credits: number; kind: string }>(`${runsBase(projectId, episodeId, clipId)}/preview`, input, token);
export const cancelDramaRun = (token: string, projectId: string, episodeId: string, clipId: string, runId: string) => apiPost<DramaRun>(`${runsBase(projectId, episodeId, clipId)}/${encodeURIComponent(runId)}/cancel`, {}, token);
export const recheckDramaRun = (token: string, projectId: string, episodeId: string, clipId: string, runId: string) => apiPost<DramaRun>(`${runsBase(projectId, episodeId, clipId)}/${encodeURIComponent(runId)}/recheck`, {}, token);

export async function uploadDramaMedia(token: string, file: Blob, filename = "media") {
    const data = new FormData();
    data.append("file", file, filename);
    const response = await fetch("/api/v1/drama/media", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: data });
    const result = await response.json();
    if (!response.ok || result.code !== 0) throw new Error(result.msg || "媒体保存失败");
    return result.data as { id: string; url: string; storageKey: string; mimeType: string; bytes: number };
}
