import type { DramaRun } from "@/services/api/drama-runs";
import type { CanvasNodeData, CanvasNodeMetadata } from "../types";

export function mergeDramaRunStates(nodes: CanvasNodeData[], runs: DramaRun[]): CanvasNodeData[] {
    let changed = false;
    const next = nodes.map((node) => {
        if (!node.metadata?.dramaRunId) return node;
        const run = runs.find((item) => item.id === node.metadata!.dramaRunId && item.nodeId === node.id);
        if (!run) return node;
        const patch: Partial<CanvasNodeMetadata> = {};
        if (["queued", "preparing", "submitting", "running", "saving"].includes(run.status)) patch.status = "loading";
        else if (run.status === "completed") {
            patch.status = "success";
            patch.errorDetails = "";
            if (!node.metadata.content && run.outputs?.[0]) {
                const output = run.outputs[0];
                patch.content = output.url;
                patch.storageKey = `server:${output.storageId}`;
                patch.mimeType = output.mimeType;
            }
            patch.dramaNeedsReview = node.metadata.prompt !== run.snapshot.prompt;
        } else if (run.status === "cancelled") {
            patch.status = node.metadata.content ? "success" : "idle";
            patch.errorDetails = "";
        } else {
            patch.status = "error";
            patch.errorDetails = run.error || "任务状态需要核查";
        }
        if (Object.entries(patch).every(([key, value]) => node.metadata?.[key as keyof CanvasNodeMetadata] === value)) return node;
        changed = true;
        return { ...node, metadata: { ...node.metadata, ...patch } };
    });
    return changed ? next : nodes;
}
