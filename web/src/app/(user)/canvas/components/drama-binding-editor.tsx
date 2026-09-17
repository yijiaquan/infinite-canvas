"use client";

import { useContext, useEffect, useState } from "react";
import { Alert, App, Button, Empty, Modal, Select, Tooltip } from "antd";
import { ArrowDown, ArrowUp, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { getDramaBinding, listDramaAssets, updateDramaBinding, type DramaAssetCatalog, type DramaBinding, type DramaBindingReference } from "@/services/api/drama-assets";
import type { DramaRunReference } from "@/services/api/drama-runs";
import { DramaCanvasContext } from "./drama-canvas-context";

const roles = [
    { value: "character", label: "人物身份" },
    { value: "expression", label: "人物表情" },
    { value: "scene", label: "场景" },
    { value: "prop", label: "道具" },
    { value: "reference", label: "图片参考" },
    { value: "voice", label: "说话者声音" },
    { value: "video_reference", label: "视频参考" },
];
const stageRoles = {
    storyboard: roles.filter((role) => !["voice", "video_reference"].includes(role.value)),
    video: roles,
};

function expressionAssetMatchesStage(asset: DramaAssetCatalog["assets"][number], stage: "storyboard" | "video", catalog: DramaAssetCatalog) {
    if (stage === "storyboard") return asset.kind === "expression";
    return asset.kind === "reference" && catalog.assets.some((parent) => parent.id === asset.parentId && parent.kind === "expression");
}
export function DramaBindingEditor({
    token,
    projectId,
    episodeId,
    clipId,
    stage,
    speakers = [],
    onChange,
    onDirtyChange,
}: {
    token: string;
    projectId: string;
    episodeId: string;
    clipId: string;
    stage: "storyboard" | "video";
    speakers?: string[];
    onChange: (references: DramaRunReference[] | null) => void;
    onDirtyChange: (dirty: boolean) => void;
}) {
    const canvas = useContext(DramaCanvasContext);
    const { modal } = App.useApp();
    const [epoch, setEpoch] = useState(0);
    const [catalog, setCatalog] = useState<DramaAssetCatalog>({ assets: [], versions: [] });
    const [binding, setBinding] = useState<DramaBinding | null>(null);
    const [draft, setDraft] = useState<DramaBindingReference[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(true);
    const [confirm, setConfirm] = useState(false);
    const dirty = !!binding && JSON.stringify(draft) !== JSON.stringify(binding.references);
    useEffect(() => {
        onDirtyChange(dirty);
        return () => onDirtyChange(false);
    }, [dirty, onDirtyChange]);
    useEffect(() => {
        let cancelled = false;
        setBusy(true);
        setError("");
        onChange(null);
        void (async () => {
            try {
                const assets = await listDramaAssets(token, projectId);
                const saved = await getDramaBinding(token, projectId, episodeId, clipId, stage);
                if (!cancelled) {
                    setCatalog(assets);
                    setBinding(saved);
                    setDraft(saved.references);
                }
            } catch (cause) {
                if (!cancelled) setError(cause instanceof Error ? cause.message : "输入绑定加载失败");
            } finally {
                if (!cancelled) setBusy(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [token, projectId, episodeId, clipId, stage, onChange, epoch]);
    useEffect(() => {
        if (!binding || dirty || busy) {
            onChange(null);
            return;
        }
        const refs: DramaRunReference[] = [];
        for (const input of binding.references) {
            const version = catalog.versions.find((item) => item.id === input.versionId);
            if (!version) {
                onChange(null);
                return;
            }
            refs.push({ assetId: input.assetId, versionId: input.versionId, storageId: version.storageId, role: input.role, order: input.order, speaker: input.speaker });
        }
        onChange(refs);
    }, [binding, dirty, busy, catalog, onChange]);
    const patch = (index: number, value: Partial<DramaBindingReference>) => setDraft((items) => items.map((item, i) => (i === index ? { ...item, ...value } : item)));
    const move = (index: number, delta: number) =>
        setDraft((items) => {
            const next = [...items];
            [next[index], next[index + delta]] = [next[index + delta], next[index]];
            return next.map((item, order) => ({ ...item, order }));
        });
    const showBindings = (saved: DramaBinding) => {
        const target = canvas?.nodes.find((node) => node.metadata?.dramaClipId === clipId && node.metadata?.dramaRole === stage);
        if (!target) return;
        canvas?.bindInputs(
            target.id,
            saved.references.map((input) => {
                const version = catalog.versions.find((item) => item.id === input.versionId)!;
                return { ...input, storageId: version.storageId, title: catalog.assets.find((item) => item.id === input.assetId)?.title || input.assetId };
            }),
        );
    };
    return (
        <section aria-label="实际模型输入" className="my-6 min-w-0">
            {error && <Alert type="error" showIcon title={error} className="mb-3" />}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span>实际模型输入</span>
                <div className="flex flex-wrap gap-2">
                    <Button
                        aria-label="刷新输入绑定"
                        icon={<RefreshCw size={14} />}
                        disabled={busy}
                        onClick={() => {
                            if (dirty) modal.confirm({ title: "加载已保存的输入绑定？", okText: "放弃草稿并刷新", cancelText: "继续编辑", onOk: () => setEpoch((n) => n + 1) });
                            else setEpoch((n) => n + 1);
                        }}
                    />
                    <Button icon={<Plus size={14} />} disabled={busy} onClick={() => setDraft([...draft, { assetId: "", versionId: "", role: "reference", order: draft.length, speaker: "" }])}>
                        添加输入
                    </Button>
                    <Button icon={<Save size={14} />} disabled={busy || !dirty} onClick={() => setConfirm(true)}>
                        预览绑定
                    </Button>
                </div>
            </div>
            {!draft.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未绑定项目参考素材" />}
            {draft.map((input, index) => {
                const asset = catalog.assets.find((item) => item.id === input.assetId);
                const version = catalog.versions.find((item) => item.id === input.versionId);
                return (
                    <div key={index} className="mb-4 border-b border-current/10 pb-4">
                        <div className="grid gap-2 sm:grid-cols-3">
                            <Select
                                aria-label={`输入 ${index + 1} 资产`}
                                value={input.assetId || undefined}
                                placeholder="选择资产"
                                disabled={busy}
                                options={catalog.assets
                                    .filter((item) => (!item.archived || item.id === input.assetId) && (input.role !== "expression" || expressionAssetMatchesStage(item, stage, catalog)))
                                    .map((item) => ({ value: item.id, label: item.title }))}
                                onChange={(assetId) => {
                                    const selected = catalog.assets.find((item) => item.id === assetId);
                                    patch(index, { assetId, versionId: selected?.adoptedVersionId || "" });
                                }}
                            />
                            <Select
                                aria-label={`输入 ${index + 1} 版本`}
                                value={input.versionId || undefined}
                                placeholder="固定版本"
                                disabled={busy}
                                options={catalog.versions.filter((item) => item.assetId === input.assetId).map((item) => ({ value: item.id, label: `${item.note || item.id.slice(0, 8)}${asset?.adoptedVersionId === item.id ? " · 已采用" : ""}` }))}
                                onChange={(versionId) => patch(index, { versionId })}
                            />
                            <Select
                                aria-label={`输入 ${index + 1} 用途`}
                                value={input.role}
                                disabled={busy}
                                options={stageRoles[stage]}
                                onChange={(role) => patch(index, { role, ...(role === "voice" ? {} : { speaker: "" }), ...(role === "expression" && asset && !expressionAssetMatchesStage(asset, stage, catalog) ? { assetId: "", versionId: "" } : {}) })}
                            />
                        </div>
                        {input.role === "voice" && (
                            <Select
                                aria-label="声音对应说话者"
                                className="mt-2 w-full"
                                placeholder="对应镜头中的说话者"
                                value={input.speaker || undefined}
                                options={[...new Set([...speakers, ...(input.speaker ? [input.speaker] : [])])].map((speaker) => ({ value: speaker, label: speaker }))}
                                onChange={(speaker) => patch(index, { speaker })}
                            />
                        )}
                        {stage === "video" && asset?.kind === "character" && (asset.defaultVoiceVersionId || catalog.assets.find((a) => a.id === asset.parentId)?.defaultVoiceVersionId) && (
                            <Button
                                className="mt-2"
                                disabled={busy || !speakers.length}
                                onClick={() => {
                                    const versionId = asset.defaultVoiceVersionId || catalog.assets.find((a) => a.id === asset.parentId)?.defaultVoiceVersionId;
                                    const voice = catalog.versions.find((v) => v.id === versionId);
                                    if (!voice) return;
                                    setDraft([...draft, { assetId: voice.assetId, versionId: voice.id, role: "voice", order: draft.length, speaker: speakers.includes(asset.title) ? asset.title : "" }]);
                                }}
                            >
                                添加人物默认音色
                            </Button>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-sm">输入 {index + 1}</span>
                            {version && (
                                <a target="_blank" rel="noreferrer" href={`/api/files/${version.storageId}/content`}>
                                    查看素材
                                </a>
                            )}
                            {asset?.adoptedVersionId && asset.adoptedVersionId !== input.versionId && <span className="text-sm">资产已有其他采用版本，当前保持原引用</span>}
                            <Tooltip title="输入上移">
                                <Button aria-label="输入上移" icon={<ArrowUp size={14} />} disabled={busy || index === 0} onClick={() => move(index, -1)} />
                            </Tooltip>
                            <Tooltip title="输入下移">
                                <Button aria-label="输入下移" icon={<ArrowDown size={14} />} disabled={busy || index === draft.length - 1} onClick={() => move(index, 1)} />
                            </Tooltip>
                            <Tooltip title="移除输入">
                                <Button aria-label="移除输入" icon={<Trash2 size={14} />} disabled={busy} onClick={() => setDraft(draft.filter((_, i) => i !== index).map((item, order) => ({ ...item, order })))} />
                            </Tooltip>
                        </div>
                    </div>
                );
            })}
            <Modal
                title="确认输入绑定"
                open={confirm}
                confirmLoading={busy}
                okText="应用绑定"
                cancelText="继续编辑"
                onCancel={() => {
                    if (!busy) setConfirm(false);
                }}
                onOk={async () => {
                    if (!binding || busy) return;
                    setBusy(true);
                    setError("");
                    try {
                        const saved = await updateDramaBinding(token, projectId, episodeId, clipId, stage, draft, binding.revision);
                        setBinding(saved);
                        setDraft(saved.references);
                        showBindings(saved);
                        setConfirm(false);
                    } catch (cause) {
                        setError(cause instanceof Error ? cause.message : "绑定保存失败");
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                {error && <Alert type="error" title={error} className="mb-3" />}
                <ol className="list-decimal pl-5">
                    {draft.map((item, index) => (
                        <li key={index}>
                            {catalog.assets.find((asset) => asset.id === item.assetId)?.title || "未选择"} · {roles.find((role) => role.value === item.role)?.label} ·{" "}
                            {catalog.versions.find((version) => version.id === item.versionId)?.note || item.versionId || "未选择版本"}
                        </li>
                    ))}
                </ol>
            </Modal>
        </section>
    );
}
