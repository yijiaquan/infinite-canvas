export async function preflightDirectStorageDelete(storageKey: string, token: string | null | undefined, request: typeof fetch = fetch): Promise<void> {
    // Guest WebDAV keys have no server index and cannot be bound to drama records.
    if (storageKey.startsWith("server:webdav:")) return;
    if (!storageKey.startsWith("server:") || !token) throw new Error("请登录后检查媒体引用再删除");
    const id = storageKey.slice("server:".length);
    if (!id) throw new Error("媒体标识无效");
    const response = await request(`/api/v1/files/${encodeURIComponent(id)}/delete-preflight`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const payload = await response.json().catch(() => null) as { code?: number; data?: boolean; msg?: string } | null;
    if (!response.ok || payload?.code !== 0 || payload.data !== true) throw new Error(payload?.msg || "无法确认媒体是否可删除，已保留原文件");
}
