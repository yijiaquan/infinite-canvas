import { apiGet, apiPost } from "./request";

export type DramaAsset = {
    id: string;
    projectId: string;
    title: string;
    kind: "character" | "expression" | "scene" | "prop" | "voice" | "reference";
    parentId: string;
    description: string;
    adoptedVersionId: string;
    defaultVoiceVersionId?: string;
    revision: number;
    archived: boolean;
};
export type DramaAssetVersion = { id: string; assetId: string; storageId: string; mimeType?: string; note: string; createdAt: string };
export type DramaAssetCatalog = { assets: DramaAsset[]; versions: DramaAssetVersion[] };
const base = (projectId: string) => `/api/v1/drama/projects/${encodeURIComponent(projectId)}/assets`;
export const listDramaAssets = (token: string, projectId: string) => apiGet<DramaAssetCatalog>(base(projectId), undefined, token);
export const createDramaAsset = (token: string, projectId: string, input: Pick<DramaAsset, "title" | "kind" | "parentId" | "description" | "defaultVoiceVersionId">) => apiPost<DramaAsset>(base(projectId), input, token);
export const updateDramaAsset = (token: string, projectId: string, id: string, input: Partial<DramaAsset> & { expectedRevision: number }) => apiPost<DramaAsset>(`${base(projectId)}/${encodeURIComponent(id)}`, input, token);
export const createDramaAssetVersion = (token: string, projectId: string, id: string, input: { storageId: string; note: string; expectedRevision: number }) =>
    apiPost<{ asset: DramaAsset; version: DramaAssetVersion }>(`${base(projectId)}/${encodeURIComponent(id)}/versions`, input, token);

export type DramaBindingReference = { assetId: string; versionId: string; role: string; order: number; speaker: string };
export type DramaBinding = { id: string; clipId: string; stage: "storyboard" | "video"; revision: number; references: DramaBindingReference[] };
const bindingBase = (p: string, e: string, c: string, stage: string) => `/api/v1/drama/projects/${encodeURIComponent(p)}/episodes/${encodeURIComponent(e)}/clips/${encodeURIComponent(c)}/bindings/${stage}`;
export const getDramaBinding = (token: string, p: string, e: string, c: string, stage: string) => apiGet<DramaBinding>(bindingBase(p, e, c, stage), undefined, token);
export const updateDramaBinding = (token: string, p: string, e: string, c: string, stage: string, references: DramaBindingReference[], expectedRevision: number) =>
    apiPost<DramaBinding>(bindingBase(p, e, c, stage), { references, expectedRevision }, token);
