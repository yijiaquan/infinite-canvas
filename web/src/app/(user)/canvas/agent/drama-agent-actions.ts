import { createDramaClip, getDramaProject, listDramaClips, reorderDramaClips, updateDramaClip, updateDramaEpisode, updateDramaProject, type DramaClip, type DramaClipDraft, type DramaEpisodeDraft, type DramaProjectDraft } from "@/services/api/drama";
import { createDramaAsset, createDramaAssetVersion, getDramaBinding, updateDramaAsset, updateDramaBinding, type DramaAssetCatalog, type DramaBinding } from "@/services/api/drama-assets";
import { adoptDramaOutput, downloadDramaEpisode, listDramaAdoptions } from "@/services/api/drama-adoption";
import { cancelDramaRun, enqueueDramaRun, listDramaEpisodeRuns, listDramaRuns, previewDramaRun, recheckDramaRun, type DramaRun, type DramaRunInput } from "@/services/api/drama-runs";
import { normalizeCanvasAgentAction, type CanvasAgentAction, type CanvasAgentToolResult } from "./canvas-agent-tools";

const DRAMA_ACTIONS = new Set([
    "get_drama_project",
    "get_drama_episode",
    "get_drama_clips",
    "get_drama_assets",
    "update_drama_project",
    "update_drama_episode",
    "create_drama_clip",
    "update_drama_clip",
    "reorder_drama_clips",
    "archive_drama_clip",
    "restore_drama_clip",
    "create_drama_asset",
    "update_drama_asset",
    "generate_drama_asset_candidate",
    "register_drama_asset_version",
    "get_drama_binding",
    "update_drama_binding",
    "prepare_drama_clip_nodes",
    "repair_drama_clip_group_layout",
    "update_drama_generation_node",
    "get_drama_runs",
    "preview_drama_run",
    "enqueue_drama_run",
    "cancel_drama_run",
    "recheck_drama_run",
    "get_drama_adoptions",
    "adopt_drama_output",
    "export_drama_episode",
]);

export type DramaAgentContext = {
    token: string;
    projectId: string;
    episodeId: string;
    canvasId: string;
    autoGenerateMedia?: boolean;
    isCurrent: () => boolean;
    onChanged: () => void;
    readAssets: () => Promise<DramaAssetCatalog>;
    prepareClipNodes?: (clips: DramaClip[]) => Promise<unknown>;
    repairClipGroupLayout?: (clipIds: string[]) => Promise<unknown>;
    updateGenerationNode?: (input: { clipId: string; nodeId: string; stage: "storyboard" | "video"; prompt: string; parameters?: Record<string, string | number | boolean> }) => Promise<unknown>;
    resolveNodeStorage?: (assetId: string, nodeId: string) => Promise<{ storageId: string }>;
    applyBinding?: (binding: DramaBinding, catalog: DramaAssetCatalog) => Promise<unknown>;
    buildRunInput?: (clipId: string, nodeId: string, requestId?: string) => Promise<{ input: DramaRunInput; boardUpdated?: boolean }>;
    onRunEnqueued?: (nodeId: string, run: DramaRun) => Promise<void>;
    onOutputAdopted?: (input: { clipId: string; nodeId: string; kind: "image" | "video"; runId: string; output: DramaRun["outputs"][number] }) => Promise<unknown>;
    generateAssetCandidate?: (input: { assetId: string; kind: "image" | "audio"; prompt: string; title?: string; sourceNodeIds: string[]; voice?: string; instructions?: string }) => Promise<unknown>;
};

