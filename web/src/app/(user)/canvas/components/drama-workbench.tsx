"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Drawer, Empty, Form, Input, Modal, Select, Spin, Tabs, Tag, Tooltip } from "antd";
import { ArrowLeft, Clapperboard, ExternalLink, Plus, RefreshCw, Save } from "lucide-react";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { listCanvasProjects } from "@/services/api/canvas-tasks";
import { createDramaEpisode, getDramaProject, updateDramaEpisode, updateDramaProject, type DramaEpisode, type DramaEpisodeDraft, type DramaProject, type DramaProjectDetail, type DramaProjectDraft } from "@/services/api/drama";
import { flushDramaCanvasSave, useCanvasStore } from "../stores/use-canvas-store";
import { DramaClipEditor, type DramaClipEditorHandle } from "./drama-clip-editor";
import { DramaProductionView } from "./drama-production-view";
import { DramaAssetsView } from "./drama-assets-view";
import { downloadDramaEpisode } from "@/services/api/drama-adoption";
import { DramaEpisodeOverview } from "./drama-episode-overview";
import { DramaParameters } from "./drama-parameters";
import { DramaTextArea } from "./drama-text-area";

const emptyProject: DramaProjectDraft = { title: "", sourceType: "novel", sourceText: "", adaptation: "", globalStyle: "" };
const productionSteps = [
    { key: "script", index: "1", title: "剧本与 Clip", subtitle: "拆解剧情与镜头" },
    { key: "assets", index: "2", title: "准备资产", subtitle: "人物、场景、道具与声音" },
    { key: "storyboard", index: "3", title: "导演故事板", subtitle: "画面、机位与连续性" },
    { key: "video", index: "4", title: "完整视频提示词", subtitle: "绑定输入、生成与采用" },
] as const;
const projectDraft = (project: DramaProject): DramaProjectDraft => ({
    title: project.title,
    sourceType: project.sourceType,
    sourceText: project.sourceText,
    adaptation: project.adaptation,
    globalStyle: project.globalStyle,
    generationDefaults: project.generationDefaults || {},
});
const episodeDraft = (episode: DramaEpisode): DramaEpisodeDraft => ({ title: episode.title, script: episode.script });

type DramaWorkbenchProps = { canvasId: string; initialClipId?: string; saveError?: string; canvasSaving?: boolean; onReloadCanvas?: () => void; onClose: () => void };
export function DramaWorkbench(props: DramaWorkbenchProps) {
    const token = useUserStore((state) => state.token);
    return <DramaWorkspace key={`${token}:${props.canvasId}`} {...props} token={token} />;
}

