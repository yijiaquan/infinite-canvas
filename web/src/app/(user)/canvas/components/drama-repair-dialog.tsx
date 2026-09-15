"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Checkbox, Empty, Modal, theme } from "antd";
import type { DramaRepairPart, DramaRepairPreview, DramaRepairSelection } from "../utils/drama-canvas";

const labels: Record<DramaRepairPart, string> = { group: "Clip 分组", storyboard: "故事板节点", video: "视频节点", link: "故事板到视频的连线" };

export function DramaRepairDialog({ preview, onCancel, onApply }: { preview: DramaRepairPreview | null; onCancel: () => void; onApply: (selections: DramaRepairSelection[]) => Promise<void> }) {
    const { token } = theme.useToken();
    const [selected, setSelected] = useState<Record<string, DramaRepairPart[]>>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const pending = useRef(false);
    const currentPreview = useRef(preview);
    currentPreview.current = preview;
    useEffect(() => {
        setSelected({});
        setError("");
    }, [preview]);
    const plans = preview?.clips.filter((clip) => clip.parts.length || clip.blockedReasons.length) || [];
    const selections = plans.filter((clip) => !clip.blockedReasons.length && selected[clip.clipId]?.length).map((clip) => ({ clipId: clip.clipId, parts: selected[clip.clipId] }));
    const missingDependencies = plans.some((clip) => clip.parts.some((part) => selected[clip.clipId]?.includes(part.part) && part.requires.some((required) => !selected[clip.clipId]?.includes(required))));
    const apply = async () => {
        if (!preview || pending.current || !selections.length || missingDependencies) return;
        pending.current = true;
        setBusy(true);
        setError("");
        try {
            await onApply(selections);
        } catch (cause) {
            if (currentPreview.current === preview) setError(cause instanceof Error ? cause.message : "结构修复失败，请重新预览");
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };
    return (
        <Modal
            title="修复 Clip 画布结构"
            open={preview !== null}
            width={600}
            okText="应用所选修复"
            cancelText="取消"
            confirmLoading={busy}
            okButtonProps={{ disabled: busy || !selections.length || missingDependencies }}
            cancelButtonProps={{ disabled: busy }}
            closable={!busy}
            keyboard={!busy}
            onCancel={() => {
                if (!busy) onCancel();
            }}
            onOk={() => void apply()}
        >
            <Alert type="info" showIcon title={<span style={{ color: token.colorText }}>缺失节点仅恢复为空白草稿，不恢复已删除的提示词或媒体。现有节点、布局和内容保持不变。</span>} style={{ background: token.colorFillAlter, borderColor: token.colorBorderSecondary }} className="mb-4" />
            {error && <Alert type="error" showIcon title={error} className="mb-4" />}
            <div className="max-h-[55vh] space-y-5 overflow-y-auto">
                {!plans.length && <Empty description="没有需要修复的结构" />}
                {plans.map((clip, index) => (
                    <section key={`${clip.clipId}:${index}`} aria-label={`${clip.title} 修复项`} className="min-w-0">
                        <div className="mb-2 break-words font-medium">{clip.title}</div>
                        {clip.blockedReasons.length > 0 && (
                            <Alert
                                type="error"
                                showIcon
                                title="存在冲突，不能自动修复"
                                description={
                                    <div>
                                        {clip.blockedReasons.map((reason, index) => (
                                            <div key={index} className="break-words">
                                                {reason}
                                            </div>
                                        ))}
                                    </div>
                                }
                                className="mb-2"
                            />
                        )}
                        <div className="flex flex-col gap-2">
                            {clip.parts.map((part) => {
                                const missing = part.requires.filter((required) => !selected[clip.clipId]?.includes(required));
                                return (
                                    <div key={part.part} className="min-w-0">
                                        <Checkbox
                                            checked={selected[clip.clipId]?.includes(part.part) || false}
                                            disabled={busy || !!clip.blockedReasons.length}
                                            onChange={(event) => {
                                                const checked = event.target.checked;
                                                setSelected((current) => ({ ...current, [clip.clipId]: checked ? [...(current[clip.clipId] || []), part.part] : (current[clip.clipId] || []).filter((item) => item !== part.part) }));
                                            }}
                                        >
                                            {labels[part.part]}
                                        </Checkbox>
                                        {missing.length > 0 && <div className="pl-6 text-xs opacity-70">还需选择：{missing.map((item) => labels[item]).join("、")}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </Modal>
    );
}
