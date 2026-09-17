"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { Alert, App, Button, Empty, Form, Input, Select, Spin, Tag } from "antd";
import { ExternalLink } from "lucide-react";
import { listDramaClips, type DramaClip } from "@/services/api/drama";
import { DramaCanvasContext } from "./drama-canvas-context";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { ModelPicker } from "@/components/model-picker";
import { DramaRunPanel } from "./drama-run-panel";
import { DramaBindingEditor } from "./drama-binding-editor";
import { dramaClipDialogueSpeakers } from "../utils/drama-dialogue-speakers";
import type { DramaRunReference } from "@/services/api/drama-runs";
import { DramaParameters } from "./drama-parameters";
import { DramaPromptEditor } from "./drama-text-area";
import { findDramaClipStageNode } from "../utils/drama-canvas";

export function DramaProductionView({
    token,
    projectId,
    episodeId,
    canvasId,
    stage,
    onBindingDirtyChange,
}: {
    token: string;
    projectId: string;
    episodeId: string;
    canvasId: string;
    stage: "storyboard" | "video";
    onBindingDirtyChange: (dirty: boolean) => void;
}) {
    const canvas = useContext(DramaCanvasContext);
    const config = useEffectiveConfig();
    const [clips, setClips] = useState<DramaClip[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState("");
    const [bindingState, setBindingState] = useState<{ clipId: string; references: DramaRunReference[] | null }>({ clipId: "", references: null });
    const setReferences = useCallback((references: DramaRunReference[] | null) => setBindingState({ clipId: selectedId, references }), [selectedId]);
    const references = bindingState.clipId === selectedId ? bindingState.references : null;
    const [bindingDirty, setBindingDirty] = useState(false);
    const { modal } = App.useApp();
    useEffect(() => {
        onBindingDirtyChange(bindingDirty);
        return () => onBindingDirtyChange(false);
    }, [bindingDirty, onBindingDirtyChange]);
    useEffect(() => {
        let cancelled = false;
        setBusy(true);
        setError("");
        void listDramaClips(token, projectId, episodeId)
            .then((items) => {
                if (cancelled) return;
                const active = items.filter((clip) => !clip.archived);
                setClips(active);
                setSelectedId((id) => (active.some((clip) => clip.id === id) ? id : active[0]?.id || ""));
            })
            .catch((cause) => {
                if (!cancelled) setError(cause instanceof Error ? cause.message : "制作资料加载失败");
            })
            .finally(() => {
                if (!cancelled) setBusy(false);
            });
        return () => {
            cancelled = true;
        };
    }, [token, projectId, episodeId]);
    const clip = clips.find((item) => item.id === selectedId);
    const current = canvas?.canvasId === canvasId;
    const node = current ? findDramaClipStageNode(canvas.nodes, selectedId, stage) : undefined;
    const board = current ? findDramaClipStageNode(canvas.nodes, selectedId, "storyboard") : undefined;
    const media = node?.metadata?.content;
    const status = node?.metadata?.status;
    const model = node?.metadata?.model || (stage === "storyboard" ? config.imageModel : config.videoModel);
    const channelId = node?.metadata?.channelId || config.publicChannels.find((channel) => channel.models?.includes(model))?.id;
    return (
        <Spin spinning={busy}>
            <section aria-label={stage === "storyboard" ? "导演故事板制作" : "视频提示词制作"} className="min-w-0">
                {error && <Alert type="error" showIcon title={error} className="mb-4" />}
                <Select
                    aria-label="制作 Clip"
                    className="mb-5 w-full max-w-lg"
                    value={selectedId || undefined}
                    onChange={(id) => {
                        if (bindingDirty) modal.confirm({ title: "输入绑定尚未保存", okText: "放弃并切换", cancelText: "继续编辑", onOk: () => setSelectedId(id) });
                        else setSelectedId(id);
                    }}
                    options={clips.map((item) => ({ value: item.id, label: `${item.position}. ${item.title}` }))}
                />
                {!clip ? (
                    <Empty description="暂无制作中的 Clip" />
                ) : !current ? (
                    <Empty description="请先打开本集画布" />
                ) : (
                    <>
                        <div className="mb-4 flex flex-wrap items-center gap-3">
                            <span>
                                {Number(clip.shots.reduce((sum, shot) => sum + shot.duration, 0).toFixed(3))}s · {clip.shots.length} 镜头
                            </span>
                            {status && <Tag color={status === "error" ? "error" : status === "loading" ? "processing" : undefined}>{{ idle: "未运行", loading: "处理中", success: "已生成", error: "失败" }[status]}</Tag>}
                            {node ? (
                                <Button icon={<ExternalLink size={16} />} onClick={() => canvas.focus(node.id)}>
                                    在画布中打开
                                </Button>
                            ) : (
                                <Button onClick={() => canvas.prepare(clip)}>准备画布节点</Button>
                            )}
                        </div>
                        {node?.metadata?.errorDetails && <Alert type="error" title={node.metadata.errorDetails} className="mb-4" />}
                        {stage === "video" && !board?.metadata?.content && <Alert type="warning" title="尚未准备完整导演故事板" className="mb-4" />}
                        {media && (
                            <div className="mb-6 flex justify-center">
                                {stage === "storyboard" ? (
                                    <a href={media} target="_blank" rel="noreferrer">
                                        <img src={media} alt={`${clip.title} 完整导演故事板`} className="max-h-[520px] max-w-full object-contain" />
                                    </a>
                                ) : (
                                    <video src={media} controls preload="metadata" className="max-h-[520px] w-full object-contain" />
                                )}
                            </div>
                        )}
                        {node && (
                            <Form layout="vertical">
                                <Form.Item label={stage === "storyboard" ? "故事板生成提示词" : "完整视频提示词"}>
                                <DramaPromptEditor
                                    key={`${node.id}:${node.metadata?.prompt || ""}`}
                                    node={node}
                                    nodes={canvas.nodes}
                                    connections={canvas.connections}
                                    placeholder={stage === "storyboard" ? "导演故事板提示词" : "视频制作提示词"}
                                    className="h-80 max-h-[48rem] resize-y overflow-y-auto"
                                    onChange={(value) => canvas.updatePrompt(node.id, value)}
                                />
                                </Form.Item>
                                <Form.Item label="生成模型">
                                    <ModelPicker
                                        config={{ ...config, channelMode: "remote" }}
                                        capability={stage === "storyboard" ? "image" : "video"}
                                        value={model}
                                        channelId={channelId}
                                        onChange={(model, channelId) => canvas.updateMetadata(node.id, { model, channelId })}
                                    />
                                </Form.Item>
                            </Form>
                        )}
                        {node && (
                            <Form layout="vertical">
                                <details className="mb-5">
                                    <summary className="mb-3">本节点生成参数</summary>
                                    <DramaParameters label="节点" value={node.metadata?.dramaParameters} onChange={(dramaParameters) => canvas.updateMetadata(node.id, { dramaParameters })} />
                                </details>
                            </Form>
                        )}
                        <div className="mb-6 overflow-x-auto rounded border border-current/15">
                            <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
                                <thead className="bg-black/[0.03] text-xs dark:bg-white/[0.04]">
                                    <tr>
                                        <th className="w-14 px-3 py-3 text-center font-medium">镜号</th>
                                        <th className="w-20 px-3 py-3 font-medium">时长</th>
                                        <th className="w-[27%] px-3 py-3 font-medium">画面描述</th>
                                        <th className="w-[12%] px-3 py-3 font-medium">状态衔接</th>
                                        <th className="w-[21%] px-3 py-3 font-medium">对白与旁白</th>
                                        <th className="w-[16%] px-3 py-3 font-medium">音效</th>
                                        <th className="w-[17%] px-3 py-3 font-medium">运镜</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clip.shots.map((shot, index) => (
                                        <tr key={shot.id} className="border-t border-current/10 align-top transition hover:bg-black/[0.025] dark:hover:bg-white/[0.025]">
                                            <td className="px-3 py-3 text-center opacity-60">{index + 1}</td>
                                            <td className="px-3 py-3 font-medium">{shot.duration}s</td>
                                            <td className="px-3 py-3">
                                                <div className="mb-1 font-medium">{shot.title || "未命名镜头"}</div>
                                                <div className="whitespace-pre-wrap break-words opacity-75">{shot.action || "未填写"}</div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="whitespace-pre-wrap break-words opacity-75">{shot.entryState || "未填写"}</div>
                                                {shot.exitState && <div className="mt-2 border-t border-current/10 pt-2 whitespace-pre-wrap break-words opacity-60">{shot.exitState}</div>}
                                            </td>
                                            <td className="px-3 py-3">
                                                {shot.speaker && <div className="mb-1 font-medium">{shot.speaker}</div>}
                                                <div className="whitespace-pre-wrap break-words opacity-75">{shot.dialogue || "无对白"}</div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="whitespace-pre-wrap break-words opacity-75">{shot.sound || "未填写"}</div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="whitespace-pre-wrap break-words opacity-75">{shot.camera || "未填写"}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <DramaBindingEditor
                            key={`${clip.id}:${stage}`}
                            token={token}
                            projectId={projectId}
                            episodeId={episodeId}
                            clipId={clip.id}
                            stage={stage}
                            speakers={dramaClipDialogueSpeakers(clip.shots)}
                            onChange={setReferences}
                            onDirtyChange={setBindingDirty}
                        />
                        {node && (
                            <DramaRunPanel
                                key={node.id}
                                token={token}
                                projectId={projectId}
                                episodeId={episodeId}
                                clipId={clip.id}
                                clipRevision={clip.revision}
                                node={{ ...node, metadata: { ...node.metadata, model, channelId } }}
                                references={references}
                            />
                        )}
                    </>
                )}
            </section>
        </Spin>
    );
}