function DramaWorkspace({ canvasId, initialClipId, saveError, canvasSaving, onReloadCanvas, onClose, token }: DramaWorkbenchProps & { token: string }) {
    const { message, modal } = App.useApp();
    const router = useRouter();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const linkedProjectId = useCanvasStore((state) => state.projects.find((item) => item.id === canvasId)?.dramaProjectId);
    const [detail, setDetail] = useState<DramaProjectDetail | null>(null);
    const [draft, setDraft] = useState<DramaProjectDraft>(emptyProject);
    const [selectedEpisode, setSelectedEpisode] = useState<DramaEpisode | null>(null);
    const [scriptDraft, setScriptDraft] = useState<DramaEpisodeDraft>({ title: "", script: "" });
    const [tab, setTab] = useState(initialClipId ? "clips" : "project");
    const [productionStep, setProductionStep] = useState("script");
    const [busy, setBusy] = useState(false);
    const [clipBusy, setClipBusy] = useState(false);
    const [clipDirty, setClipDirty] = useState(false);
    const [bindingDirty, setBindingDirty] = useState(false);
    const [clipEpoch, setClipEpoch] = useState(0);
    const clipEditor = useRef<DramaClipEditorHandle>(null);
    const [error, setError] = useState("");
    const [creating, setCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const mounted = useRef(true);
    const pending = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    useEffect(() => {
        const changed = (event: Event) => {
            if ((event as CustomEvent<string>).detail === canvasId) setError("制作资料已由 Agent 更新。请先保存或保留当前草稿，再刷新读取新版本。");
        };
        window.addEventListener("drama-content-changed", changed);
        return () => window.removeEventListener("drama-content-changed", changed);
    }, [canvasId]);
    const projectDirty = !!detail && JSON.stringify(draft) !== JSON.stringify(projectDraft(detail.project));
    const episodeDirty = !!selectedEpisode && JSON.stringify(scriptDraft) !== JSON.stringify(episodeDraft(selectedEpisode));
    const dirty = projectDirty || episodeDirty || clipDirty || bindingDirty;
    const locked = busy || clipBusy;

    const applyDetail = useCallback(
        (value: DramaProjectDetail) => {
            setClipEpoch((value) => value + 1);
            setClipDirty(false);
            setDetail(value);
            setDraft(projectDraft(value.project));
            const episode = value.episodes.find((item) => item.canvasId === canvasId) || value.episodes[0] || null;
            setSelectedEpisode(episode);
            setScriptDraft(episode ? episodeDraft(episode) : { title: "", script: "" });
        },
        [canvasId],
    );

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        setBusy(true);
        void (async () => {
            try {
                if (!linkedProjectId) throw new Error("当前画布未关联漫剧项目");
                const value = await getDramaProject(token, linkedProjectId);
                if (cancelled) return;
                applyDetail(value);
            } catch (cause) {
                if (!cancelled) setError(cause instanceof Error ? cause.message : "项目加载失败");
            } finally {
                if (!cancelled) setBusy(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [token, linkedProjectId, applyDetail]);

    useEffect(() => {
        if (!dirty) return;
        const beforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", beforeUnload);
        return () => window.removeEventListener("beforeunload", beforeUnload);
    }, [dirty]);

    const guard = (action: () => void) => {
        if (locked) return;
        if (!dirty) return action();
        modal.confirm({
            title: "有尚未保存的内容",
            content: "离开后将放弃本次修改。",
            okText: "放弃修改并继续",
            cancelText: "继续编辑",
            onOk: () => {
                clipEditor.current?.discard();
                action();
            },
        });
    };

    const perform = async (action: () => Promise<void>) => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        setError("");
        try {
            await action();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "操作失败");
        } finally {
            pending.current = false;
            if (mounted.current) setBusy(false);
        }
    };

    const refresh = () =>
        perform(async () => {
            if (!linkedProjectId) throw new Error("当前画布未关联漫剧项目");
            applyDetail(await getDramaProject(token, linkedProjectId));
        });

    const save = () =>
        perform(async () => {
            if (!detail) return;
            if (projectDirty) {
                const saved = await updateDramaProject(token, detail.project.id, draft, detail.project.revision);
                setDetail((current) => current && { ...current, project: saved });
                setDraft(projectDraft(saved));
            }
            if (episodeDirty && selectedEpisode) {
                const saved = await updateDramaEpisode(token, detail.project.id, selectedEpisode.id, scriptDraft, selectedEpisode.revision);
                setSelectedEpisode(saved);
                setScriptDraft(episodeDraft(saved));
                setDetail((current) => current && { ...current, episodes: current.episodes.map((item) => (item.id === saved.id ? saved : item)) });
            }
            await clipEditor.current?.save();
            message.success("已保存");
        });

    const create = () =>
        perform(async () => {
            if (!newTitle.trim()) throw new Error("请填写名称");
            if (detail) {
                await flushDramaCanvasSave(canvasId);
                const saved = await createDramaEpisode(token, detail.project.id, { title: newTitle.trim(), script: "" });
                setDetail((current) => current && { ...current, episodes: [...current.episodes, saved] });
                setSelectedEpisode(saved);
                setScriptDraft(episodeDraft(saved));
                const remote = (await listCanvasProjects(token)).find((item) => item.id === saved.canvasId);
                if (!remote) throw new Error("分集创建成功，但暂时无法读取对应画布");
                useCanvasStore.setState((state) => ({ projects: [remote, ...state.projects.filter((item) => item.id !== remote.id)] }));
                onClose();
                router.push(`/canvas/${encodeURIComponent(saved.canvasId)}`);
            }
            setCreating(false);
            setNewTitle("");
        });

    const openEpisode = (episode: DramaEpisode) =>
        perform(async () => {
            if (episode.canvasId === canvasId) {
                onClose();
                return;
            }
            await flushDramaCanvasSave(canvasId);
            const remote = (await listCanvasProjects(token)).find((item) => item.id === episode.canvasId);
            if (!mounted.current || useUserStore.getState().token !== token) return;
            if (!remote) throw new Error("分集画布不存在，请刷新后重试");
            // Only hydrate this episode; keep other open canvases and their pending edits.
            useCanvasStore.setState((state) => {
                const local = state.projects.find((item) => item.id === remote.id);
                const selected = local && Date.parse(local.updatedAt) > Date.parse(remote.updatedAt) ? local : remote;
                return { projects: [selected, ...state.projects.filter((item) => item.id !== remote.id)] };
            });
            onClose();
            router.push(`/canvas/${encodeURIComponent(episode.canvasId)}`);
        });

    const chooseEpisode = (episode: DramaEpisode) =>
        guard(() => {
            setClipEpoch((value) => value + 1);
            setClipDirty(false);
            if (detail) setDraft(projectDraft(detail.project));
            setSelectedEpisode(episode);
            setScriptDraft(episodeDraft(episode));
        });
    const startCreate = () =>
        guard(() => {
            setClipEpoch((value) => value + 1);
            setClipDirty(false);
            if (detail) setDraft(projectDraft(detail.project));
            if (selectedEpisode) setScriptDraft(episodeDraft(selectedEpisode));
            setNewTitle(`第 ${(detail?.episodes.length || 0) + 1} 集`);
            setCreating(true);
        });

    return (
        <Drawer
            open
            title={
                <span className="inline-flex items-center gap-2">
                    <Clapperboard size={18} />
                    漫剧工作台
                </span>
            }
            placement="right"
            size="100%"
            closable={false}
            keyboard={!locked}
            onClose={() => guard(onClose)}
            focusable={{ trap: true, focusTriggerAfterClose: true }}
            styles={{ body: { padding: 0, background: theme.canvas.background, color: theme.node.text }, header: { background: theme.node.panel, borderColor: theme.node.stroke } }}
            extra={
                <Button type="text" icon={<ArrowLeft size={16} />} disabled={locked} onClick={() => guard(onClose)}>
                    返回画布
                </Button>
            }
        >
            <div data-canvas-no-zoom className="flex min-h-full flex-col">
                {!token ? (
                    <Empty className="m-auto py-16" description="请先登录后管理漫剧项目">
                        <Button href="/login">登录</Button>
                    </Empty>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6" style={{ borderColor: theme.node.stroke }}>
                            <strong className="max-w-64 truncate">{detail?.project.title || "漫剧项目"}</strong>
                            <Select
                                aria-label="分集画布"
                                className="w-56 max-w-full"
                                placeholder="选择分集画布"
                                value={selectedEpisode?.id}
                                disabled={locked}
                                options={(detail?.episodes || []).map((episode) => ({ label: episode.title, value: episode.id }))}
                                onChange={(id) =>
                                    guard(() => {
                                        const episode = detail?.episodes.find((item) => item.id === id);
                                        if (episode) void openEpisode(episode);
                                    })
                                }
                            />
                            <Button icon={<Plus size={16} />} disabled={locked || !detail} onClick={startCreate}>
                                新增分集
                            </Button>
                            <Tooltip title="刷新项目">
                                <Button
                                    aria-label="刷新项目"
                                    icon={<RefreshCw size={16} />}
                                    disabled={locked}
                                    onClick={() =>
                                        guard(() => {
                                            void refresh();
                                        })
                                    }
                                />
                            </Tooltip>
                            <span className="ml-auto text-sm" style={{ color: theme.node.muted }}>
                                {saveError ? "画布未保存" : canvasSaving ? "画布保存中" : dirty ? "未保存" : detail ? "已保存" : ""}
                            </span>
                            <Button type="primary" icon={<Save size={16} />} loading={busy} disabled={bindingDirty || clipBusy || !dirty || !draft.title.trim() || (!!selectedEpisode && !scriptDraft.title.trim())} onClick={() => void save()}>
                                保存
                            </Button>
                        </div>
                        {error && <Alert className="mx-4 mt-4 sm:mx-6" type="error" showIcon title={error} />}
                        {saveError && <Alert className="mx-4 mt-4 sm:mx-6" type="error" showIcon title={saveError} action={<Button onClick={onReloadCanvas}>加载服务器版本</Button>} />}
                        <Spin spinning={busy}>
                            {!detail ? (
                                <Empty className="py-24" description="暂无漫剧项目" />
                            ) : (
                                <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
                                    <Tabs
                                        activeKey={tab}
                                        onChange={setTab}
                                        items={[
                                            {
                                                key: "project",
                                                label: "项目资料",
                                                children: (
                                                    <Form layout="vertical" disabled={busy}>
                                                        <div className="grid gap-x-6 sm:grid-cols-2">
                                                            <Form.Item label="剧名" required>
                                                                <Input aria-label="剧名" value={draft.title} maxLength={200} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                                                            </Form.Item>
                                                            <Form.Item label="内容来源">
                                                                <Select
                                                                    aria-label="内容来源"
                                                                    value={draft.sourceType}
                                                                    options={[
                                                                        { label: "小说原文", value: "novel" },
                                                                        { label: "已有剧本", value: "script" },
                                                                    ]}
                                                                    onChange={(sourceType) => setDraft({ ...draft, sourceType })}
                                                                />
                                                            </Form.Item>
                                                        </div>
                                                        <Form.Item label={draft.sourceType === "novel" ? "小说原文" : "来源剧本"}>
                                                            <DramaTextArea aria-label="来源正文" value={draft.sourceText} rows={10} className="max-h-[34rem] resize-y" onChange={(event) => setDraft({ ...draft, sourceText: event.target.value })} />
                                                        </Form.Item>
                                                        <Form.Item label="改编蓝图与系列设定">
                                                            <DramaTextArea aria-label="改编蓝图与系列设定" value={draft.adaptation} rows={5} className="max-h-96 resize-y" onChange={(event) => setDraft({ ...draft, adaptation: event.target.value })} />
                                                        </Form.Item>
                                                        <Form.Item label="全局风格">
                                                            <DramaTextArea aria-label="全局风格" value={draft.globalStyle} rows={3} className="max-h-64 resize-y" onChange={(event) => setDraft({ ...draft, globalStyle: event.target.value })} />
                                                        </Form.Item>
                                                        <details>
                                                            <summary className="mb-4">项目生成默认值</summary>
                                                            {(["image", "video"] as const).map((kind) => (
                                                                <section key={kind}>
                                                                    <h3 className="mb-3">{kind === "image" ? "图片" : "视频"}</h3>
                                                                    <DramaParameters
                                                                        label={`项目${kind === "image" ? "图片" : "视频"}`}
                                                                        value={draft.generationDefaults?.[kind]}
                                                                        onChange={(parameters) => setDraft({ ...draft, generationDefaults: { ...draft.generationDefaults, [kind]: parameters } })}
                                                                    />
                                                                </section>
                                                            ))}
                                                        </details>
                                                    </Form>
                                                ),
                                            },
                                            {
                                                key: "episodes",
                                                label: `分集 (${detail.episodes.length})`,
                                                children: (
                                                    <>
                                                        <div className="mb-4 flex justify-end">
                                                            <Button icon={<Plus size={16} />} disabled={busy} onClick={startCreate}>
                                                                新增分集
                                                            </Button>
                                                        </div>
                                                        {!detail.episodes.length ? (
                                                            <Empty className="py-16" description="暂无分集" />
                                                        ) : (
                                                            <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
                                                                <nav aria-label="分集列表" className="flex flex-col gap-1">
                                                                    {detail.episodes.map((episode) => (
                                                                        <button
                                                                            key={episode.id}
                                                                            type="button"
                                                                            disabled={busy}
                                                                            onClick={() => chooseEpisode(episode)}
                                                                            aria-current={selectedEpisode?.id === episode.id ? "page" : undefined}
                                                                            className="flex min-w-0 items-start gap-2 rounded px-3 py-3 text-left text-sm"
                                                                            style={{ background: selectedEpisode?.id === episode.id ? theme.toolbar.activeBg : undefined }}
                                                                        >
                                                                            <span className="shrink-0" style={{ color: theme.node.muted }}>
                                                                                {episode.position}.
                                                                            </span>
                                                                            <span className="min-w-0 break-words">{episode.title}</span>
                                                                        </button>
                                                                    ))}
                                                                </nav>
                                                                {selectedEpisode && (
                                                                    <Form layout="vertical" disabled={busy}>
                                                                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                                                                            <Tag>{selectedEpisode.canvasId === canvasId ? "当前分集画布" : "其他分集"}</Tag>
                                                                            <Button
                                                                                icon={<ExternalLink size={16} />}
                                                                                disabled={busy}
                                                                                onClick={() =>
                                                                                    guard(() => {
                                                                                        void openEpisode(selectedEpisode);
                                                                                    })
                                                                                }
                                                                            >
                                                                                打开本集画布
                                                                            </Button>
                                                                        </div>
                                                                        <Form.Item label="分集名称" required>
                                                                            <Input aria-label="分集名称" maxLength={200} value={scriptDraft.title} onChange={(event) => setScriptDraft({ ...scriptDraft, title: event.target.value })} />
                                                                        </Form.Item>
                                                                        <Form.Item label="本集制作剧本">
                                                                            <DramaTextArea
                                                                                aria-label="本集制作剧本"
                                                                                value={scriptDraft.script}
                                                                                rows={18}
                                                                                className="max-h-[48rem] resize-y"
                                                                                onChange={(event) => setScriptDraft({ ...scriptDraft, script: event.target.value })}
                                                                            />
                                                                        </Form.Item>
                                                                    </Form>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                ),
                                            },
                                            {
                                                key: "history",
                                                label: "运行历史",
                                                children: selectedEpisode ? <DramaEpisodeOverview key={selectedEpisode.id} token={token} projectId={detail.project.id} episodeId={selectedEpisode.id} history /> : <Empty description="请先选择分集" />,
                                            },
                                            {
                                                key: "clips",
                                                label: "剧本与 Clip",
                                                children: (
                                                    <>
                                                        {selectedEpisode ? (
                                                            <>
                                                                <nav aria-label="制作阶段" role="tablist" className="mb-4 grid grid-cols-2 border-b lg:grid-cols-4" style={{ borderColor: theme.node.stroke }}>
                                                                    {productionSteps.map((step) => {
                                                                        const active = productionStep === step.key;
                                                                        return (
                                                                            <button
                                                                                key={step.key}
                                                                                type="button"
                                                                                role="tab"
                                                                                aria-selected={active}
                                                                                disabled={locked}
                                                                                className="min-w-0 border-b-2 px-2 py-3 transition-colors sm:px-3"
                                                                                style={{
                                                                                    borderColor: active ? theme.toolbar.activeText : "transparent",
                                                                                    background: active ? theme.toolbar.activeBg : "transparent",
                                                                                    color: active ? theme.toolbar.activeText : theme.node.muted,
                                                                                }}
                                                                                onClick={() => (bindingDirty ? guard(() => setProductionStep(step.key)) : setProductionStep(step.key))}
                                                                            >
                                                                                <ProductionStepLabel index={step.index} title={step.title} subtitle={step.subtitle} />
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </nav>
                                                                <div hidden={productionStep !== "script"}>
                                                                    <details className="mb-5 rounded border border-current/15 px-4 py-3">
                                                                        <summary className="cursor-pointer font-medium">制作剧本</summary>
                                                                        <Form layout="vertical" disabled={locked} className="mt-4">
                                                                            <Form.Item label="制作剧本">
                                                                                <DramaTextArea
                                                                                    aria-label="制作剧本"
                                                                                    value={scriptDraft.script}
                                                                                    rows={5}
                                                                                    className="max-h-96 resize-y"
                                                                                    onChange={(event) => setScriptDraft({ ...scriptDraft, script: event.target.value })}
                                                                                />
                                                                            </Form.Item>
                                                                        </Form>
                                                                        <Button
                                                                            icon={<ExternalLink size={16} />}
                                                                            disabled={locked}
                                                                            onClick={() =>
                                                                                guard(() => {
                                                                                    void openEpisode(selectedEpisode);
                                                                                })
                                                                            }
                                                                        >
                                                                            打开本集画布
                                                                        </Button>
                                                                    </details>
                                                                    <DramaClipEditor
                                                                        key={`${selectedEpisode.id}:${clipEpoch}`}
                                                                        ref={clipEditor}
                                                                        token={token}
                                                                        projectId={detail.project.id}
                                                                        episodeId={selectedEpisode.id}
                                                                        canvasId={selectedEpisode.canvasId}
                                                                        initialClipId={initialClipId}
                                                                        disabled={busy}
                                                                        onDirtyChange={setClipDirty}
                                                                        onBusyChange={setClipBusy}
                                                                    />
                                                                </div>
                                                                {productionStep === "assets" && <DramaAssetsView key={detail.project.id} token={token} projectId={detail.project.id} />}
                                                                {(productionStep === "storyboard" || productionStep === "video") && (
                                                                    <DramaProductionView
                                                                        key={`${selectedEpisode.id}:${productionStep}`}
                                                                        token={token}
                                                                        projectId={detail.project.id}
                                                                        episodeId={selectedEpisode.id}
                                                                        canvasId={selectedEpisode.canvasId}
                                                                        stage={productionStep}
                                                                        onBindingDirtyChange={setBindingDirty}
                                                                    />
                                                                )}
                                                            </>
                                                        ) : (
                                                            <Empty className="py-16" description="请先新增分集" />
                                                        )}
                                                    </>
                                                ),
                                            },
                                            { key: "assets", label: "素材库", children: <DramaAssetsView key={detail.project.id} token={token} projectId={detail.project.id} /> },
                                            {
                                                key: "delivery",
                                                label: "制作台与导出",
                                                children: (
                                                    <>
                                                        {selectedEpisode && (
                                                            <div className="flex flex-wrap gap-3">
                                                                <Button disabled={locked || dirty} onClick={() => void perform(async () => downloadDramaEpisode(token, detail.project.id, selectedEpisode.id, false))}>
                                                                    导出采用素材包
                                                                </Button>
                                                                <Button
                                                                    disabled={locked || dirty}
                                                                    onClick={() =>
                                                                        modal.confirm({
                                                                            title: "仅导出已完成部分？",
                                                                            content: "缺失或待复核的 Clip 将列入清单，但不会包含视频。",
                                                                            okText: "导出部分",
                                                                            cancelText: "取消",
                                                                            onOk: () => perform(async () => downloadDramaEpisode(token, detail.project.id, selectedEpisode.id, true)),
                                                                        })
                                                                    }
                                                                >
                                                                    部分导出
                                                                </Button>
                                                            </div>
                                                        )}
                                                        {selectedEpisode && <DramaEpisodeOverview key={selectedEpisode.id} token={token} projectId={detail.project.id} episodeId={selectedEpisode.id} />}
                                                    </>
                                                ),
                                            },
                                        ]}
                                    />
                                </div>
                            )}
                        </Spin>
                        <Modal
                            title="新增分集"
                            open={creating}
                            onCancel={() => {
                                if (!busy) setCreating(false);
                            }}
                            onOk={() => void create()}
                            confirmLoading={busy}
                            okText="创建"
                            cancelText="取消"
                            okButtonProps={{ disabled: !newTitle.trim() }}
                        >
                            {error && <Alert className="mb-4" type="error" showIcon title={error} />}
                            <Form layout="vertical">
                                <Form.Item label="名称" required>
                                    <Input
                                        autoFocus
                                        aria-label="新建名称"
                                        value={newTitle}
                                        maxLength={200}
                                        disabled={busy}
                                        onChange={(event) => setNewTitle(event.target.value)}
                                        onPressEnter={() => {
                                            if (!busy && newTitle.trim()) void create();
                                        }}
                                    />
                                </Form.Item>
                            </Form>
                        </Modal>
                    </>
                )}
            </div>
        </Drawer>
    );
}

function ProductionStepLabel({ index, title, subtitle }: { index: string; title: string; subtitle: string }) {
    return (
        <span className="flex min-w-0 items-center justify-center gap-3 text-left">
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-current text-xs font-semibold">{index}</span>
            <span className="min-w-0">
                <span className="block truncate font-medium">{title}</span>
                <span aria-hidden className="mt-0.5 hidden truncate text-xs font-normal opacity-55 sm:block">
                    {subtitle}
                </span>
            </span>
        </span>
    );
}
