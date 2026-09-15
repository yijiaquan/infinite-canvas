import type { DramaEpisode, DramaProjectDetail } from "@/services/api/drama";
import type { CanvasProject } from "../stores/use-canvas-store";

export type DramaProjectLibraryItem = DramaProjectDetail & {
    canvasProjects: CanvasProject[];
    entryEpisode: DramaEpisode | null;
    updatedAt: string;
    nodeCount: number;
};

export function buildDramaProjectLibrary(canvasProjects: CanvasProject[], details: DramaProjectDetail[]): { ordinaryProjects: CanvasProject[]; dramaProjects: DramaProjectLibraryItem[] } {
    const ordinaryProjects = canvasProjects.filter((project) => !project.dramaProjectId);
    const canvasById = new Map(canvasProjects.map((project) => [project.id, project]));
    const dramaProjects = details
        .map((detail) => {
            const episodes = [...detail.episodes].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
            const linked = episodes.map((episode) => canvasById.get(episode.canvasId)).filter((project): project is CanvasProject => Boolean(project));
            const entryEpisode =
                [...episodes].sort((a, b) => {
                    const aTime = Date.parse(canvasById.get(a.canvasId)?.updatedAt || a.updatedAt || "") || 0;
                    const bTime = Date.parse(canvasById.get(b.canvasId)?.updatedAt || b.updatedAt || "") || 0;
                    return bTime - aTime || a.position - b.position;
                })[0] || null;
            const updatedAt = [detail.project.updatedAt, ...episodes.map((episode) => canvasById.get(episode.canvasId)?.updatedAt || episode.updatedAt)].filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || detail.project.updatedAt;
            return {
                ...detail,
                episodes,
                canvasProjects: linked,
                entryEpisode,
                updatedAt,
                nodeCount: linked.reduce((total, project) => total + project.nodes.length, 0),
            };
        })
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    return { ordinaryProjects, dramaProjects };
}
