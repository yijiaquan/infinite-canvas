import { create } from "zustand";
import { useUserStore } from "@/stores/use-user-store";
import type { DramaClip, DramaClipDraft } from "@/services/api/drama";

// Unsubmitted edits survive Next.js history navigation within this login session.
type ClipEdit = { base: DramaClip; draft: DramaClipDraft };
export const useDramaDraftStore = create<{ clips: Record<string, ClipEdit> }>(() => ({ clips: {} }));
export function keepClipEdit(episodeId: string, edit: ClipEdit | null) {
    useDramaDraftStore.setState((state) => {
        const clips = { ...state.clips };
        if (edit) clips[episodeId] = edit;
        else delete clips[episodeId];
        return { clips };
    });
}
useUserStore.subscribe((state, previous) => {
    if (state.token !== previous.token) useDramaDraftStore.setState({ clips: {} });
});
