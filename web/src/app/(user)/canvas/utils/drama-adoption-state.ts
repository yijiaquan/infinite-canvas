import type { DramaAdoption } from "@/services/api/drama-adoption";
import type { CanvasNodeData } from "../types";

export function mergeDramaAdoptionStates(nodes: CanvasNodeData[], adoptions: DramaAdoption[]) {
    let changed = false;
    const next = [...nodes];
    for (const adoption of adoptions) {
        if (adoption.kind !== "image" && adoption.kind !== "video") continue;
        const role = adoption.kind === "video" ? "video" : "storyboard";
        const index = next.findIndex((node) => node.metadata?.dramaClipId === adoption.clipId && node.metadata?.dramaRole === role);
        if (index < 0 || next[index].metadata?.storageKey === `server:${adoption.storageId}`) continue;
        changed = true;
        next[index] = {
            ...next[index],
            metadata: {
                ...next[index].metadata,
                content: `/api/files/${adoption.storageId}/content`,
                storageKey: `server:${adoption.storageId}`,
                dramaRunId: adoption.runId,
                status: "success",
                errorDetails: undefined,
            },
        };
    }
    return changed ? next : nodes;
}
