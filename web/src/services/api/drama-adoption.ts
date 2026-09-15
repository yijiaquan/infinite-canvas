import { apiGet, apiPost } from "./request";

export type DramaAdoption = { id: string; clipId: string; kind: string; runId: string; storageId: string; clipRevision: number; revision: number; updatedAt: string; needsReview: boolean };
const base = (p: string, e: string, c: string) => `/api/v1/drama/projects/${encodeURIComponent(p)}/episodes/${encodeURIComponent(e)}/clips/${encodeURIComponent(c)}/adoption`;
export const listDramaAdoptions = (token: string, p: string, e: string, c: string) => apiGet<DramaAdoption[]>(base(p, e, c), undefined, token);
export const listDramaEpisodeAdoptions = (token: string, p: string, e: string) => apiGet<DramaAdoption[]>(`/api/v1/drama/projects/${encodeURIComponent(p)}/episodes/${encodeURIComponent(e)}/adoptions`, undefined, token);
export const adoptDramaOutput = (token: string, p: string, e: string, c: string, input: { runId: string; storageId: string; expectedRevision: number; clipRevision: number }) => apiPost<DramaAdoption>(base(p, e, c), input, token);
export async function downloadDramaEpisode(token: string, projectId: string, episodeId: string, partial: boolean) {
    const response = await fetch(`/api/v1/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/export?partial=${partial}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/zip")) {
        const result = await response.json();
        throw new Error(result.msg || "导出失败");
    }
    const { saveAs } = await import("file-saver");
    saveAs(await response.blob(), `episode-${episodeId}.zip`);
}
