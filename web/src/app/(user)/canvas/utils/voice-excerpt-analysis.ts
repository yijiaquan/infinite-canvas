export type VoiceAnalysisSegment = {
    startSeconds: number;
    endSeconds: number;
    text: string;
    avgLogProb?: number;
    noSpeechProb?: number;
};

export type VoiceExcerptSelection = {
    startSeconds: number;
    endSeconds: number;
    duration: number;
    transcript: string;
    confidence: number;
    shorterThanTarget: boolean;
    speakerUnverified: boolean;
};

const MIN_EXCERPT_SECONDS = 0.5;
const JOIN_GAP_SECONDS = 0.75;

function finite(value: number) {
    return Number.isFinite(value);
}

function normalizedConfidence(segment: VoiceAnalysisSegment) {
    const logProbability = finite(segment.avgLogProb ?? Number.NaN) ? Math.max(-4, Math.min(0, segment.avgLogProb ?? -4)) : -2;
    const noSpeech = finite(segment.noSpeechProb ?? Number.NaN) ? Math.max(0, Math.min(1, segment.noSpeechProb ?? 0.5)) : 0.5;
    return ((logProbability + 4) / 4) * 0.8 + (1 - noSpeech) * 0.2;
}

/** Select a reviewable, contiguous speech interval from Whisper/VAD output. */
export function selectVoiceExcerpt(segments: VoiceAnalysisSegment[], desiredSeconds = 4): VoiceExcerptSelection | null {
    const target = Math.max(MIN_EXCERPT_SECONDS, Math.min(12, desiredSeconds));
    const normalized = segments
        .filter((segment) => finite(segment.startSeconds) && finite(segment.endSeconds) && segment.startSeconds >= 0 && segment.endSeconds - segment.startSeconds >= MIN_EXCERPT_SECONDS && segment.text.trim())
        .map((segment) => ({ ...segment, text: segment.text.trim(), confidence: normalizedConfidence(segment) }))
        .sort((left, right) => left.startSeconds - right.startSeconds);
    if (!normalized.length) return null;

    const groups: Array<typeof normalized> = [];
    for (const segment of normalized) {
        const last = groups.at(-1);
        if (last && segment.startSeconds - last.at(-1)!.endSeconds <= JOIN_GAP_SECONDS) last.push(segment);
        else groups.push([segment]);
    }

    const candidates = groups.map((group) => {
        const start = group[0].startSeconds;
        const end = group.at(-1)!.endSeconds;
        const duration = end - start;
        const weightedConfidence = group.reduce((sum, segment) => sum + segment.confidence * (segment.endSeconds - segment.startSeconds), 0) / duration;
        const coverage = group.reduce((sum, segment) => sum + segment.endSeconds - segment.startSeconds, 0) / duration;
        const durationFit = Math.min(1, duration / target);
        return { group, start, end, duration, weightedConfidence, score: weightedConfidence * 0.65 + coverage * 0.25 + durationFit * 0.1 };
    }).sort((left, right) => right.score - left.score || left.start - right.start);

    const best = candidates[0];
    const excerptDuration = Math.min(target, best.duration);
    const startSeconds = best.start;
    const endSeconds = startSeconds + excerptDuration;
    const transcript = best.group.filter((segment) => segment.startSeconds < endSeconds).map((segment) => segment.text).join(" ");
    return {
        startSeconds: Number(startSeconds.toFixed(3)),
        endSeconds: Number(endSeconds.toFixed(3)),
        duration: Number(excerptDuration.toFixed(3)),
        transcript,
        confidence: Number(best.weightedConfidence.toFixed(3)),
        shorterThanTarget: best.duration + 0.001 < target,
        // Faster Whisper provides speech timestamps, not speaker identification.
        speakerUnverified: true,
    };
}
