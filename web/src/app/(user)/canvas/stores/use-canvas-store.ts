import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

import { nanoid } from "nanoid";
import { localForageStorage } from "@/lib/localforage-storage";
import { listCanvasProjects, saveCanvasProject, syncCanvasProjects } from "@/services/api/canvas-tasks";
import { fetchUserConfig } from "@/services/api/user-config";
import { useUserStore } from "@/stores/use-user-store";
import type { CanvasBackgroundMode } from "@/lib/canvas-theme";
import type { CanvasAgentConfig, CanvasAssistantSession, CanvasConnection, CanvasNodeData, CanvasPendingAgentRequest, ViewportTransform } from "../types";

export type CanvasSidePanelState = {
    open: boolean;
    width: number;
};

export const DEFAULT_CANVAS_SIDE_PANEL: CanvasSidePanelState = { open: true, width: 280 };
export const DEFAULT_CANVAS_AGENT_PANEL: CanvasSidePanelState = { open: false, width: 464 };

export type CanvasProject = {
    id: string;
    dramaProjectId?: string;
    dramaEpisodeId?: string;
    dramaRevision?: number;
    dramaPreparedClipIds?: string[];
    title: string;
    createdAt: string;
    updatedAt: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    agentConfig: CanvasAgentConfig | null;
    autoTitlePending: boolean;
    pendingAgentRequest?: CanvasPendingAgentRequest;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
    viewport: ViewportTransform;
    sidePanel: CanvasSidePanelState;
    agentPanel: CanvasSidePanelState;
};

type CanvasStore = {
    saveErrors: Record<string, string>;
    savingIds: string[];
    hydrated: boolean;
    projects: CanvasProject[];
    createProject: (title?: string, options?: { agentConfig?: CanvasAgentConfig; pendingAgentRequest?: CanvasPendingAgentRequest }) => string;
    importProject: (project: Partial<CanvasProject>) => string;
    openProject: (id: string) => CanvasProject | null;
    renameProject: (id: string, title: string) => void;
    deleteProjects: (ids: string[]) => void;
    updateProject: (id: string, patch: Partial<Pick<CanvasProject, "nodes" | "connections" | "chatSessions" | "activeChatId" | "agentConfig" | "autoTitlePending" | "backgroundMode" | "showImageInfo" | "viewport" | "sidePanel" | "agentPanel" | "pendingAgentRequest" | "dramaPreparedClipIds">>) => void;
    syncWithRemote: (token: string, syncEnabled: boolean) => Promise<void>;
    setSyncEnabled: (enabled: boolean) => void;
};

const initialViewport: ViewportTransform = { x: 0, y: 0, k: 1 };
const CANVAS_STORE_KEY = "infinite-canvas:canvas_store";
type PersistedCanvasState = Pick<CanvasStore, "projects">;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let queuedPersistState: PersistedCanvasState | null = null;
let accountCanvasSyncEnabled = false;
const projectSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const dramaSaveRequests = new Map<string, Promise<void>>();

export function flushDramaCanvasSave(id: string): Promise<void> {
    const existing = dramaSaveRequests.get(id);
    if (existing) return existing;
    const token = useUserStore.getState().token;
    const request = (async () => {
        useCanvasStore.setState((state) => ({ savingIds: [...new Set([...state.savingIds, id])] }));
        try {
            while (token && useUserStore.getState().token === token) {
                const submitted = useCanvasStore.getState().projects.find((item) => item.id === id);
                if (!submitted?.dramaProjectId) return;
                const saved = await saveCanvasProject(token, submitted);
                if (useUserStore.getState().token !== token) return;
                let changed = false;
                useCanvasStore.setState((state) => {
                    const current = state.projects.find((item) => item.id === id);
                    if (!current) return {};
                    changed = current !== submitted;
                    const saveErrors = { ...state.saveErrors }; delete saveErrors[id];
                    // Advance only the acknowledged version, never replace edits made during this request.
                    return { saveErrors, projects: state.projects.map((item) => item.id === id ? { ...item, dramaRevision: saved.dramaRevision } : item) };
                });
                if (!changed) return;
            }
        } catch (cause) {
            if (useUserStore.getState().token === token) useCanvasStore.setState((state) => ({ saveErrors: { ...state.saveErrors, [id]: cause instanceof Error ? cause.message : "画布保存失败，本地修改已保留" } }));
            throw cause;
        } finally {
            if (useUserStore.getState().token === token) useCanvasStore.setState((state) => ({ savingIds: state.savingIds.filter((item) => item !== id) }));
        }
    })();
    dramaSaveRequests.set(id, request);
    void request.finally(() => { if (dramaSaveRequests.get(id) === request) dramaSaveRequests.delete(id); }).catch(() => undefined);
    return request;
}

