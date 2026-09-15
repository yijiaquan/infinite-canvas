import { apiPost } from "./request";

export type ComfyUIWorkflow = {
    id: string;
    name: string;
    kind: "image" | "video" | "audio";
    filename: string;
    ready: boolean;
};

export function fetchComfyUIWorkflows(baseUrl: string) {
    return apiPost<ComfyUIWorkflow[]>("/api/ai/comfyui/workflows", { baseUrl });
}
