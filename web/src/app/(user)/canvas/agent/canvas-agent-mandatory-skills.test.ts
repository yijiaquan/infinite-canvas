import assert from "node:assert/strict";
import test from "node:test";

const modulePath = "./canvas-agent-mandatory-skills.ts";
const { AI_DRAMA_PRODUCTION_SKILL_ID, hasMandatoryDramaSkill, withMandatoryDramaSkill } = await import(modulePath);

test("formal drama episodes receive the mandatory skill without changing user selections", () => {
    const selected = Array.from({ length: 5 }, (_, index) => ({ id: `user-${index}`, name: `Skill ${index}`, source: "user" as const }));
    const result = withMandatoryDramaSkill(selected, true);
    assert.equal(result.length, 6);
    assert.equal(result[0].id, AI_DRAMA_PRODUCTION_SKILL_ID);
    assert.deepEqual(result.slice(1), selected);
});

test("mandatory skill availability requires the enabled managed package", () => {
    assert.equal(hasMandatoryDramaSkill([{ id: AI_DRAMA_PRODUCTION_SKILL_ID, enabled: true }]), true);
    assert.equal(hasMandatoryDramaSkill([{ id: AI_DRAMA_PRODUCTION_SKILL_ID, enabled: false }]), false);
    assert.equal(hasMandatoryDramaSkill([{ id: "other", enabled: true }]), false);
});

test("mandatory skill is idempotent and ordinary canvases are unchanged", () => {
    const mandatory = { id: AI_DRAMA_PRODUCTION_SKILL_ID, name: "old label", source: "system" as const };
    assert.deepEqual(withMandatoryDramaSkill([mandatory], true), [{ ...mandatory, name: "AI 漫剧完整制作" }]);
    assert.deepEqual(withMandatoryDramaSkill([mandatory], false), [mandatory]);
});