function waitForUserStoreHydration() {
    if (useUserStore.persist.hasHydrated()) return Promise.resolve();

    return new Promise<void>((resolve) => {
        let unsubscribe = () => { };
        unsubscribe = useUserStore.persist.onFinishHydration(() => {
            unsubscribe();
            resolve();
        });
        if (useUserStore.persist.hasHydrated()) {
            unsubscribe();
            resolve();
        }
    });
}

function queueProjectSave(project: CanvasProject) {
    const token = useUserStore.getState().token;
    const syncEnabled = accountCanvasSyncEnabled || !!project.dramaProjectId;
    const previous = projectSaveTimers.get(project.id);
    if (previous) clearTimeout(previous);

    projectSaveTimers.set(
        project.id,
        setTimeout(() => {
            projectSaveTimers.delete(project.id);
            if (
                !token ||
                !syncEnabled ||
                (!accountCanvasSyncEnabled && !project.dramaProjectId) ||
                useUserStore.getState().token !== token
            ) {
                return;
            }
            if (project.dramaProjectId) void flushDramaCanvasSave(project.id).catch(() => undefined);
            else void saveCanvasProject(token, project).catch(() => undefined);
        }, 400),
    );
}

function cancelProjectSaves(ids: string[]) {
    ids.forEach((id) => {
        const timer = projectSaveTimers.get(id);
        if (!timer) return;
        clearTimeout(timer);
        projectSaveTimers.delete(id);
    });
}

export async function loadDramaCanvasServerVersion(id: string) {
    const token = useUserStore.getState().token;
    cancelProjectSaves([id]);
    await dramaSaveRequests.get(id)?.catch(() => undefined);
    const remote = (await listCanvasProjects(token)).find((project) => project.id === id && project.dramaProjectId);
    if (useUserStore.getState().token !== token) throw new Error("登录状态已变化");
    if (!remote) throw new Error("分集画布不存在");
    return remote;
}

async function reconcileCanvasProjects(
    token: string,
    remoteProjects: CanvasProject[],
    localProjects: CanvasProject[],
) {
    const remoteById = new Map(
        remoteProjects.map((project) => [project.id, project]),
    );
    localProjects = localProjects.filter((project) => !project.dramaProjectId || remoteById.has(project.id));
    const missingProjects = localProjects.filter(
        (project) => !remoteById.has(project.id),
    );
    const existingLocalProjects = localProjects.filter((project) =>
        remoteById.has(project.id),
    );
    const projects = missingProjects.length
        ? await syncCanvasProjects(token, missingProjects)
            .then((syncedProjects) =>
                mergeCanvasProjects(
                    syncedProjects,
                    existingLocalProjects,
                ),
            )
            .catch(() =>
                mergeCanvasProjects(remoteProjects, localProjects),
            )
        : mergeCanvasProjects(remoteProjects, existingLocalProjects);

    if (useUserStore.getState().token !== token) return useCanvasStore.getState().projects;
    localProjects.forEach((project) => {
        const remote = remoteById.get(project.id);
        if (
            remote &&
            Date.parse(project.updatedAt || "") >
            Date.parse(remote.updatedAt || "")
        ) {
            queueProjectSave(project);
        }
    });

    return projects;
}

