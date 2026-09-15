"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { autoDLBaseUrl, isAutoDLConfig } from "@/lib/autodl";
import { fetchAutoDLWorkflow, fetchAutoDLWorkflows } from "@/services/api/autodl";
import type { AiConfig } from "@/stores/use-config-store";

export function useAutoDLWorkflow(config: AiConfig, model = config.model) {
    const baseUrl = autoDLBaseUrl(config, model);
    const enabled = isAutoDLConfig(config, model) && Boolean(model);
    return useQuery({
        queryKey: ["autodl", enabled ? baseUrl : "", model],
        queryFn: () => fetchAutoDLWorkflow(baseUrl, model),
        enabled,
        staleTime: 300_000,
    });
}

type AutoDLChannel = { protocol?: string; baseUrl?: string };

const comfyUIWorkflowNames: Record<string, string> = {
	"comfyui:minimax-h3-t2v": "MiniMax-H3 文生视频 3070Ti-8GB",
	"comfyui:minimax-h3-fl2v": "MiniMax-H3 首尾帧生视频 3070Ti-8GB",
	"comfyui:minimax-h3-ref2v": "MiniMax-H3 参考生视频 3070Ti-8GB",
	"comfyui:minimax-music3": "MiniMax-Music3 INT8",
	"comfyui:openai-image": "OpenAI兼容 图片生成与编辑",
	"comfyui:seedvr2-image-upscale": "SeedVR2 7B FP16 图片超分",
	"comfyui:vosr2-image-upscale": "VOSR 2.0 图片超分（文字与细节）",
	"comfyui:seedvr2-upscale": "SeedVR2 7B FP16 视频超分",
};

export function useAutoDLWorkflowNames(channels: AutoDLChannel[]) {
    const baseUrls = [...new Set(channels.filter((channel) => channel.protocol === "autodl").map((channel) => (channel.baseUrl || "https://autodl.art").trim().replace(/\/+$/, "")))];
    const queries = useQueries({ queries: baseUrls.map((baseUrl) => ({
        queryKey: ["autodl", baseUrl, "workflows"],
        queryFn: () => fetchAutoDLWorkflows(baseUrl),
        staleTime: 300_000,
    })) });
	return (model: string, channel?: AutoDLChannel | null) => {
		if (channel?.protocol === "comfyui") return comfyUIWorkflowNames[model] || model;
        if (channel?.protocol !== "autodl") return model;
        const baseUrl = (channel.baseUrl || "https://autodl.art").trim().replace(/\/+$/, "");
        return queries[baseUrls.indexOf(baseUrl)]?.data?.find((workflow) => workflow.uuid === model)?.name || model;
    };
}
