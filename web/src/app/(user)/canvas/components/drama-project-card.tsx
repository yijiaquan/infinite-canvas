"use client";

import { Button, Dropdown } from "antd";
import { ChevronDown, Clapperboard, Layers3, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import type { DramaProjectLibraryItem } from "../utils/drama-project-library";

export function DramaProjectCard({ item, creatingEpisode = false, onCreateEpisode }: { item: DramaProjectLibraryItem; creatingEpisode?: boolean; onCreateEpisode?: (projectId: string) => void }) {
    const router = useRouter();
    const openEpisode = (canvasId: string) => router.push(`/canvas/${encodeURIComponent(canvasId)}`);
    const open = () => item.entryEpisode && openEpisode(item.entryEpisode.canvasId);

    return (
        <article className="flex min-h-44 flex-col justify-between rounded-lg border border-stone-200 bg-stone-50 p-5 transition hover:border-stone-400 dark:border-stone-800 dark:bg-white/5 dark:hover:border-stone-600">
            <button type="button" disabled={!item.entryEpisode} onClick={open} className="min-w-0 text-left disabled:cursor-default">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                    <Clapperboard className="size-4" />
                    项目
                </div>
                <h2 className="mt-3 truncate text-xl font-semibold">{item.project.title}</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-400">
                    {item.episodes.length} 集 · {item.nodeCount} 个画布节点
                </p>
            </button>
            <div className="mt-8 flex items-end justify-between gap-3">
                <p className="text-xs text-stone-500">更新于 {new Date(item.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                {item.episodes.length ? (
                    <Dropdown trigger={["click"]} menu={{ items: item.episodes.map((episode) => ({ key: episode.id, label: episode.title, onClick: () => openEpisode(episode.canvasId) })) }}>
                        <Button size="small" icon={<Layers3 className="size-4" />}>
                            分集 <ChevronDown className="size-3" />
                        </Button>
                    </Dropdown>
                ) : (
                    <Button size="small" loading={creatingEpisode} icon={<Plus className="size-4" />} onClick={() => onCreateEpisode?.(item.project.id)}>
                        创建第一集
                    </Button>
                )}
            </div>
        </article>
    );
}