const canvasStorage: PersistStorage<CanvasStore> = {
    getItem: async (name) => {
        await waitForUserStoreHydration();
        const localValue = await localForageStorage.getItem(name);
        const token = useUserStore.getState().token;
        const localParsed = localValue
            ? (JSON.parse(localValue) as StorageValue<CanvasStore>)
            : null;
        const localProjects =
            (localParsed?.state as PersistedCanvasState)?.projects || [];
        const localHasData =
            Array.isArray(localProjects) && localProjects.length > 0;

        if (token) {
            try {
                const [userConfig, remoteProjects] = await Promise.all([
                    fetchUserConfig(token),
                    listCanvasProjects(token),
                ]);
                if (useUserStore.getState().token !== token) throw new Error("登录账号已变化");
                accountCanvasSyncEnabled =
                    userConfig.syncCapabilities?.userData === true;

                if (accountCanvasSyncEnabled && localHasData) {
                    const projects = await reconcileCanvasProjects(
                        token,
                        remoteProjects,
                        localProjects,
                    );

                    const nextState = { projects };
                    const parsed = {
                        state: nextState,
                        version: 0,
                    } as StorageValue<CanvasStore>;
                    queuedPersistState = nextState;
                    await localForageStorage.setItem(
                        name,
                        JSON.stringify(parsed),
                    );
                    return parsed;
                }

                if (
                    remoteProjects.length > 0 &&
                    (accountCanvasSyncEnabled || !localHasData)
                ) {
                    const nextState = { projects: remoteProjects };
                    const parsed = {
                        state: nextState,
                        version: 0,
                    } as StorageValue<CanvasStore>;
                    queuedPersistState = nextState;
                    await localForageStorage.setItem(
                        name,
                        JSON.stringify(parsed),
                    );
                    return parsed;
                }

                // 分集画布属于登录账号，不受普通画布同步开关影响。
                const dramaProjects = remoteProjects.filter((project) => project.dramaProjectId);
                const remoteDramaIds = new Set(dramaProjects.map((project) => project.id));
                const allowedLocal = localProjects.filter((project) => !project.dramaProjectId || remoteDramaIds.has(project.id));
                const nextState = { projects: mergeCanvasProjects(dramaProjects, allowedLocal) };
                queuedPersistState = nextState;
                return { state: nextState, version: 0 } as StorageValue<CanvasStore>;
            } catch (error) {
                console.error(
                    "Failed to hydrate canvas projects from remote",
                    error,
                );
            }
        }

        if (!localParsed) return null;
        localParsed.state.projects = localParsed.state.projects.filter((project) => !project.dramaProjectId);
        queuedPersistState = localParsed.state as PersistedCanvasState;
        return localParsed;
    },

    setItem: (name, value) => {
        const nextState = value.state as PersistedCanvasState;
        if (
            queuedPersistState &&
            queuedPersistState.projects === nextState.projects
        ) {
            return;
        }
        queuedPersistState = nextState;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = null;
            void localForageStorage.setItem(name, JSON.stringify(value));
        }, 400);
    },
    removeItem: (name) => localForageStorage.removeItem(name),
};

