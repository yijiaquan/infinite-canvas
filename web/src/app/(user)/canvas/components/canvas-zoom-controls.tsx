import type { ReactNode } from "react";
import { Compass, Focus, HelpCircle, LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Modal, Popover, Tooltip } from "antd";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

type CanvasZoomControlsProps = {
    scale: number;
    onScaleChange: (scale: number) => void;
    onReset: () => void;
    isMiniMapOpen: boolean;
    onToggleMiniMap: () => void;
    onOrganize: () => void;
    onKeepOrganize: () => void;
    onRestoreOrganize: () => void;
    organizePending: boolean;
};

export function CanvasZoomControls({ scale, onScaleChange, onReset, isMiniMapOpen, onToggleMiniMap, onOrganize, onKeepOrganize, onRestoreOrganize, organizePending }: CanvasZoomControlsProps) {
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const dockStyle = { background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.toolbar.item, boxShadow: colorTheme === "dark" ? "0 18px 45px rgba(0,0,0,.32)" : "0 16px 40px rgba(28,25,23,.12)" };
    const activeStyle = { background: theme.toolbar.activeBg, color: theme.toolbar.activeText };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (event.repeat || target?.matches("input, textarea, [contenteditable='true']")) return;
            if (event.altKey && event.shiftKey && event.key.toLowerCase() === "f") {
                event.preventDefault();
                if (!organizePending) onOrganize();
            } else if (event.key === "Escape" && organizePending) {
                event.preventDefault();
                onKeepOrganize();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onKeepOrganize, onOrganize, organizePending]);

    return (
        <div className="absolute bottom-5 left-5 z-50" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex h-14 items-center gap-1 rounded-xl border px-2 shadow-lg backdrop-blur" style={dockStyle}>
                <Popover
                    open={organizePending}
                    placement="topLeft"
                    trigger="click"
                    content={
                        <div className="w-52">
                            <div className="mb-3 font-medium">是否保留此次整理结果？</div>
                            <div className="flex justify-end gap-2">
                                <Button type="text" onClick={onRestoreOrganize}>
                                    还原
                                </Button>
                                <Button type="primary" onClick={onKeepOrganize}>
                                    保留
                                </Button>
                            </div>
                        </div>
                    }
                >
                    <Tooltip title="整理画布 Alt+Shift+F">
                        <Button
                            type="text"
                            className="!h-8 !w-8 !min-w-8 !p-0"
                            style={organizePending ? activeStyle : { color: theme.toolbar.item }}
                            icon={<LayoutGrid className="size-4" />}
                            onClick={onOrganize}
                            disabled={organizePending}
                            aria-label="整理画布"
                        />
                    </Tooltip>
                </Popover>
                <Tooltip title={isMiniMapOpen ? "关闭小地图" : "打开小地图"}>
                    <Button
                        type="text"
                        className="!h-8 !w-8 !min-w-8 !p-0"
                        style={isMiniMapOpen ? activeStyle : { color: theme.toolbar.item }}
                        icon={<Compass className="size-4" />}
                        onClick={onToggleMiniMap}
                        aria-label={isMiniMapOpen ? "关闭小地图" : "打开小地图"}
                    />
                </Tooltip>
                <Tooltip title="重置视图">
                    <Button type="text" className="!h-8 !w-8 !min-w-8 !p-0" style={{ color: theme.toolbar.item }} icon={<Focus className="size-4" />} onClick={onReset} aria-label="重置视图" />
                </Tooltip>
                <Tooltip title="放大/缩小画布">
                    <input
                        type="range"
                        min="5"
                        max="500"
                        step="1"
                        value={Math.round(scale * 100)}
                        className="w-24"
                        style={{ accentColor: theme.node.activeStroke }}
                        onChange={(event) => onScaleChange(Number(event.target.value) / 100)}
                        aria-label="放大/缩小画布"
                    />
                </Tooltip>
                <span className="w-10 text-right text-xs tabular-nums" style={{ color: theme.node.muted }}>
                    {Math.round(scale * 100)}%
                </span>
                <Tooltip title="快捷键">
                    <Button type="text" className="!h-8 !w-8 !min-w-8 !p-0" style={shortcutsOpen ? activeStyle : { color: theme.toolbar.item }} icon={<HelpCircle className="size-4" />} onClick={() => setShortcutsOpen(true)} aria-label="快捷键" />
                </Tooltip>
            </div>
            <Modal title="快捷键" open={shortcutsOpen} onCancel={() => setShortcutsOpen(false)} footer={null} centered>
                <div className="space-y-3 border-t pt-4 text-sm" style={{ borderColor: theme.node.stroke }}>
                    <Shortcut label="Space + 拖动" value="临时反转选择/移动工具" />
                    <Shortcut label="滚轮" value="缩放画布" />
                    <Shortcut label="拖动" value="使用当前工具操作画布" />
                    <Shortcut label="Shift / Ctrl / Cmd + 点击" value="追加选择节点" />
                    <Shortcut label="Ctrl / Cmd + G" value="创建组" />
                    <Shortcut label="Alt + Shift + F" value="整理画布" />
                    <Shortcut label="Ctrl / Cmd + C / V" value="复制 / 粘贴节点" />
                    <Shortcut label="Delete / Backspace" value="删除选中" />
                </div>
            </Modal>
        </div>
    );
}

function Shortcut({ label, value }: { label: ReactNode; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-base font-medium">{label}</span>
            <span className="opacity-60">{value}</span>
        </div>
    );
}
