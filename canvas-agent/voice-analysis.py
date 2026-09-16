#!/usr/bin/env python3
"""Analyze a local media file and return timestamped speech segments as JSON."""

import json
import os
import sys


def emit(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main():
    if len(sys.argv) != 3:
        emit({"ok": False, "code": "speech_analysis_unavailable", "message": "语音分析参数无效"})
        return 2

    source_path = sys.argv[1]
    try:
        target_seconds = float(sys.argv[2])
    except ValueError:
        emit({"ok": False, "code": "speech_analysis_unavailable", "message": "目标时长无效"})
        return 2

    if not os.path.isfile(source_path):
        emit({"ok": False, "code": "media_read_failed", "message": "找不到待分析媒体"})
        return 2

    try:
        import av

        with av.open(source_path) as container:
            if not any(stream.type == "audio" for stream in container.streams):
                emit({"ok": False, "code": "audio_track_not_found", "message": "该文件没有可提取的音轨"})
                return 0
    except Exception as error:
        emit({"ok": False, "code": "media_read_failed", "message": "无法读取媒体音轨：" + str(error)})
        return 0

    try:
        from faster_whisper import WhisperModel

        model_name = os.environ.get("CANVAS_AGENT_WHISPER_MODEL", "small")
        model = WhisperModel(model_name, device="cpu", compute_type="int8", local_files_only=True)
        segments, info = model.transcribe(
            source_path,
            vad_filter=True,
            word_timestamps=True,
            condition_on_previous_text=False,
        )
        result_segments = []
        for segment in segments:
            text = (segment.text or "").strip()
            start = float(segment.start)
            end = float(segment.end)
            if not text or end <= start:
                continue
            result_segments.append({
                "startSeconds": round(start, 3),
                "endSeconds": round(end, 3),
                "text": text,
                "avgLogProb": round(float(segment.avg_logprob), 4),
                "noSpeechProb": round(float(segment.no_speech_prob), 4),
            })
        emit({
            "ok": True,
            "targetSeconds": target_seconds,
            "language": getattr(info, "language", "") or "",
            "segments": result_segments,
        })
        return 0
    except Exception as error:
        message = str(error)
        code = "speech_analysis_unavailable" if "model" in message.lower() or "faster_whisper" in message.lower() else "speech_analysis_failed"
        emit({"ok": False, "code": code, "message": "语音分析失败：" + message})
        return 0


if __name__ == "__main__":
    sys.exit(main())
