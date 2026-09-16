import assert from "node:assert/strict";
import test from "node:test";
import { dramaClipDialogueSpeakers, dramaShotDialogueSpeakers } from "./drama-dialogue-speakers";

test("dialogue labels take precedence over a multi-speaker Shot label", () => {
    const shot = { speaker: "双人同镜", dialogue: "祁野：别走。\n秦素: 我不会走。\n祁野：等一等。" };
    assert.deepEqual(dramaShotDialogueSpeakers(shot), ["祁野", "秦素"]);
    assert.deepEqual(dramaClipDialogueSpeakers([shot, { speaker: "旁白", dialogue: "夜色落下。" }]), ["祁野", "秦素", "旁白"]);
});
