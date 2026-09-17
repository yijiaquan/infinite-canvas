"use client";

import { useEffect, useState } from "react";
import { Alert, App, Button, Empty, Form, Input, Modal, Select, Spin, Tag } from "antd";
import { Archive, FileImage, Mic2, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { createDramaAsset, createDramaAssetVersion, listDramaAssets, updateDramaAsset, type DramaAsset, type DramaAssetCatalog } from "@/services/api/drama-assets";
import { registeredDramaStorageId, uploadDramaMedia } from "@/services/api/drama-runs";
import { AssetPickerModal, type InsertAssetPayload } from "./asset-picker-modal";
import { DramaTextArea } from "./drama-text-area";

const kinds = [
    { value: "character", label: "人物与造型" },
    { value: "expression", label: "人物表情板" },
    { value: "scene", label: "场景" },
    { value: "prop", label: "道具" },
    { value: "voice", label: "声音" },
    { value: "reference", label: "其他参考" },
];
const blank = { title: "", kind: "character" as DramaAsset["kind"], parentId: "", description: "", defaultVoiceVersionId: "" };

function parentLabel(asset: DramaAsset, catalog: DramaAssetCatalog) {
    if (asset.kind === "character") return "所属人物";
    if (asset.kind === "expression") return "所属人物/造型";
    if (asset.kind === "reference" && catalog.assets.some((item) => item.id === asset.parentId && item.kind === "expression")) return "所属表情板";
    return "上级资产";
}

export function DramaAssetsView({ token, projectId }: { token: string; projectId: string }) {
    const { modal } = App.useApp();
    const [catalog, setCatalog] = useState<DramaAssetCatalog>({ assets: [], versions: [] });
    const [selectedId, setSelectedId] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState(blank);
    const [editing, setEditing] = useState<"new" | "edit" | null>(null);
    const [picker, setPicker] = useState(false);
    const [filter, setFilter] = useState("all");
    const selected = catalog.assets.find((asset) => asset.id === selectedId);
    const reload = async () => setCatalog(await listDramaAssets(token, projectId));
    useEffect(() => {
        let cancelled = false;
        setBusy(true);
        void listDramaAssets(token, projectId)
            .then((value) => {
                if (!cancelled) {
                    setCatalog(value);
                    setSelectedId(value.assets[0]?.id || "");
                }
            })
            .catch((cause) => {
                if (!cancelled) setError(cause instanceof Error ? cause.message : "资产加载失败");
            })
            .finally(() => {
                if (!cancelled) setBusy(false);
            });
        return () => {
            cancelled = true;
        };
    }, [token, projectId]);
    const perform = async (action: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            await action();
            await reload();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "资产操作失败");
        } finally {
            setBusy(false);
        }
    };
    const importVersion = (payload: InsertAssetPayload) =>
        void perform(async () => {
            if (!selected) return;
            if (payload.kind === "text") throw new Error("请选择图片、视频或音频素材");
            const url = payload.kind === "image" ? payload.dataUrl : payload.url;
            let storageId = registeredDramaStorageId(payload.storageKey);
            if (!storageId) {
                const response = await fetch(url);
                if (!response.ok) throw new Error("素材读取失败");
                storageId = (await uploadDramaMedia(token, await response.blob(), payload.title)).id;
            }
            await createDramaAssetVersion(token, projectId, selected.id, { storageId, note: payload.title, expectedRevision: selected.revision });
            setPicker(false);
        });
    return (
        <section aria-label="项目资产" className="min-w-0">
            {error && <Alert className="mb-4" showIcon type="error" title={error} />}
            <div className="mb-5 flex flex-wrap gap-3">
                <Select aria-label="资产分类" value={filter} onChange={setFilter} className="w-44" options={[{ value: "all", label: "全部资产" }, ...kinds, { value: "archived", label: "已归档" }]} />
                <Button
                    icon={<Plus size={16} />}
                    disabled={busy}
                    onClick={() => {
                        setDraft(blank);
                        setEditing("new");
                    }}
                >
                    新增资产
                </Button>
                <Button aria-label="刷新资产" icon={<RefreshCw size={16} />} disabled={busy} onClick={() => void perform(async () => {})} />
            </div>
            <Spin spinning={busy}>
                <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="min-w-0">
                        <nav aria-label="项目资产列表" className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                            {catalog.assets
                                .filter((asset) => (filter === "archived" ? asset.archived : !asset.archived && (filter === "all" || asset.kind === filter)))
                                .map((asset) => {
                                    const versions = catalog.versions.filter((version) => version.assetId === asset.id);
                                    const version = versions.find((item) => item.id === asset.adoptedVersionId) || versions[versions.length - 1];
                                    return (
                                        <button
                                            key={asset.id}
                                            type="button"
                                            aria-current={selectedId === asset.id ? "true" : undefined}
                                            className="min-w-0 overflow-hidden rounded border text-left transition hover:-translate-y-0.5 hover:shadow-md"
                                            style={{ borderColor: selectedId === asset.id ? "currentColor" : undefined }}
                                            onClick={() => setSelectedId(asset.id)}
                                        >
                                            <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden bg-black/5 dark:bg-white/5">
                                                {version?.mimeType?.startsWith("image/") ? (
                                                    <img src={`/api/files/${version.storageId}/content`} alt={asset.title} className="size-full object-cover" />
                                                ) : version?.mimeType?.startsWith("video/") ? (
                                                    <video src={`/api/files/${version.storageId}/content#t=0.1`} muted preload="metadata" className="size-full object-cover" />
                                                ) : version?.mimeType?.startsWith("audio/") ? (
                                                    <Mic2 className="size-8 opacity-40" />
                                                ) : (
                                                    <FileImage className="size-8 opacity-35" />
                                                )}
                                            </div>
                                            <div className="px-3 py-2.5">
                                                <div className="truncate text-sm font-medium">{asset.title}</div>
                                                <div className="mt-1 flex items-center justify-between gap-2 text-xs opacity-55">
                                                    <span>{kinds.find((item) => item.value === asset.kind)?.label}</span>
                                                    <span>{versions.length} 版</span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                        </nav>
                        {!catalog.assets.some((asset) => (filter === "archived" ? asset.archived : !asset.archived && (filter === "all" || asset.kind === filter))) && <Empty className="py-20" description="当前分类暂无资产" />}
                    </div>
                    {!selected ? (
                        <Empty description="选择或新增项目资产" />
                    ) : (
                        <aside className="min-w-0 self-start rounded border border-current/15 p-5 xl:sticky xl:top-4">
                            <div className="mb-4 flex flex-wrap items-center gap-3">
                                <strong>{selected.title}</strong>
                                <Tag>{kinds.find((item) => item.value === selected.kind)?.label}</Tag>
                                <Button
                                    disabled={busy}
                                    onClick={() => {
                                        setDraft({ title: selected.title, kind: selected.kind, parentId: selected.parentId, description: selected.description, defaultVoiceVersionId: selected.defaultVoiceVersionId || "" });
                                        setEditing("edit");
                                    }}
                                >
                                    编辑资料
                                </Button>
                                <Button
                                    icon={selected.archived ? <RotateCcw size={15} /> : <Archive size={15} />}
                                    disabled={busy}
                                    onClick={() =>
                                        void perform(async () => {
                                            await updateDramaAsset(token, projectId, selected.id, { archived: !selected.archived, expectedRevision: selected.revision });
                                        })
                                    }
                                >
                                    {selected.archived ? "恢复资产" : "归档资产"}
                                </Button>
                            </div>
                            <p className="mb-4 whitespace-pre-wrap break-words">{selected.description}</p>
                            {selected.parentId && (
                                <p className="mb-4">
                                    {parentLabel(selected, catalog)}：{catalog.assets.find((asset) => asset.id === selected.parentId)?.title}
                                </p>
                            )}
                            <Button disabled={busy || selected.archived} icon={<Plus size={15} />} onClick={() => setPicker(true)}>
                                从素材库添加版本
                            </Button>
                            <div className="mt-5 grid max-h-[52vh] gap-5 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-1">
                                {catalog.versions
                                    .filter((version) => version.assetId === selected.id)
                                    .map((version) => (
                                        <article key={version.id} className="min-w-0">
                                            {version.mimeType?.startsWith("audio/") ? (
                                                <audio controls preload="metadata" src={`/api/files/${version.storageId}/content`} className="w-full" />
                                            ) : version.mimeType?.startsWith("video/") ? (
                                                <video controls preload="metadata" src={`/api/files/${version.storageId}/content`} className="aspect-video w-full object-contain" />
                                            ) : (
                                                <a href={`/api/files/${version.storageId}/content`} target="_blank" rel="noreferrer">
                                                    <img src={`/api/files/${version.storageId}/content`} alt={version.note || selected.title} className="aspect-video w-full object-contain" />
                                                </a>
                                            )}
                                            <p className="my-2 break-words text-sm">{version.note || new Date(version.createdAt).toLocaleString()}</p>
                                            <Button
                                                disabled={busy || selected.archived || selected.adoptedVersionId === version.id}
                                                onClick={() =>
                                                    modal.confirm({
                                                        title: "采用这个资产版本？",
                                                        content: "已有 Clip 继续引用原版本，可在输入绑定中逐项更新。",
                                                        okText: "采用",
                                                        cancelText: "取消",
                                                        onOk: () =>
                                                            perform(async () => {
                                                                await updateDramaAsset(token, projectId, selected.id, { adoptedVersionId: version.id, expectedRevision: selected.revision });
                                                            }),
                                                    })
                                                }
                                            >
                                                {selected.adoptedVersionId === version.id ? "已采用" : "采用版本"}
                                            </Button>
                                        </article>
                                    ))}
                            </div>
                        </aside>
                    )}
                </div>
            </Spin>
            <Modal
                title={editing === "new" ? "新增资产" : "编辑资产"}
                open={!!editing}
                confirmLoading={busy}
                okText="保存"
                cancelText="取消"
                onCancel={() => {
                    if (!busy) setEditing(null);
                }}
                onOk={() =>
                    void perform(async () => {
                        if (!draft.title.trim()) throw new Error("请填写资产名称");
                        if (draft.kind === "expression" && !draft.parentId) throw new Error("请选择表情板所属的人物或造型");
                        const { kind, ...editable } = draft;
                        const saved = editing === "new" ? await createDramaAsset(token, projectId, { ...editable, kind }) : await updateDramaAsset(token, projectId, selectedId, { ...editable, expectedRevision: selected!.revision });
                        setSelectedId(saved.id);
                        setEditing(null);
                    })
                }
            >
                {error && <Alert type="error" title={error} className="mb-3" />}
                <Form layout="vertical">
                    <Form.Item label="资产名称" required>
                        <Input aria-label="资产名称" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                    </Form.Item>
                    <Form.Item label="类型">
                        <Select value={draft.kind} options={kinds} disabled={editing === "edit"} onChange={(kind) => setDraft({ ...draft, kind, parentId: "" })} />
                    </Form.Item>
                    {draft.kind === "character" && (
                        <Form.Item label="所属人物（造型可选）">
                            <Select
                                allowClear
                                value={draft.parentId || undefined}
                                options={catalog.assets.filter((asset) => asset.kind === "character" && !asset.archived && asset.id !== selectedId).map((asset) => ({ value: asset.id, label: asset.title }))}
                                onChange={(parentId) => setDraft({ ...draft, parentId: parentId || "" })}
                            />
                        </Form.Item>
                    )}
                    {draft.kind === "expression" && (
                        <Form.Item label="所属人物/造型" required>
                            <Select
                                value={draft.parentId || undefined}
                                placeholder="选择人物或具体造型"
                                options={catalog.assets.filter((asset) => asset.kind === "character" && !asset.archived).map((asset) => ({ value: asset.id, label: asset.title }))}
                                onChange={(parentId) => setDraft({ ...draft, parentId })}
                            />
                        </Form.Item>
                    )}
                    {draft.kind === "reference" && (
                        <Form.Item label="所属表情板（单状态参考可选）">
                            <Select
                                allowClear
                                value={draft.parentId || undefined}
                                placeholder="普通参考无需选择"
                                options={catalog.assets.filter((asset) => asset.kind === "expression" && !asset.archived).map((asset) => ({ value: asset.id, label: asset.title }))}
                                onChange={(parentId) => setDraft({ ...draft, parentId: parentId || "" })}
                            />
                        </Form.Item>
                    )}
                    {draft.kind === "character" && (
                        <Form.Item label="默认音色（固定版本）">
                            <Select
                                aria-label="人物默认音色"
                                allowClear
                                value={draft.defaultVoiceVersionId || undefined}
                                options={catalog.versions
                                    .filter((version) => catalog.assets.some((asset) => asset.id === version.assetId && asset.kind === "voice" && !asset.archived) || version.id === draft.defaultVoiceVersionId)
                                    .map((version) => ({ value: version.id, label: `${catalog.assets.find((a) => a.id === version.assetId)?.title} · ${version.note || version.id.slice(0, 8)}` }))}
                                onChange={(id) => setDraft({ ...draft, defaultVoiceVersionId: id || "" })}
                            />
                        </Form.Item>
                    )}
                    <Form.Item label="设定与状态">
                        <DramaTextArea aria-label="资产设定" value={draft.description} rows={4} className="max-h-72 resize-y" onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
                    </Form.Item>
                </Form>
            </Modal>
            <AssetPickerModal
                open={picker}
                onClose={() => {
                    if (!busy) setPicker(false);
                }}
                onInsert={importVersion}
            />
        </section>
    );
}
