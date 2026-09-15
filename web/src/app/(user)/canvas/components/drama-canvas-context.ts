"use client";

import { createContext } from "react";
import type { DramaClip } from "@/services/api/drama";
import type { DramaRunReference } from "@/services/api/drama-runs";
import type { CanvasNodeData, CanvasNodeMetadata, CanvasConnection } from "../types";

export const DramaCanvasContext = createContext<{
    canvasId: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    bindInputs: (nodeId: string, references: (DramaRunReference & { title: string })[]) => void;
    prepare: (clip: DramaClip) => void;
    prepareMany: (clips: DramaClip[]) => void;
    updateMetadata: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    updatePrompt: (nodeId: string, prompt: string) => void;
    focus: (nodeId: string) => void;
} | null>(null);