export async function executeDramaAgentAction(action: CanvasAgentAction, context: DramaAgentContext): Promise<CanvasAgentToolResult | null> {
    if (!DRAMA_ACTIONS.has(action.name)) return null;
    const { token, projectId, episodeId, canvasId } = context;
    const checkScope = () => {
        if (!token || !projectId || !episodeId || !canvasId || !context.isCurrent()) throw new Error("当前账号或正式集画布已改变，请重新读取");
    };
    try {
        checkScope();
        const args = normalizeCanvasAgentAction(action.name, action.arguments, action.id).arguments;
        const detail = await getDramaProject(token, projectId);
        checkScope();
        const episode = detail.episodes.find((item) => item.id === episodeId && item.canvasId === canvasId);
        if (!episode) throw new Error("当前画布不属于指定漫剧集");
        const checkRevision = (expected: unknown, actual: number) => {
            if (expected !== actual) throw new Error("内容版本已改变，请重新读取并合并修改");
        };
        const readClips = async () => {
            const clips = await listDramaClips(token, projectId, episodeId);
            checkScope();
            return clips;
        };
        const requireClip = async (id: unknown, archived?: boolean) => {
            const clip = (await readClips()).find((item) => item.id === id);
            if (!clip || (archived !== undefined && clip.archived !== archived)) throw new Error(archived ? "Clip 不存在或不在回收站" : "Clip 不存在或已在回收站");
            return clip;
        };
        let data: unknown;
        let changed = false;
        switch (action.name) {
            case "get_drama_project":
                data = detail;
                break;
            case "get_drama_episode":
                data = episode;
                break;
            case "get_drama_clips":
                data = await readClips();
                break;
            case "get_drama_assets":
                data = await context.readAssets();
                break;
            case "update_drama_project": {
                checkRevision(args.expectedRevision, detail.project.revision);
                const { expectedRevision, ...patch } = args;
                const current = detail.project;
                const draft: DramaProjectDraft = {
                    title: current.title,
                    sourceType: current.sourceType,
                    sourceText: current.sourceText,
                    adaptation: current.adaptation,
                    globalStyle: current.globalStyle,
                    generationDefaults: current.generationDefaults,
                    ...patch,
                } as DramaProjectDraft;
                data = await updateDramaProject(token, projectId, draft, expectedRevision as number);
                changed = true;
                break;
            }
            case "update_drama_episode": {
                checkRevision(args.expectedRevision, episode.revision);
                const { expectedRevision, ...patch } = args;
                data = await updateDramaEpisode(token, projectId, episodeId, { title: episode.title, script: episode.script, ...patch } as DramaEpisodeDraft, expectedRevision as number);
                changed = true;
                break;
            }
            case "create_drama_clip": {
                data = await createDramaClip(token, projectId, episodeId, { title: "", scene: "", summary: "", entryState: "", exitState: "", shots: [], archived: false, ...args } as DramaClipDraft);
                changed = true;
                break;
            }
            case "update_drama_clip": {
                const clip = await requireClip(args.clipId, false);
                checkRevision(args.expectedRevision, clip.revision);
                const { clipId, expectedRevision, ...patch } = args;
                data = await updateDramaClip(token, projectId, episodeId, clipId as string, clipDraft(clip, patch), expectedRevision as number);
                changed = true;
                break;
            }
            case "reorder_drama_clips": {
                const active = (await readClips()).filter((item) => !item.archived);
                const ids = args.clipIds as string[];
                if (ids.length !== active.length || active.some((item) => !ids.includes(item.id))) throw new Error("clipIds 必须完整包含全部制作中 Clip");
                data = await reorderDramaClips(
                    token,
                    projectId,
                    episodeId,
                    ids.map((id) => active.find((item) => item.id === id)!),
                );
                changed = true;
                break;
            }
            case "archive_drama_clip":
            case "restore_drama_clip": {
                const restoring = action.name === "restore_drama_clip";
                const clip = await requireClip(args.clipId, restoring);
                checkRevision(args.expectedRevision, clip.revision);
                data = await updateDramaClip(token, projectId, episodeId, clip.id, { ...clipDraft(clip), archived: !restoring }, clip.revision);
                changed = true;
                break;
            }
            case "create_drama_asset": {
                data = await createDramaAsset(token, projectId, { title: args.title as string, kind: args.kind as never, parentId: args.parentId as string, description: args.description as string, defaultVoiceVersionId: undefined });
                changed = true;
                break;
            }
            case "update_drama_asset": {
                {
                    const catalog = await context.readAssets();
                    const asset = catalog.assets.find((item) => item.id === args.assetId);
                    if (!asset) throw new Error("资产不存在");
                    checkRevision(args.expectedRevision, asset.revision);
                    const { assetId, expectedRevision, ...patch } = args;
                    data = await updateDramaAsset(token, projectId, assetId as string, { ...patch, expectedRevision: expectedRevision as number });
                    changed = true;
                    break;
                }
            }
            case "generate_drama_asset_candidate": {
                const catalog = await context.readAssets();
                if (!catalog.assets.some((item) => item.id === args.assetId && !item.archived)) throw new Error("资产不存在或已归档");
                data = await requiredCallback(context.generateAssetCandidate, "资产候选生成")(args as never);
                changed = true;
                break;
            }
            case "register_drama_asset_version": {
                const catalog = await context.readAssets();
                const asset = catalog.assets.find((item) => item.id === args.assetId);
                if (!asset) throw new Error("资产不存在");
                checkRevision(args.expectedRevision, asset.revision);
                const resolved = await requiredCallback(context.resolveNodeStorage, "资产版本登记")(asset.id, args.nodeId as string);
                data = await createDramaAssetVersion(token, projectId, asset.id, { storageId: resolved.storageId, note: args.note as string, expectedRevision: asset.revision });
                changed = true;
                break;
            }
            case "get_drama_binding":
                await requireClip(args.clipId, false);
                data = await getDramaBinding(token, projectId, episodeId, args.clipId as string, args.stage as string);
                break;
            case "update_drama_binding": {
                await requireClip(args.clipId, false);
                const binding = await getDramaBinding(token, projectId, episodeId, args.clipId as string, args.stage as string);
                checkRevision(args.expectedRevision, binding.revision);
                const catalog = await context.readAssets();
                for (const ref of args.references as Array<{ assetId: string; versionId: string }>) {
                    if (!catalog.assets.some((item) => item.id === ref.assetId && !item.archived) || !catalog.versions.some((item) => item.id === ref.versionId && item.assetId === ref.assetId)) throw new Error("绑定引用的资产或版本不存在");
                }
                data = await updateDramaBinding(token, projectId, episodeId, args.clipId as string, args.stage as string, args.references as never, binding.revision);
                await requiredCallback(context.applyBinding, "绑定画布同步")(data as DramaBinding, catalog);
                changed = true;
                break;
            }
            case "prepare_drama_clip_nodes": {
                const clips = await readClips();
                const selected = (args.clipIds as string[]).map((id) => clips.find((item) => item.id === id && !item.archived));
                if (selected.some((item) => !item)) throw new Error("包含不存在或已归档的 Clip");
                data = await requiredCallback(context.prepareClipNodes, "Clip 节点准备")(selected as DramaClip[]);
                changed = true;
                break;
            }
            case "repair_drama_clip_group_layout": {
                const clipIds = args.clipIds as string[];
                const active = await readClips();
                if (clipIds.some((id) => !active.some((clip) => clip.id === id && !clip.archived))) throw new Error("包含不存在或已归档的 Clip");
                data = await requiredCallback(context.repairClipGroupLayout, "Clip 分组布局恢复")(clipIds);
                changed = true;
                break;
            }
            case "update_drama_generation_node":
                await requireClip(args.clipId, false);
                if (/<(?:Picture|Video|Audio)\s+\d+>/i.test(args.prompt as string)) {
                    throw new Error("源提示词不能包含提供方媒体标签；请使用图片N、视频N、音频N画布令牌，预览和提交时会自动编译");
                }
                data = await requiredCallback(context.updateGenerationNode, "生成节点更新")(args as never);
                changed = true;
                break;
            case "get_drama_runs":
                data = args.clipId ? await listDramaRuns(token, projectId, episodeId, args.clipId as string) : await listDramaEpisodeRuns(token, projectId, episodeId);
                break;
            case "preview_drama_run": {
                await requireClip(args.clipId, false);
                const prepared = await requiredCallback(context.buildRunInput, "漫剧运行构建")(args.clipId as string, args.nodeId as string, args.requestId as string | undefined);
                data = { ...(await previewDramaRun(token, projectId, episodeId, args.clipId as string, prepared.input)), requestId: prepared.input.requestId };
                break;
            }
            case "enqueue_drama_run": {
                await requireClip(args.clipId, false);
                const prepared = await requiredCallback(context.buildRunInput, "漫剧运行构建")(args.clipId as string, args.nodeId as string, args.requestId as string);
                if (context.autoGenerateMedia) {
                    const run = await enqueueDramaRun(token, projectId, episodeId, args.clipId as string, prepared.input);
                    await requiredCallback(context.onRunEnqueued, "运行节点同步")(args.nodeId as string, run);
                    data = { submitted: true, run };
                } else {
                    data = { submitted: false, message: "运行输入已准备，Agent 自动生成未启用", snapshot: prepared.input };
                }
                changed = context.autoGenerateMedia === true;
                break;
            }
            case "cancel_drama_run":
                await requireClip(args.clipId);
                data = await cancelDramaRun(token, projectId, episodeId, args.clipId as string, args.runId as string);
                changed = true;
                break;
            case "recheck_drama_run":
                await requireClip(args.clipId);
                data = await recheckDramaRun(token, projectId, episodeId, args.clipId as string, args.runId as string);
                changed = true;
                break;
            case "get_drama_adoptions": {
                const clips = args.clipId ? [await requireClip(args.clipId)] : await readClips();
                data = (await Promise.all(clips.map((clip) => listDramaAdoptions(token, projectId, episodeId, clip.id)))).flat();
                break;
            }
            case "adopt_drama_output": {
                const clip = await requireClip(args.clipId, false);
                checkRevision(args.clipRevision, clip.revision);
                const run = (await listDramaRuns(token, projectId, episodeId, clip.id)).find((item) => item.id === args.runId);
                if (!run || run.status !== "completed") throw new Error("运行不存在或尚未成功完成");
                const output = run.outputs[args.outputIndex as number];
                if (!output?.storageId) throw new Error("输出序号不存在");
                const adoption = await adoptDramaOutput(token, projectId, episodeId, clip.id, { runId: run.id, storageId: output.storageId, expectedRevision: args.expectedRevision as number, clipRevision: clip.revision });
                const projection = await requiredCallback(context.onOutputAdopted, "采用节点同步")({ clipId: clip.id, nodeId: run.nodeId, kind: run.kind, runId: run.id, output });
                data = { adoption, projection };
                changed = true;
                break;
            }
            case "export_drama_episode":
                await downloadDramaEpisode(token, projectId, episodeId, args.partial === true);
                data = { downloaded: true, partial: args.partial === true };
                break;
        }
        checkScope();
        if (changed) context.onChanged();
        return { ok: true, data };
    } catch (error) {
        return { ok: false, code: "drama_action_failed", message: error instanceof Error ? error.message : "漫剧操作失败" };
    }
}

function clipDraft(clip: DramaClip, patch: Partial<DramaClipDraft> = {}): DramaClipDraft {
    return { title: clip.title, scene: clip.scene, summary: clip.summary, entryState: clip.entryState, exitState: clip.exitState, shots: clip.shots, archived: clip.archived, ...patch };
}

function requiredCallback<T extends (...args: never[]) => unknown>(callback: T | undefined, capability: string): T {
    if (!callback) throw new Error(capability + "不可用，请刷新正式分集画布后重试");
    return callback;
}
