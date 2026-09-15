"use client";

import { Fragment, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Alert, App, Button, Empty, Form, Input, InputNumber, Modal, Segmented, Spin, Tooltip } from "antd";
import { Archive, ArrowDown, ArrowUp, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { createDramaClip, listDramaClips, reorderDramaClips, updateDramaClip, type DramaClip, type DramaClipDraft, type DramaShot } from "@/services/api/drama";
import { keepClipEdit, useDramaDraftStore } from "../stores/use-drama-draft-store";
import { DramaCanvasContext } from "./drama-canvas-context";
import { DramaPromptEditor, DramaTextArea } from "./drama-text-area";

export type DramaClipEditorHandle = { save: () => Promise<void>; discard: () => void };
const toDraft = (clip: DramaClip): DramaClipDraft => ({ title: clip.title, scene: clip.scene, summary: clip.summary, entryState: clip.entryState, exitState: clip.exitState, shots: clip.shots, archived: clip.archived });
const blankClip = (title: string): DramaClipDraft => ({ title, scene: "", summary: "", entryState: "", exitState: "", shots: [], archived: false });
const seconds = (shots: DramaShot[]) => Number(shots.reduce((total, shot) => total + shot.duration, 0).toFixed(3));

export const DramaClipEditor = forwardRef<
    DramaClipEditorHandle,
    {
        token: string;
        projectId: string;
        episodeId: string;
        canvasId: string;
        initialClipId?: string;
        disabled: boolean;
        onDirtyChange: (dirty: boolean) => void;
        onBusyChange: (busy: boolean) => void;
    }
>(function DramaClipEditor({ token, projectId, episodeId, canvasId, initialClipId, disabled, onDirtyChange, onBusyChange }, ref) {
    const canvas = useContext(DramaCanvasContext);
    const { modal } = App.useApp();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [clips, setClips] = useState<DramaClip[]>([]);
    const [selected, setSelected] = useState<DramaClip | null>(null);
    const [draft, setDraft] = useState<DramaClipDraft>(blankClip(""));
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState("");
    const [recovered, setRecovered] = useState(false);
    const [archive, setArchive] = useState(false);
    const [creating, setCreating] = useState(false);
    const [preview, setPreview] = useState<DramaClip[] | null>(null);
    const [title, setTitle] = useState("");
    const [expanded, setExpanded] = useState<string[]>([]);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const pending = useRef(false);
    const scope = `${token}:${projectId}:${episodeId}:${canvasId}`;
    const currentScope = useRef(scope);
    currentScope.current = scope;
    const dirty = !!selected && JSON.stringify(draft) !== JSON.stringify(toDraft(selected));
    const locked = disabled || busy;
    const activeClips = clips.filter((item) => !item.archived);
    const canvasNodes = canvas?.canvasId === canvasId && selected ? canvas.nodes.filter((node) => node.metadata?.dramaClipId === selected.id) : [];
    useEffect(() => {
        onDirtyChange(dirty);
    }, [dirty, onDirtyChange]);
    useEffect(() => {
        if (selected) keepClipEdit(episodeId, dirty ? { base: selected, draft } : null);
    }, [selected, draft, dirty, episodeId]);
    useEffect(() => {
        onBusyChange(busy);
    }, [busy, onBusyChange]);
    useEffect(
        () => () => {
            onDirtyChange(false);
            onBusyChange(false);
        },
        [onDirtyChange, onBusyChange],
    );
    const select = (clip: DramaClip | null) => {
        setSelected(clip);
        setDraft(clip ? toDraft(clip) : blankClip(""));
        setExpanded([]);
        setDetailsOpen(Boolean(clip && !clip.shots.length));
        setError("");
    };
    useEffect(() => {
        let cancelled = false;
        setPreview(null);
        void listDramaClips(token, projectId, episodeId)
            .then((items) => {
                if (!cancelled) {
                    setClips(items);
                    const cached = useDramaDraftStore.getState().clips[episodeId];
                    if (cached && items.some((item) => item.id === cached.base.id)) {
                        setSelected(cached.base);
                        setDraft(cached.draft);
                        setDetailsOpen(Boolean(initialClipId) || !cached.base.shots.length);
                        setArchive(cached.base.archived);
                        setRecovered(true);
                    } else {
                        const first = items.find((item) => item.id === initialClipId) || items.find((item) => !item.archived) || null;
                        setSelected(first);
                        setArchive(first?.archived || false);
                        setDraft(first ? toDraft(first) : blankClip(""));
                        setDetailsOpen(Boolean(first && (first.id === initialClipId || !first.shots.length)));
                    }
                }
            })
            .catch((cause) => {
                if (!cancelled) setError(cause instanceof Error ? cause.message : "Clip 加载失败");
            })
            .finally(() => {
                if (!cancelled) setBusy(false);
            });
        return () => {
            cancelled = true;
        };
    }, [token, projectId, episodeId, initialClipId]);
    const guard = (action: () => void) => {
        if (locked) return;
        if (!dirty) return action();
        modal.confirm({ title: "有尚未保存的 Clip", content: "继续将放弃当前 Clip 的修改。", okText: "放弃修改并继续", cancelText: "继续编辑", onOk: action });
    };
    useImperativeHandle(ref, () => ({
        discard: () => keepClipEdit(episodeId, null),
        save: async () => {
            if (!dirty || !selected) return;
            if (pending.current) throw new Error("Clip 正在保存");
            pending.current = true;
            setBusy(true);
            setError("");
            try {
                const saved = await updateDramaClip(token, projectId, episodeId, selected.id, draft, selected.revision);
                setClips((items) => items.map((item) => (item.id === saved.id ? saved : item)));
                const keepDetailsOpen = detailsOpen;
                select(saved);
                setDetailsOpen(keepDetailsOpen);
                setArchive(saved.archived);
                setRecovered(false);
            } finally {
                pending.current = false;
                setBusy(false);
            }
        },
    }));
    const create = async () => {
        if (pending.current || locked || !title.trim()) return;
        pending.current = true;
        setBusy(true);
        setError("");
        try {
            const saved = await createDramaClip(token, projectId, episodeId, blankClip(title.trim()));
            setClips((items) => [...items, saved]);
            select(saved);
            setArchive(false);
            setCreating(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Clip 创建失败");
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };
    const patchShot = (id: string, patch: Partial<DramaShot>) => setDraft((current) => ({ ...current, shots: current.shots.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)) }));
    const moveClip = async (id: string, offset: number) => {
        if (locked || pending.current || dirty || archive) return;
        const ordered = [...activeClips];
        const index = ordered.findIndex((clip) => clip.id === id);
        if (index < 0 || !ordered[index + offset]) return;
        [ordered[index], ordered[index + offset]] = [ordered[index + offset], ordered[index]];
        pending.current = true;
        setBusy(true);
        setError("");
        try {
            const saved = await reorderDramaClips(token, projectId, episodeId, ordered);
            if (currentScope.current !== scope) return;
            setClips(saved);
            select(saved.find((clip) => clip.id === selected?.id) || null);
        } catch (cause) {
            if (currentScope.current === scope) setError(cause instanceof Error ? cause.message : "Clip 排序失败，请刷新后重试");
        } finally {
            pending.current = false;
            if (currentScope.current === scope) setBusy(false);
        }
    };
    const moveShot = (index: number, offset: number) =>
        setDraft((current) => {
            const shots = [...current.shots];
            [shots[index], shots[index + offset]] = [shots[index + offset], shots[index]];
            return { ...current, shots };
        });
    const shotFields = { action: "画面与动作", dialogue: "精确对白", speaker: "说话者", camera: "摄影与运镜", sound: "声音", entryState: "进入状态", exitState: "退出状态" } as const;
    return (
        <section aria-label="Clip 与镜头" className="min-w-0">
            {recovered && <Alert type="info" title="已恢复尚未保存的 Clip 草稿" showIcon className="mb-4" />}
            {error && <Alert type="error" title={error} showIcon className="mb-4" />}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Segmented
                    value={archive ? "archive" : "active"}
                    disabled={locked}
                    options={[
                        { label: `制作中 (${clips.filter((item) => !item.archived).length})`, value: "active" },
                        { label: `回收站 (${clips.filter((item) => item.archived).length})`, value: "archive" },
                    ]}
                    onChange={(value) =>
                        guard(() => {
                            setArchive(value === "archive");
                            select(clips.find((item) => item.archived === (value === "archive")) || null);
                        })
                    }
                />
                <Button
                    icon={<Plus size={16} />}
                    disabled={locked}
                    onClick={() =>
                        guard(() => {
                            if (selected) setDraft(toDraft(selected));
                            setTitle("");
                            setCreating(true);
                        })
                    }
                >
                    新增 Clip
                </Button>
                {canvas?.canvasId === canvasId && !archive && (
                    <Button disabled={locked || dirty || !activeClips.length} onClick={() => setPreview(activeClips)}>
                        确认整集拆解
                    </Button>
                )}
            </div>
            <Spin spinning={busy}>
                <div className="grid min-w-0 gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
                    <nav aria-label="Clip 列表" className="flex min-w-0 flex-col gap-1">
                        {clips
                            .filter((item) => item.archived === archive)
                            .map((clip, index, visible) => (
                                <div key={clip.id} className="flex min-w-0 items-center">
                                    <button
                                        type="button"
                                        disabled={locked}
                                        aria-current={selected?.id === clip.id ? "page" : undefined}
                                        onClick={() => guard(() => select(clip))}
                                        className="min-w-0 flex-1 rounded px-3 py-3 text-left text-sm"
                                        style={{ background: selected?.id === clip.id ? theme.toolbar.activeBg : undefined }}
                                    >
                                        <div className="break-words">
                                            {clip.position}. {clip.title}
                                        </div>
                                        <div className="mt-1" style={{ color: theme.node.muted }}>
                                            {seconds(clip.shots)}s · {clip.shots.length} 镜头
                                        </div>
                                    </button>
                                    {!archive && (
                                        <div className="flex flex-col">
                                            <Tooltip title="Clip 上移">
                                                <Button aria-label={`${clip.title} 上移`} type="text" size="small" icon={<ArrowUp size={14} />} disabled={locked || dirty || index === 0} onClick={() => void moveClip(clip.id, -1)} />
                                            </Tooltip>
                                            <Tooltip title="Clip 下移">
                                                <Button aria-label={`${clip.title} 下移`} type="text" size="small" icon={<ArrowDown size={14} />} disabled={locked || dirty || index === visible.length - 1} onClick={() => void moveClip(clip.id, 1)} />
                                            </Tooltip>
                                        </div>
                                    )}
                                </div>
                            ))}
                    </nav>
                    {!selected ? (
                        <Empty className="py-12" description={archive ? "回收站为空" : "暂无 Clip"} />
                    ) : (
                        <Form layout="vertical" disabled={locked} className="min-w-0">
                            {canvas?.canvasId === canvasId && !selected.archived && (
                                <div className="mb-5 flex flex-wrap gap-2">
                                    <Button disabled={locked || dirty} onClick={() => canvas.prepare(selected)}>
                                        准备画布节点
                                    </Button>
                                    {canvasNodes.find((node) => node.metadata?.dramaRole === "group") && <Button onClick={() => guard(() => canvas.focus(canvasNodes.find((node) => node.metadata?.dramaRole === "group")!.id))}>定位 Clip</Button>}
                                </div>
                            )}
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <span>
                                    {seconds(draft.shots)}s · {draft.shots.length} 镜头
                                </span>
                                <Button icon={draft.archived ? <RotateCcw size={16} /> : <Archive size={16} />} onClick={() => setDraft({ ...draft, archived: !draft.archived })}>
                                    {draft.archived ? "恢复 Clip" : "移入回收站"}
                                </Button>
                            </div>
                            <details key={selected.id} open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)} className="mb-5 rounded border border-current/15 px-4 py-3">
                                <summary className="cursor-pointer font-medium">Clip 基础资料</summary>
                                <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
                                    <Form.Item label="Clip 名称" required>
                                        <Input aria-label="Clip 名称" value={draft.title} maxLength={200} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                                    </Form.Item>
                                    <Form.Item label="场次">
                                        <Input aria-label="场次" value={draft.scene} maxLength={200} onChange={(event) => setDraft({ ...draft, scene: event.target.value })} />
                                    </Form.Item>
                                </div>
                                <Form.Item label="剧情摘要">
                                    <DramaTextArea aria-label="剧情摘要" value={draft.summary} rows={2} className="max-h-48 resize-y" onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />
                                </Form.Item>
                                <div className="grid gap-x-4 sm:grid-cols-2">
                                    {(["entryState", "exitState"] as const).map((field) => (
                                        <Form.Item key={field} label={field === "entryState" ? "Clip 进入状态" : "Clip 退出状态"}>
                                            <DramaTextArea
                                                aria-label={field === "entryState" ? "Clip 进入状态" : "Clip 退出状态"}
                                                value={draft[field]}
                                                rows={2}
                                                className="max-h-40 resize-y"
                                                onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                                            />
                                        </Form.Item>
                                    ))}
                                </div>
                            </details>
                            <div className="mb-3 flex items-center justify-between">
                                <span>镜头</span>
                                <Button
                                    icon={<Plus size={16} />}
                                    onClick={() => {
                                        const shot: DramaShot = { id: crypto.randomUUID(), title: "", duration: 1, action: "", dialogue: "", speaker: "", camera: "", sound: "", entryState: "", exitState: "" };
                                        setDraft({ ...draft, shots: [...draft.shots, shot] });
                                        setExpanded((items) => [...items, shot.id]);
                                    }}
                                >
                                    新增镜头
                                </Button>
                            </div>
                            <div className="overflow-x-auto rounded border border-current/15">
                                <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
                                    <thead className="bg-black/[0.03] text-xs dark:bg-white/[0.04]">
                                        <tr>
                                            <th className="w-14 px-3 py-3 text-center font-medium">镜号</th>
                                            <th className="w-20 px-3 py-3 font-medium">时长</th>
                                            <th className="w-[28%] px-3 py-3 font-medium">画面与动作</th>
                                            <th className="w-[19%] px-3 py-3 font-medium">对白与说话者</th>
                                            <th className="w-[18%] px-3 py-3 font-medium">摄影与运镜</th>
                                            <th className="w-[15%] px-3 py-3 font-medium">声音</th>
                                            <th className="w-32 px-3 py-3 text-right font-medium">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {draft.shots.map((shot, index) => {
                                            const open = expanded.includes(shot.id);
                                            return (
                                                <Fragment key={shot.id}>
                                                    <tr className="border-t border-current/10 align-top transition hover:bg-black/[0.025] dark:hover:bg-white/[0.025]">
                                                        <td className="px-3 py-3 text-center opacity-60">{index + 1}</td>
                                                        <td className="px-3 py-3 font-medium">{shot.duration}s</td>
                                                        <td className="px-3 py-3">
                                                            <button
                                                                type="button"
                                                                className="mb-1 block max-w-full truncate text-left font-medium hover:underline"
                                                                onClick={() => setExpanded((items) => (items.includes(shot.id) ? items.filter((id) => id !== shot.id) : [...items, shot.id]))}
                                                            >
                                                                {index + 1}. {shot.title || "未命名镜头"} · {shot.duration}s
                                                            </button>
                                                            <div className="line-clamp-3 whitespace-pre-wrap break-words opacity-75">{shot.action || "未填写画面与动作"}</div>
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            {shot.speaker && <div className="mb-1 font-medium">{shot.speaker}</div>}
                                                            <div className="line-clamp-3 whitespace-pre-wrap break-words opacity-75">{shot.dialogue || "无对白"}</div>
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <div className="line-clamp-3 whitespace-pre-wrap break-words opacity-75">{shot.camera || "未填写"}</div>
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <div className="line-clamp-3 whitespace-pre-wrap break-words opacity-75">{shot.sound || "未填写"}</div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex justify-end gap-1">
                                                                <Tooltip title={open ? "收起编辑" : "编辑镜头"}>
                                                                    <Button
                                                                        aria-label={open ? "收起镜头编辑" : "编辑镜头"}
                                                                        type="text"
                                                                        size="small"
                                                                        icon={<Pencil size={14} />}
                                                                        onClick={() => setExpanded((items) => (items.includes(shot.id) ? items.filter((id) => id !== shot.id) : [...items, shot.id]))}
                                                                    />
                                                                </Tooltip>
                                                                <Tooltip title="镜头上移">
                                                                    <Button aria-label="镜头上移" type="text" size="small" icon={<ArrowUp size={14} />} disabled={locked || index === 0} onClick={() => moveShot(index, -1)} />
                                                                </Tooltip>
                                                                <Tooltip title="镜头下移">
                                                                    <Button aria-label="镜头下移" type="text" size="small" icon={<ArrowDown size={14} />} disabled={locked || index === draft.shots.length - 1} onClick={() => moveShot(index, 1)} />
                                                                </Tooltip>
                                                                <Tooltip title="移除镜头">
                                                                    <Button
                                                                        aria-label="移除镜头"
                                                                        type="text"
                                                                        size="small"
                                                                        danger
                                                                        icon={<Trash2 size={14} />}
                                                                        onClick={() =>
                                                                            modal.confirm({
                                                                                title: "移除这个镜头？",
                                                                                content: "保存 Clip 后生效。",
                                                                                okText: "移除",
                                                                                cancelText: "取消",
                                                                                onOk: () => setDraft((current) => ({ ...current, shots: current.shots.filter((item) => item.id !== shot.id) })),
                                                                            })
                                                                        }
                                                                    />
                                                                </Tooltip>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {open && (
                                                        <tr className="border-t border-current/10 bg-black/[0.018] dark:bg-white/[0.018]">
                                                            <td colSpan={7} className="px-5 py-5">
                                                                <div className="grid gap-x-4 sm:grid-cols-2">
                                                                    <Form.Item label="镜头名称">
                                                                        <Input aria-label="镜头名称" value={shot.title} maxLength={200} onChange={(event) => patchShot(shot.id, { title: event.target.value })} />
                                                                    </Form.Item>
                                                                    <Form.Item label="时长（秒）" required>
                                                                        <InputNumber
                                                                            aria-label="镜头时长"
                                                                            className="w-full"
                                                                            value={shot.duration}
                                                                            min={0.001}
                                                                            step={0.1}
                                                                            onChange={(duration) => {
                                                                                if (duration !== null) patchShot(shot.id, { duration });
                                                                            }}
                                                                        />
                                                                    </Form.Item>
                                                                </div>
                                                                <div className="grid gap-x-4 xl:grid-cols-2">
                                                                    {Object.entries(shotFields).map(([field, label]) => (
                                                                        <Form.Item key={field} label={label} className={field === "action" ? "xl:col-span-2" : undefined}>
                                                                            <DramaTextArea
                                                                                aria-label={label}
                                                                                value={shot[field as keyof typeof shotFields]}
                                                                                rows={2}
                                                                                className="max-h-48 resize-y"
                                                                                onChange={(event) => patchShot(shot.id, { [field]: event.target.value })}
                                                                            />
                                                                        </Form.Item>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-6">
                                {canvasNodes
                                    .filter((node) => node.metadata?.dramaRole === "storyboard" || node.metadata?.dramaRole === "video")
                                    .map((node) => (
                                        <Form.Item key={node.id} label={node.metadata?.dramaRole === "storyboard" ? "故事板生成提示词" : "完整视频提示词"}>
                                            <DramaPromptEditor
                                                node={node}
                                                nodes={canvas?.nodes || []}
                                                connections={canvas?.connections || []}
                                                className="h-40 max-h-[28rem] resize-y overflow-y-auto"
                                                onChange={(value) => canvas?.updatePrompt(node.id, value)}
                                            />
                                            <Button type="link" onClick={() => guard(() => canvas?.focus(node.id))}>
                                                在画布中打开
                                            </Button>
                                        </Form.Item>
                                    ))}
                            </div>
                        </Form>
                    )}
                </div>
            </Spin>
            <Modal
                title="整集拆解预览"
                open={preview !== null}
                okText="确认并准备画布"
                cancelText="返回修改"
                okButtonProps={{ disabled: locked || dirty || !preview?.length || preview.some((clip) => !clip.shots.length) }}
                onCancel={() => setPreview(null)}
                onOk={() => {
                    if (locked || dirty || !preview?.length || canvas?.canvasId !== canvasId || preview.some((clip) => clip.archived || !clip.shots.length || !clips.some((item) => item.id === clip.id && item.revision === clip.revision && !item.archived)))
                        return;
                    canvas.prepareMany(preview);
                    setPreview(null);
                }}
            >
                <div className="mb-4">
                    {preview?.length || 0} 个 Clip · {preview?.reduce((count, clip) => count + clip.shots.length, 0) || 0} 镜头 · {seconds(preview?.flatMap((clip) => clip.shots) || [])}s
                </div>
                <div className="max-h-[55vh] overflow-y-auto">
                    {preview?.map((clip) => (
                        <div key={clip.id} className="mb-4">
                            <div>
                                {clip.position}. {clip.title} · {seconds(clip.shots)}s
                            </div>
                            <div style={{ color: theme.node.muted }}>{clip.scene}</div>
                            <div className="whitespace-pre-wrap break-words">{clip.summary}</div>
                            {!clip.shots.length && <Alert type="warning" title="尚无镜头，请先补齐拆解" />}
                            {clip.shots.map((shot, index) => (
                                <div key={shot.id} className="mt-2 break-words text-sm">
                                    {index + 1}. {shot.title || shot.action || "未命名镜头"} · {shot.duration}s
                                    {shot.dialogue && (
                                        <div>
                                            {shot.speaker}：{shot.dialogue}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </Modal>
            <Modal
                title="新增 Clip"
                open={creating}
                okText="创建"
                cancelText="取消"
                confirmLoading={busy}
                okButtonProps={{ disabled: !title.trim() }}
                onOk={() => void create()}
                onCancel={() => {
                    if (!busy) setCreating(false);
                }}
            >
                {error && <Alert type="error" title={error} showIcon className="mb-3" />}
                <Input aria-label="新 Clip 名称" autoFocus maxLength={200} disabled={busy} value={title} onChange={(event) => setTitle(event.target.value)} onPressEnter={() => void create()} />
            </Modal>
        </section>
    );
});
