import type { DramaShot } from "@/services/api/drama";

const dialogueSpeakerPrefix = /^[\t ]*([^\t \r\n:：]{1,64})[\t ]*[:：]/;

export function dramaShotDialogueSpeakers(shot: Pick<DramaShot, "dialogue" | "speaker">) {
    if (!shot.dialogue.trim()) return [] as string[];
    const speakers: string[] = [];
    for (const line of shot.dialogue.replace(/\r\n/g, "\n").split("\n")) {
        const match = line.match(dialogueSpeakerPrefix);
        if (!match || !line.slice(match[0].length).trim()) continue;
        const speaker = match[1].trim().replace(/^[【\[]|[】\]]$/g, "");
        if (speaker && !speakers.includes(speaker)) speakers.push(speaker);
    }
    return speakers.length ? speakers : shot.speaker.trim() ? [shot.speaker.trim()] : [];
}

export function dramaClipDialogueSpeakers(shots: Array<Pick<DramaShot, "dialogue" | "speaker">>) {
    return [...new Set(shots.flatMap(dramaShotDialogueSpeakers))];
}
