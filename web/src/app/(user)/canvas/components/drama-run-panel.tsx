"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { Alert, App, Button, Empty, Modal, Spin, Tag } from "antd";
import { Play, RefreshCw, X } from "lucide-react";
import { cancelDramaRun, enqueueDramaRun, listDramaRuns, previewDramaRun, recheckDramaRun, type DramaRun, type DramaRunInput } from "@/services/api/drama-runs";
import { buildDramaRunInput } from "../utils/drama-generation";
import { DramaCanvasContext } from "./drama-canvas-context";
import type { CanvasNodeData } from "../types";
import { adoptDramaOutput, listDramaAdoptions, type DramaAdoption } from "@/services/api/drama-adoption";
import { flushDramaCanvasSave } from "../stores/use-canvas-store";
import { useUserStore } from "@/stores/use-user-store";

const states: Record<string, string> = { queued: "等待提交", submitting: "正在提交", running: "生成中", saving: "保存媒体", completed: "已完成", failed: "失败", unknown: "状态待核查", save_failed: "媒体保存失败", cancelled: "已取消" };

export function DramaRunPanel({
    token,
    projectId,
    episodeId,
    clipId,
    clipRevision,
    node,
    references = [],
}: {
    token: string;
    projectId: string;
    episodeId: string;
    clipId: string;
    clipRevision: number;
    node: CanvasNodeData;
    references?: DramaRunInput["references"] | null;
}) {
    const canvas = useContext(DramaCanvasContext);
    const { message } = App.useApp();
    const [runs, setRuns] = useState<DramaRun[]>([]);
    const [adoptions, setAdoptions] = useState<DramaAdoption[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState<DramaRunInput | null>(null);
    const [previewDetails, setPreviewDetails] = useState<Awaited<ReturnType<typeof previewDramaRun>> | null>(null);
    const inFlight = useRef(false);
    useEffect(() => {
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        const refresh = async () => {
            try {
                const values = await listDramaRuns(token, projectId, episodeId, clipId);
                const adopted = await listDramaAdoptions(token, projectId, episodeId, clipId);
                if (!stopped) {
                    setRuns(values);
                    setAdoptions(adopted);
                }
            } catch (cause) {
                if (!stopped) setError(cause instanceof Error ? cause.message : "运行记录加载失败");
            } finally {
                if (!stopped) timer = setTimeout(refresh, 4000);
            }
        };
        void refresh();
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [token, projectId, episodeId, clipId]);
    const perform = async (action: () => Promise<void>) => {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        try {
            await action();
            setRuns(await listDramaRuns(token, projectId, episodeId, clipId));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "操作失败");
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    };
    const prepare = () =>
        perform(async () => {
            const metadata = node.metadata || {};
            if (!metadata.prompt?.trim()) throw new Error("请填写生成提示词");
            if (!metadata.model || !metadata.channelId) throw new Error("请选择后台配置的模型渠道");
            if (!references) throw new Error("请先完成并保存输入绑定");
            if (!canvas) throw new Error("请打开当前分集画布");
            const prepared = await buildDramaRunInput(token, projectId, episodeId, node, canvas.nodes, canvas.connections, metadata.model, metadata.channelId, metadata.prompt);
            await flushDramaCanvasSave(canvas.canvasId);
            const details = await previewDramaRun(token, projectId, episodeId, clipId, prepared.input);
            if (useUserStore.getState().token !== token) return;
            setPreviewDetails(details);
            setPreview(prepared.input);
        });
    const previewAgain = (input: DramaRunInput) =>
        perform(async () => {
            if (canvas) await flushDramaCanvasSave(canvas.canvasId);
            const details = await previewDramaRun(token, projectId, episodeId, clipId, input);
            if (useUserStore.getState().token !== token) return;
            setPreviewDetails(details);
            setPreview(input);
        });
    return (
        <section aria-label="Clip 运行记录" className="mt-6 min-w-0">
            {error && <Alert title={error} type="error" showIcon className="mb-3" />}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <span>运行记录</span>
                <Button type="primary" icon={<Play size={15} />} loading={busy} onClick={() => void prepare()}>
                    预览并入队
                </Button>
            </div>
            <Spin spinning={busy}>
                {runs
                    .filter((run) => run.nodeId === node.id)
                    .map((run) => (
                        <div key={run.id} className="border-b border-current/10 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Tag>{states[run.status] || run.status}</Tag>
                                <time className="text-sm">{new Date(run.createdAt).toLocaleString()}</time>
                                {run.status === "queued" && (
                                    <Button
                                        icon={<X size={14} />}
                                        onClick={() =>
                                            void perform(async () => {
                                                await cancelDramaRun(token, projectId, episodeId, clipId, run.id);
                                            })
                                        }
                                    >
                                        取消排队
                                    </Button>
                                )}
                                {["unknown", "save_failed"].includes(run.status) && (
                                    <Button
                                        icon={<RefreshCw size={14} />}
                                        onClick={() =>
                                            void perform(async () => {
                                                await recheckDramaRun(token, projectId, episodeId, clipId, run.id);
                                            })
                                        }
                                    >
                                        核查状态
                                    </Button>
                                )}
                                {run.snapshot.model === "legacy-import" && <Tag>历史导入</Tag>}
                                {run.snapshot.model !== "legacy-import" && ["completed", "failed", "cancelled"].includes(run.status) && (
                                    <Button onClick={() => void previewAgain({ ...run.snapshot, requestId: crypto.randomUUID(), nodeId: node.id, kind: run.kind })}>按原输入重跑</Button>
                                )}
                                {run.snapshot.model !== "legacy-import" && run.status === "completed" && (
                                    <Button
                                        onClick={() =>
                                            void previewAgain({ ...run.snapshot, requestId: crypto.randomUUID(), nodeId: node.id, kind: run.kind, parameters: { ...run.snapshot.parameters, seed: crypto.getRandomValues(new Uint32Array(1))[0] } })
                                        }
                                    >
                                        再抽一次
                                    </Button>
                                )}
                            </div>
                            {run.error && <p className="my-2 whitespace-pre-wrap break-words text-sm">{run.error}</p>}
                            <details className="my-2 text-sm">
                                <summary>提交时提示词</summary>
                                <p className="whitespace-pre-wrap break-words">{run.snapshot.prompt}</p>
                            </details>
                            <div className="flex flex-wrap gap-4">
                                {(run.outputs || []).map((output) => (
                                    <div key={output.storageId} className="w-64 max-w-full">
                                        {output.mimeType.startsWith("video/") ? (
                                            <video controls preload="metadata" src={output.url} className="aspect-video w-full object-contain" />
                                        ) : (
                                            <img src={output.url} alt="生成候选" className="aspect-video w-full object-contain" />
                                        )}
                                        <Button
                                            className="mt-2"
                                            onClick={() => {
                                                canvas?.updateMetadata(node.id, { content: output.url, storageKey: `server:${output.storageId}`, mimeType: output.mimeType, status: "success" });
                                                message.success("已显示到画布节点");
                                            }}
                                        >
                                            显示到画布
                                        </Button>
                                        <Button
                                            className="mt-2 ml-2"
                                            disabled={adoptions.some((item) => item.storageId === output.storageId && !item.needsReview)}
                                            onClick={() =>
                                                void perform(async () => {
                                                    if (canvas) await flushDramaCanvasSave(canvas.canvasId);
                                                    const previous = adoptions.find((item) => item.kind === run.kind);
                                                    const adopted = await adoptDramaOutput(token, projectId, episodeId, clipId, { runId: run.id, storageId: output.storageId, expectedRevision: previous?.revision || 0, clipRevision });
                                                    setAdoptions((items) => [...items.filter((item) => item.kind !== adopted.kind), adopted]);
                                                    canvas?.updateMetadata(node.id, { content: output.url, storageKey: `server:${output.storageId}`, mimeType: output.mimeType, status: "success" });
                                                    message.success("已采用候选");
                                                })
                                            }
                                        >
                                            {adoptions.some((item) => item.storageId === output.storageId) ? "当前使用" : "切换到此版本"}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                {!runs.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无运行记录" />}
            </Spin>
            <Modal
                title="确认生成快照"
                open={!!preview}
                confirmLoading={busy}
                okText="确认入队"
                cancelText="返回编辑"
                onCancel={() => {
                    if (!busy) setPreview(null);
                }}
                onOk={() =>
                    void perform(async () => {
                        if (!preview) return;
                        if (canvas) await flushDramaCanvasSave(canvas.canvasId);
                        const run = await enqueueDramaRun(token, projectId, episodeId, clipId, preview);
                        if (useUserStore.getState().token !== token) return;
                        canvas?.updateMetadata(node.id, { dramaRunId: run.id, status: "loading", errorDetails: undefined });
                        setPreview(null);
                        message.success("已入队");
                    })
                }
            >
                {preview && (
                    <>
                        <p>
                            {preview.model} · {preview.references.length} 个输入 · {previewDetails?.credits ?? 0} 算力点
                        </p>
                        <p className="my-3 max-h-72 overflow-auto whitespace-pre-wrap break-words">{preview.prompt}</p>
                        {!!previewDetails?.snapshot.inputMapping?.length && (
                            <ol className="my-3 space-y-2">
                                {previewDetails.snapshot.inputMapping.map((item) => (
                                    <li key={`${item.presentationOrder}:${item.tag}`}>
                                        <Tag>{item.tag}</Tag>
                                        {{ image: "图片参考", video: "视频画面", embedded_audio: "视频内嵌音轨", audio: "人物声音" }[item.kind]} · 输入 {item.referenceOrder + 1}
                                        {preview.references[item.referenceOrder]?.role === "expression" ? " · 人物表情" : ""}
                                        {item.speaker ? ` · ${item.speaker}` : ""}
                                    </li>
                                ))}
                            </ol>
                        )}
                        <p>入队后按此快照执行，继续修改草稿不影响已提交任务。</p>
                    </>
                )}
            </Modal>
        </section>
    );
}