export const useCanvasStore = create<CanvasStore>()(
    persist(
        (set, get) => ({
            saveErrors: {},
            savingIds: [],
            hydrated: false,
            projects: [],
            createProject: (title = "未命名画布", options) => {
                const now = new Date().toISOString();
                const id = nanoid();
                const project: CanvasProject = {
                    id,
                    title,
                    createdAt: now,
                    updatedAt: now,
                    nodes: [],
                    connections: [],
                    chatSessions: [],
                    activeChatId: null,
                    agentConfig: options?.agentConfig || null,
                    autoTitlePending: true,
                    pendingAgentRequest: options?.pendingAgentRequest,
                    backgroundMode: "lines",
                    showImageInfo: false,
                    viewport: initialViewport,
                    sidePanel: DEFAULT_CANVAS_SIDE_PANEL,
                    agentPanel: options?.pendingAgentRequest ? { ...DEFAULT_CANVAS_AGENT_PANEL, open: true } : DEFAULT_CANVAS_AGENT_PANEL,
                };
                set((state) => ({
                    projects: [project, ...state.projects],
                }));
                queueProjectSave(project);
                return id;
            },
            importProject: (source) => {
                const now = new Date().toISOString();
                const project: CanvasProject = {
                    id: nanoid(),
                    title: source.title || "导入画布",
                    createdAt: source.createdAt || now,
                    updatedAt: now,
                    nodes: source.nodes || [],
                    connections: source.connections || [],
                    chatSessions: (source.chatSessions || []).map((session) => ({ ...session, codexThreadId: undefined, codexServiceId: undefined })),
                    activeChatId: source.activeChatId || null,
                    agentConfig: source.agentConfig || null,
                    autoTitlePending: false,
                    backgroundMode: source.backgroundMode || "lines",
                    showImageInfo: source.showImageInfo || false,
                    viewport: source.viewport || initialViewport,
                    sidePanel: source.sidePanel || DEFAULT_CANVAS_SIDE_PANEL,
                    agentPanel: source.agentPanel || DEFAULT_CANVAS_AGENT_PANEL,
                };
                set((state) => ({
                    projects: [project, ...state.projects],
                }));
                queueProjectSave(project);
                return project.id;
            },
            openProject: (id) =>
                get().projects.find((item) => item.id === id) || null,
            renameProject: (id, title) => {
                const project = get().projects.find(
                    (item) => item.id === id,
                );
                if (!project) return;
                const nextProject = {
                    ...project,
                    title: title.trim() || project.title,
                    autoTitlePending: false,
                    updatedAt: new Date().toISOString(),
                };
                set((state) => ({
                    projects: state.projects.map((item) =>
                        item.id === id ? nextProject : item,
                    ),
                }));
                queueProjectSave(nextProject);
            },
            deleteProjects: (ids) => {
                cancelProjectSaves(ids);
                set((state) => ({
                    projects: state.projects.filter(
                        (project) => !ids.includes(project.id),
                    ),
                }));
            },
            updateProject: (id, patch) => {
                const project = get().projects.find(
                    (item) => item.id === id,
                );
                if (!project) return;
                const nextProject = {
                    ...project,
                    ...patch,
                    updatedAt: new Date().toISOString(),
                };
                set((state) => ({
                    projects: state.projects.map((item) =>
                        item.id === id ? nextProject : item,
                    ),
                }));
                queueProjectSave(nextProject);
            },
            syncWithRemote: async (token, syncEnabled) => {
                accountCanvasSyncEnabled = syncEnabled;
                if (!token) return;
                const remoteProjects = await listCanvasProjects(token).catch(
                    () => null,
                );
                if (!remoteProjects || useUserStore.getState().token !== token) return;
                const localProjects = get().projects;
                const remoteDrama = remoteProjects.filter((project) => project.dramaProjectId);
                const dramaIds = new Set(remoteDrama.map((project) => project.id));
                const projects = syncEnabled ? await reconcileCanvasProjects(
                    token,
                    remoteProjects,
                    localProjects,
                ) : mergeCanvasProjects(remoteDrama, localProjects.filter((project) => !project.dramaProjectId || dramaIds.has(project.id)));
                if (useUserStore.getState().token !== token) return;
                if (saveTimer) {
                    clearTimeout(saveTimer);
                    saveTimer = null;
                }
                const latest = get().projects;
                const original = new Map(localProjects.map((project) => [project.id, project]));
                const changed = latest.filter((project) => original.get(project.id) !== project);
                const removed = new Set(localProjects.filter((project) => !latest.some((item) => item.id === project.id)).map((project) => project.id));
                const changedIds = new Set(changed.map((project) => project.id));
                const nextState = { projects: [...changed, ...projects.filter((project) => !changedIds.has(project.id) && !removed.has(project.id))] };
                queuedPersistState = nextState;
                set(nextState);
                await localForageStorage.setItem(
                    CANVAS_STORE_KEY,
                    JSON.stringify({ state: nextState, version: 0 }),
                );
            },
            setSyncEnabled: (enabled) => {
                accountCanvasSyncEnabled = enabled;
            },
        }),
        {
            name: CANVAS_STORE_KEY,
            storage: canvasStorage,
            partialize: (state) =>
                ({
                    projects: state.projects,
                }) as StorageValue<CanvasStore>["state"],
            onRehydrateStorage: () => () => {
                useCanvasStore.setState({ hydrated: true });
            },
        },
    ),
);

// 切换登录会话后立即移除上一账号的分集画布。
useUserStore.subscribe((state, previous) => {
    if (state.token === previous.token) return;
    const projects = useCanvasStore.getState().projects;
    const dramaProjects = projects.filter((project) => project.dramaProjectId);
    cancelProjectSaves(dramaProjects.map((project) => project.id));
    accountCanvasSyncEnabled = false;
    dramaSaveRequests.clear();
    useCanvasStore.setState({ saveErrors: {}, savingIds: [] });
    if (dramaProjects.length) useCanvasStore.setState({ projects: projects.filter((project) => !project.dramaProjectId) });
});

export function mergeCanvasProjects(
    remoteProjects: CanvasProject[],
    localProjects: CanvasProject[],
): CanvasProject[] {
    const projects = new Map<string, CanvasProject>();
    [...localProjects, ...remoteProjects].forEach((project) => {
        const previous = projects.get(project.id);
        // Do not rebase a locally open drama snapshot onto another editor's revision.
        if (previous?.dramaProjectId && project.dramaProjectId && previous.dramaRevision !== project.dramaRevision) return;
        if (
            !previous ||
            Date.parse(project.updatedAt || "") >=
            Date.parse(previous.updatedAt || "")
        ) {
            projects.set(project.id, project);
        }
    });
    return Array.from(projects.values()).sort(
        (a, b) =>
            Date.parse(b.updatedAt || "") -
            Date.parse(a.updatedAt || ""),
    );
}
