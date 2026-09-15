import type { CanvasAgentSkillSelection } from "../types";

export const AI_DRAMA_PRODUCTION_SKILL_ID = "agent-skill-default-ai-drama-production";
export const AI_DRAMA_PRODUCTION_SKILL_BLOCKER = "正式漫剧分集缺少必需的「AI 漫剧完整制作」Skill，请联系管理员恢复后重试";

const AI_DRAMA_PRODUCTION_SKILL: CanvasAgentSkillSelection = {
    id: AI_DRAMA_PRODUCTION_SKILL_ID,
    name: "AI 漫剧完整制作",
    source: "system",
};

export function withMandatoryDramaSkill(skills: CanvasAgentSkillSelection[], formalDramaEpisode: boolean) {
    if (!formalDramaEpisode) return skills;
    return [AI_DRAMA_PRODUCTION_SKILL, ...skills.filter((skill) => skill.id !== AI_DRAMA_PRODUCTION_SKILL_ID)];
}

export function hasMandatoryDramaSkill(skills: Array<{ id: string; enabled: boolean }>) {
    return skills.some((skill) => skill.id === AI_DRAMA_PRODUCTION_SKILL_ID && skill.enabled);
}
