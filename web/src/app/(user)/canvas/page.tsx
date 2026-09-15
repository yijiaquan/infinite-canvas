"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Input, Modal, Spin } from "antd";
import { Clapperboard, Download, FileUp, Plus } from "lucide-react";

import { readZip } from "@/lib/zip";
import { setMediaBlob } from "@/services/file-storage";
import { setImageBlob } from "@/services/image-storage";
import { listCanvasProjects } from "@/services/api/canvas-tasks";
import { createDramaEpisode, createDramaProject, getDramaProject, listDramaProjects, type DramaProjectDetail } from "@/services/api/drama";
import { useUserStore } from "@/stores/use-user-store";
import { CanvasDeleteProjectsDialog } from "./components/canvas-delete-projects-dialog";
import { CanvasProjectCard } from "./components/canvas-project-card";
import { DramaProjectCard } from "./components/drama-project-card";
import type { CanvasExportFile } from "./export-types";
import { useCanvasStore } from "./stores/use-canvas-store";
import { useCanvasUiStore } from "./stores/use-canvas-ui-store";
import { exportCanvasProjects } from "./utils/canvas-export";
import { buildDramaProjectLibrary } from "./utils/drama-project-library";

export default function CanvasPage() {
    const { message } = App.useApp();
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const hydrated = useCanvasStore((state) => state.hydrated);
    const projects = useCanvasStore((state) => state.projects);
    const token = useUserStore((state) => state.token);
    const createProject = useCanvasStore((state) => state.createProject);
    const importProject = useCanvasStore((state) => state.importProject);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const setDeleteIds = useCanvasUiStore((state) => state.setDeleteProjectIds);
    const [dramaDetails, setDramaDetails] = useState<DramaProjectDetail[]>([]);
    const [dramaLoading, setDramaLoading] = useState(false);
    const [dramaError, setDramaError] = useState("");
    const [creatingDrama, setCreatingDrama] = useState(false);
    const [creatingEpisodeFor, setCreatingEpisodeFor] = useState("");
    const [dramaCreateOpen, setDramaCreateOpen] = useState(false);
    const [dramaTitle, setDramaTitle] = useState("");
    const library = useMemo(() => buildDramaProjectLibrary(projects, dramaDetails), [projects, dramaDetails]);
    const selectedOrdinaryIds = selectedIds.filter((id) => library.ordinaryProjects.some((project) => project.id === id));

    useEffect(() => {
        if (!hydrated || !token) {
            setDramaDetails([]);
            return;
        }
        let cancelled = false;
        setDramaLoading(true);
        setDramaError("");
        void (async () => {
            try {
                const summaries = await listDramaProjects(token);
                const details = await Promise.all(summaries.map((project) => getDramaProject(token, project.id)));
                if (!cancelled && useUserStore.getState().token === token) setDramaDetails(details);
            } catch (cause) {
                if (!cancelled) setDramaError(cause instanceof Error ? cause.message : "项目加载失败");
            } finally {
                if (!cancelled) setDramaLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [hydrated, token]);

    const enterProject = (id: string) => {
        router.push(`/canvas/${id}`);
    };
    const createAndEnter = () => enterProject(createProject(`无限画布 ${library.ordinaryProjects.length + 1}`));
    const createDramaAndEnter = async () => {
        const title = dramaTitle.trim();
        if (!token || !title) return;
        setCreatingDrama(true);
        try {
            const project = await createDramaProject(token, { title, sourceType: "novel", sourceText: "", adaptation: "", globalStyle: "" });
            const episode = await createDramaEpisode(token, project.id, { title: "第一集", script: "" });
            const remote = (await listCanvasProjects(token)).find((item) => item.id === episode.canvasId);
            if (!remote) throw new Error("第一集画布创建成功，但暂时无法读取");
            useCanvasStore.setState((state) => ({ projects: [remote, ...state.projects.filter((item) => item.id !== remote.id)] }));
            setDramaDetails((items) => [{ project, episodes: [episode] }, ...items]);
            setDramaTitle("");
            setDramaCreateOpen(false);
            router.push(`/canvas/${encodeURIComponent(episode.canvasId)}?workbench=1`);
        } catch (cause) {
            message.error(cause instanceof Error ? cause.message : "项目创建失败");
        } finally {
            setCreatingDrama(false);
        }
    };
    const createFirstEpisodeAndEnter = async (dramaProjectId: string) => {
        if (!token || creatingEpisodeFor) return;
        setCreatingEpisodeFor(dramaProjectId);
        try {
            const episode = await createDramaEpisode(token, dramaProjectId, { title: "第一集", script: "" });
            const remote = (await listCanvasProjects(token)).find((item) => item.id === episode.canvasId);
            if (!remote) throw new Error("第一集画布创建成功，但暂时无法读取");
            useCanvasStore.setState((state) => ({ projects: [remote, ...state.projects.filter((item) => item.id !== remote.id)] }));
            setDramaDetails((items) => items.map((item) => (item.project.id === dramaProjectId ? { ...item, episodes: [...item.episodes, episode] } : item)));
            router.push(`/canvas/${encodeURIComponent(episode.canvasId)}?workbench=1`);
        } catch (cause) {
            message.error(cause instanceof Error ? cause.message : "第一集创建失败");
        } finally {
            setCreatingEpisodeFor("");
        }
    };
    const importCanvas = async (file?: File) => {
        if (!file) return;
        try {
            const zip = await readZip(file);
            const projectFile = zip.get("projects.json");
            if (!projectFile) throw new Error("missing projects.json");
            const data = JSON.parse(await projectFile.text()) as CanvasExportFile;
            await Promise.all(
                data.projects.flatMap((project) =>
                    project.files.map(async (item) => {
                        const blob = zip.get(item.path);
                        if (!blob) return;
                        const typedBlob = blob.type ? blob : blob.slice(0, blob.size, item.mimeType);
                        await (item.storageKey.startsWith("image:") ? setImageBlob(item.storageKey, typedBlob) : setMediaBlob(item.storageKey, typedBlob));
                    }),
                ),
            );
            data.projects.forEach((item) => importProject(item.project));
            message.success(`已导入 ${data.projects.length} 个画布`);
        } catch {
            message.error("导入失败，请选择有效的画布压缩包");
        } finally {
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    return (
        <main className="h-full overflow-auto bg-background text-stone-950 dark:text-stone-100">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6 dark:border-stone-800">
                    <div>
                        <p className="text-xs text-stone-500">画布库</p>
                        <h1 className="mt-3 text-3xl font-semibold">无限画布</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedOrdinaryIds.length ? (
                            <>
                                <Button
                                    disabled={!hydrated}
                                    icon={<Download className="size-4" />}
                                    onClick={() =>
                                        void exportCanvasProjects(
                                            library.ordinaryProjects.filter((project) => selectedOrdinaryIds.includes(project.id)),
                                            `无限画布-${selectedOrdinaryIds.length}个项目`,
                                        )
                                    }
                                >
                                    导出选中
                                </Button>
                                <Button disabled={!hydrated} onClick={() => setDeleteIds(selectedOrdinaryIds)}>
                                    删除选中
                                </Button>
                            </>
                        ) : null}
                        {library.ordinaryProjects.length ? (
                            <Button disabled={!hydrated} onClick={() => setDeleteIds(library.ordinaryProjects.map((project) => project.id))}>
                                删除全部
                            </Button>
                        ) : null}
                        <Button disabled={!hydrated} icon={<FileUp className="size-4" />} onClick={() => inputRef.current?.click()}>
                            导入画布
                        </Button>
                        {token ? (
                            <Button disabled={!hydrated} icon={<Clapperboard className="size-4" />} onClick={() => setDramaCreateOpen(true)}>
                                新增项目
                            </Button>
                        ) : null}
                        <Button disabled={!hydrated} type="primary" icon={<Plus className="size-4" />} onClick={createAndEnter}>
                            新建画布
                        </Button>
                    </div>
                </header>

                {!hydrated ? (
                    <section className="flex min-h-[360px] items-center justify-center border-y border-stone-200 text-sm text-stone-500 dark:border-stone-800">正在加载画布...</section>
                ) : (
                    <div className="space-y-10">
                        {dramaError ? <Alert type="error" showIcon title="项目暂时无法加载" description={dramaError} /> : null}
                        {token && (dramaLoading || library.dramaProjects.length) ? (
                            <section>
                                <div className="mb-4 flex items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-semibold">项目</h2>
                                        <p className="mt-1 text-sm text-stone-500">一个项目统一管理全部分集画布与共享资产。</p>
                                    </div>
                                    {dramaLoading ? <Spin size="small" /> : null}
                                </div>
                                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                    {library.dramaProjects.map((item) => (
                                        <DramaProjectCard key={item.project.id} item={item} creatingEpisode={creatingEpisodeFor === item.project.id} onCreateEpisode={(projectId) => void createFirstEpisodeAndEnter(projectId)} />
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {library.ordinaryProjects.length ? (
                            <section>
                                <h2 className="mb-4 text-lg font-semibold">普通画布</h2>
                                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                    {library.ordinaryProjects.map((project) => (
                                        <CanvasProjectCard key={project.id} project={project} />
                                    ))}
                                </div>
                            </section>
                        ) : !library.dramaProjects.length && !dramaLoading ? (
                            <section className="flex min-h-[360px] flex-col items-center justify-center border-y border-stone-200 text-center dark:border-stone-800">
                                <h2 className="text-xl font-medium">还没有项目</h2>
                                <p className="mt-3 text-sm text-stone-500">新增项目统一管理分集，或创建一个普通无限画布。</p>
                                <div className="mt-6 flex gap-2">
                                    {token ? (
                                        <Button icon={<Clapperboard className="size-4" />} onClick={() => setDramaCreateOpen(true)}>
                                            新增项目
                                        </Button>
                                    ) : null}
                                    <Button type="primary" icon={<Plus className="size-4" />} onClick={createAndEnter}>
                                        新建画布
                                    </Button>
                                </div>
                            </section>
                        ) : null}
                    </div>
                )}
            </div>

            <input ref={inputRef} type="file" accept="application/zip,.zip" className="hidden" onChange={(event) => void importCanvas(event.target.files?.[0])} />
            <CanvasDeleteProjectsDialog />
            <Modal
                title="新增项目"
                open={dramaCreateOpen}
                okText="创建项目"
                cancelText="取消"
                confirmLoading={creatingDrama}
                okButtonProps={{ disabled: !dramaTitle.trim() }}
                onOk={() => void createDramaAndEnter()}
                onCancel={() => {
                    if (creatingDrama) return;
                    setDramaCreateOpen(false);
                    setDramaTitle("");
                }}
            >
                <p className="mb-3 text-sm text-stone-500">项目创建后会同时建立第一集画布，后续分集都归在同一个工作台下。</p>
                <Input aria-label="项目名称" value={dramaTitle} maxLength={200} autoFocus onChange={(event) => setDramaTitle(event.target.value)} onPressEnter={() => void createDramaAndEnter()} />
            </Modal>
        </main>
    );
}
