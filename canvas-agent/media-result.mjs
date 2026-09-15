export function formatCanvasToolResult(result) {
    const media = result?._mcpMedia;
    if (!media || typeof media !== "object") {
        return { isError: result?.ok === false, content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    const metadata = { ...result };
    delete metadata._mcpMedia;
    const content = [{ type: "text", text: JSON.stringify(metadata) }];
    if (typeof media.data === "string" && typeof media.mimeType === "string") {
        if (media.kind === "image") content.push({ type: "image", data: media.data, mimeType: media.mimeType });
        else if (media.kind === "audio") content.push({ type: "audio", data: media.data, mimeType: media.mimeType });
        else if (media.kind === "video") content.push({ type: "resource", resource: { uri: media.uri, mimeType: media.mimeType, blob: media.data } });
    } else if (typeof media.uri === "string") {
        content.push({ type: "resource_link", uri: media.uri, name: media.name || "canvas-media", mimeType: media.mimeType });
    }
    return { isError: result?.ok === false, content };
}
