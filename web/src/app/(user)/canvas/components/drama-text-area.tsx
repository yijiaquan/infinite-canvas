import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import type { CanvasConnection, CanvasNodeData } from "../types";
import { buildDramaPromptReferences } from "../utils/drama-prompt-references";
import { CanvasPromptChipInput } from "./canvas-prompt-chip-input";

export function DramaTextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea {...props} className={cn("block w-full rounded-md border border-current/20 bg-transparent px-3 py-2 text-sm leading-relaxed outline-none transition placeholder:opacity-45 focus:border-current/45 focus:ring-2 focus:ring-current/10 disabled:cursor-not-allowed disabled:opacity-45", className)} />;
}

export function DramaPromptEditor({ node, nodes, connections, onChange, className, placeholder }: { node: CanvasNodeData; nodes: CanvasNodeData[]; connections: CanvasConnection[]; onChange: (value: string) => void; className?: string; placeholder?: string }) {
    return (
        <CanvasPromptChipInput
            value={node.metadata?.prompt || ""}
            references={buildDramaPromptReferences(node, nodes, connections)}
            onChange={onChange}
            placeholder={placeholder}
            className={cn("block w-full rounded-md border border-current/20 bg-transparent px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-current/45 focus:ring-2 focus:ring-current/10", className)}
        />
    );
}
