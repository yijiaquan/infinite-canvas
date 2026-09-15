import assert from "node:assert/strict";
import test from "node:test";

import { SessionRegistry } from "./session-registry.mjs";

const session = (clientId, canvasId) => ({ clientId, canvasId, origin: "http://127.0.0.1:3000", events: {}, toolsPending: new Map() });

test("uses the last explicitly activated connected canvas", () => {
    const sessions = new Map([["a", session("a", "canvas-a")], ["b", session("b", "canvas-b")]]);
    const registry = new SessionRegistry(sessions, { now: () => 2_000 });
    assert.throws(() => registry.find(""), /多个画布/);
    assert.equal(registry.activate({ clientId: "b", canvasId: "canvas-b", origin: "http://127.0.0.1:3000", sequence: 1, observedAt: 1_900 }), true);
    assert.equal(registry.find("").clientId, "b");
});

test("late activation cannot steal focus from a newer browser observation", () => {
    const sessions = new Map([["a", session("a", "canvas-a")], ["b", session("b", "canvas-b")]]);
    const registry = new SessionRegistry(sessions, { now: () => 2_000 });
    registry.activate({ clientId: "b", canvasId: "canvas-b", origin: "http://127.0.0.1:3000", sequence: 1, observedAt: 1_950 });
    assert.equal(registry.activate({ clientId: "a", canvasId: "canvas-a", origin: "http://127.0.0.1:3000", sequence: 1, observedAt: 1_900 }), false);
    assert.equal(registry.find("").clientId, "b");
});

test("closing the active canvas keeps the unique-session fallback", () => {
    const a = session("a", "canvas-a");
    const b = session("b", "canvas-b");
    const sessions = new Map([["a", a], ["b", b]]);
    const registry = new SessionRegistry(sessions, { now: () => 2_000 });
    registry.activate({ clientId: "b", canvasId: "canvas-b", origin: "http://127.0.0.1:3000", sequence: 1, observedAt: 1_900 });
    registry.close(b);
    sessions.delete("b");
    assert.equal(registry.find("").clientId, "a");
});

test("rejects mismatched canvas, origin and stale sequence", () => {
    const a = session("a", "canvas-a");
    const registry = new SessionRegistry(new Map([["a", a]]), { now: () => 2_000 });
    assert.throws(() => registry.activate({ clientId: "a", canvasId: "wrong", origin: a.origin, sequence: 1, observedAt: 1_900 }), /不匹配/);
    assert.throws(() => registry.activate({ clientId: "a", canvasId: "canvas-a", origin: "http://wrong", sequence: 1, observedAt: 1_900 }), /来源/);
    assert.equal(registry.activate({ clientId: "a", canvasId: "canvas-a", origin: a.origin, sequence: 1, observedAt: 1_900 }), true);
    assert.equal(registry.activate({ clientId: "a", canvasId: "canvas-a", origin: a.origin, sequence: 1, observedAt: 1_950 }), true);
});
