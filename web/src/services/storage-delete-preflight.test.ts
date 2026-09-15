import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { preflightDirectStorageDelete } from "./storage-delete-preflight";

describe("direct deletion preflight", () => {
    it("requires explicit authenticated allow before registered deletion", async () => {
        const calls: string[] = [];
        const request = (async (url: string | URL | Request, init?: RequestInit) => {
            calls.push(String(url));
            assert.equal((init?.headers as Record<string, string>).Authorization,"Bearer owner");
            return Response.json({ code: 0, data: true });
        }) as typeof fetch;
        await preflightDirectStorageDelete("server:media-id", "owner", request);
        assert.deepEqual(calls,["/api/v1/files/media-id/delete-preflight"]);
    });
    it("fails closed for denied, invalid, unauthenticated and unavailable checks", async () => {
        await assert.rejects(preflightDirectStorageDelete("server:id", "", (() => { throw new Error("must not call"); }) as typeof fetch));
        for (const payload of [{ code: 1, msg: "referenced" }, { code: 0, data: false }, { code: 0 }, {}]) {
            await assert.rejects(preflightDirectStorageDelete("server:id", "owner", (async () => Response.json(payload)) as typeof fetch));
        }
        await assert.rejects(preflightDirectStorageDelete("server:id", "owner", (async () => { throw new Error("offline"); }) as typeof fetch),/offline/);
        await assert.rejects(preflightDirectStorageDelete("server:id", "owner", (async () => new Response("unavailable", { status: 503 })) as typeof fetch));
    });
    it("preserves unindexed guest WebDAV behavior", async () => {
        await preflightDirectStorageDelete("server:webdav:guest-key", null, (() => { throw new Error("must not call"); }) as typeof fetch);
    });
});
