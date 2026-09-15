import { apiGet, apiPost } from "./request";

export type DramaProject = {
    id: string;
    title: string;
    sourceType: "novel" | "script";
    sourceText: string;
    adaptation: string;
    globalStyle: string;
    generationDefaults?: Partial<Record<"image" | "video", Record<string, string | number | boolean>>>;
    revision: number;
    createdAt: string;
    updatedAt: string;
};

export type DramaEpisode = {
    id: string;
    projectId: string;
    canvasId: string;
    title: string;
    position: number;
    script: string;
    revision: number;
    createdAt: string;
    updatedAt: string;
};

export type DramaProjectDraft = Pick<DramaProject, "title" | "sourceType" | "sourceText" | "adaptation" | "globalStyle" | "generationDefaults">;
export type DramaEpisodeDraft = Pick<DramaEpisode, "title" | "script">;
export type DramaProjectDetail = { project: DramaProject; episodes: DramaEpisode[] };

const base = "/api/v1/drama/projects";
export const listDramaProjects = (token: string) => apiGet<DramaProject[]>(base, undefined, token);
export const getDramaProject = (token: string, id: string) => apiGet<DramaProjectDetail>(`${base}/${encodeURIComponent(id)}`, undefined, token);
export const createDramaProject = (token: string, draft: DramaProjectDraft) => apiPost<DramaProject>(base, draft, token);
export const updateDramaProject = (token: string, id: string, draft: DramaProjectDraft, expectedRevision: number) => apiPost<DramaProject>(`${base}/${encodeURIComponent(id)}`, { ...draft, expectedRevision }, token);
export const createDramaEpisode = (token: string, projectId: string, draft: DramaEpisodeDraft) => apiPost<DramaEpisode>(`${base}/${encodeURIComponent(projectId)}/episodes`, draft, token);
export const updateDramaEpisode = (token: string, projectId: string, id: string, draft: DramaEpisodeDraft, expectedRevision: number) =>
    apiPost<DramaEpisode>(`${base}/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(id)}`, { ...draft, expectedRevision }, token);

export type DramaShot = {
    id: string;
    title: string;
    duration: number;
    action: string;
    dialogue: string;
    speaker: string;
    camera: string;
    sound: string;
    entryState: string;
    exitState: string;
};
export type DramaClipDraft = {
    title: string;
    scene: string;
    summary: string;
    entryState: string;
    exitState: string;
    shots: DramaShot[];
    archived: boolean;
};
export type DramaClip = DramaClipDraft & {
    id: string;
    projectId: string;
    episodeId: string;
    position: number;
    revision: number;
    createdAt: string;
    updatedAt: string;
};
const clipsBase = (projectId: string, episodeId: string) => `${base}/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/clips`;
export const reorderDramaClips = (token: string, projectId: string, episodeId: string, clips: DramaClip[]) =>
    apiPost<DramaClip[]>(`${clipsBase(projectId, episodeId)}/reorder`, { clips: clips.map((clip) => ({ id: clip.id, expectedRevision: clip.revision })) }, token);
export const listDramaClips = (token: string, projectId: string, episodeId: string) => apiGet<DramaClip[]>(clipsBase(projectId, episodeId), undefined, token);
export const createDramaClip = (token: string, projectId: string, episodeId: string, draft: DramaClipDraft) => apiPost<DramaClip>(clipsBase(projectId, episodeId), draft, token);
export const updateDramaClip = (token: string, projectId: string, episodeId: string, id: string, draft: DramaClipDraft, expectedRevision: number) =>
    apiPost<DramaClip>(`${clipsBase(projectId, episodeId)}/${encodeURIComponent(id)}`, { ...draft, expectedRevision }, token);
