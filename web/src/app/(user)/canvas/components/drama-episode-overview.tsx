"use client";

import { useContext, useEffect, useState } from "react";
import { Alert, Button, Empty, Tag } from "antd";
import { listDramaClips, type DramaClip } from "@/services/api/drama";
import { listDramaEpisodeRuns, type DramaRun } from "@/services/api/drama-runs";
import { apiGet } from "@/services/api/request";
import type { DramaAdoption } from "@/services/api/drama-adoption";
import { DramaCanvasContext } from "./drama-canvas-context";

const stateNames: Record<string, string> = { queued: "排队", preparing: "准备", submitting: "提交中", running: "生成中", saving: "保存中", completed: "完成", failed: "失败", unknown: "待核查", save_failed: "保存失败", cancelled: "已取消" };
export function DramaEpisodeOverview({ token, projectId, episodeId, history = false }: { token: string; projectId: string; episodeId: string; history?: boolean }) {
    const canvas = useContext(DramaCanvasContext);
    const [clips, setClips] = useState<DramaClip[]>([]);
    const [runs, setRuns] = useState<DramaRun[]>([]);
    const [adoptions, setAdoptions] = useState<DramaAdoption[]>([]);
    const [error, setError] = useState("");
    useEffect(() => {
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        const refresh = async () => {
            try {
                const currentClips = await listDramaClips(token, projectId, episodeId);
                const currentRuns = await listDramaEpisodeRuns(token, projectId, episodeId);
                const adopted = await apiGet<DramaAdoption[]>(`/api/v1/drama/projects/${encodeURIComponent(projectId)}/episodes/${encodeURIComponent(episodeId)}/adoptions`, undefined, token);
                if (!stopped) {
                    setClips(currentClips);
                    setRuns(currentRuns);
                    setAdoptions(adopted);
                    setError("");
                }
            } catch (cause) {
                if (!stopped) setError(cause instanceof Error ? cause.message : "制作状态读取失败");
            } finally {
                if (!stopped) timer = setTimeout(refresh, 5000);
            }
        };
        void refresh();
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [token, projectId, episodeId]);
    return (
        <section className="mt-6 min-w-0" aria-label={history ? "分集运行历史" : "分集制作总览"}>
            {error && <Alert type="error" title={error} className="mb-4" />}
            {history
                ? runs.map((run) => (
                      <div key={run.id} className="border-b border-current/10 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                              <strong>{clips.find((clip) => clip.id === run.clipId)?.title || run.clipId}</strong>
                              <Tag>{stateNames[run.status] || run.status}</Tag>
                              <time>{new Date(run.createdAt).toLocaleString()}</time>
                          </div>
                          <p className="my-2 break-words text-sm">{run.snapshot.model}</p>
                          {run.error && <p className="my-2 whitespace-pre-wrap break-words">{run.error}</p>}
                          <details>
                              <summary>提交快照</summary>
                              <p className="whitespace-pre-wrap break-words">{run.snapshot.prompt}</p>
                          </details>
                          <div className="mt-2 flex flex-wrap gap-3">
                              {run.outputs?.map((output) => (
                                  <a key={output.storageId} href={output.url} target="_blank" rel="noreferrer">
                                      查看输出
                                  </a>
                              ))}
                          </div>
                      </div>
                  ))
                : clips
                      .filter((clip) => !clip.archived)
                      .map((clip) => {
                          const adopted = adoptions.find((item) => item.clipId === clip.id && item.kind === "video");
                          const latest = runs.find((run) => run.clipId === clip.id && run.kind === "video");
                          const group = canvas?.nodes.find((node) => node.metadata?.dramaClipId === clip.id && node.metadata?.dramaRole === "group");
                          return (
                              <div key={clip.id} className="grid gap-4 border-b border-current/10 py-5 sm:grid-cols-[200px_minmax(0,1fr)]">
                                  {adopted ? (
                                      <video src={`/api/files/${adopted.storageId}/content`} controls preload="metadata" className="aspect-video w-full object-contain" />
                                  ) : (
                                      <div className="flex aspect-video items-center justify-center text-sm">尚未采用视频</div>
                                  )}
                                  <div className="min-w-0">
                                      <strong className="break-words">
                                          {clip.position}. {clip.title}
                                      </strong>
                                      <div className="my-3 flex flex-wrap gap-2">
                                          <span>
                                              {Number(clip.shots.reduce((sum, shot) => sum + shot.duration, 0).toFixed(3))}s · {clip.shots.length} 镜头
                                          </span>
                                          <Tag>{adopted ? (adopted.needsReview ? "待复核" : "已采用") : latest ? stateNames[latest.status] || latest.status : "待制作"}</Tag>
                                      </div>
                                      <p className="mb-3 whitespace-pre-wrap break-words text-sm">{clip.summary}</p>
                                      {group && <Button onClick={() => canvas?.focus(group.id)}>定位画布</Button>}
                                  </div>
                              </div>
                          );
                      })}
            {!(history ? runs.length : clips.length) && <Empty description={history ? "暂无运行记录" : "暂无 Clip"} />}
        </section>
    );
}
