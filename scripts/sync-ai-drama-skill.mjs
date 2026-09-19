import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";

const sourceSkills = [
    "ai-drama-studio-workflow",
    "ai-story-architecture",
    "ai-drama-series-production",
    "ai-drama-story-writing",
    "novel-to-ai-drama-adaptation",
    "ai-drama-visual-assets",
    "scene-multiview-consistency",
    "blender-whitebox-previs",
    "ai-media-prompt-compiler",
    "h3-prompt-writing",
    "minimax-h3-video-production",
    "ai-drama-audio-post-production",
    "short-video-production",
];
const legacyFiles = new Set([
    "ai-drama-studio-workflow/references/workbench-production-flow.md",
    "ai-drama-series-production/assets/templates/00-workflow-status.md",
    "ai-drama-series-production/references/aidrama-workbench-production-route.md",
    "ai-drama-series-production/references/project-asset-layout.md",
    "short-video-production/assets/templates/04-storyboard-asset-manifest.md",
]);

const options = parseArgs(process.argv.slice(2));
const sourceRoot = resolve(options.source || "D:/work/剪映/.agents/skills");
const outputRoot = resolve(options.output || "service/skills/ai-drama-production");
const version = Number(options.version || 13);
if (!Number.isInteger(version) || version < 1) throw new Error("version must be a positive integer");
if (basename(outputRoot) !== "ai-drama-production" || basename(dirname(outputRoot)) !== "skills") {
    throw new Error("output must be a skills/ai-drama-production directory");
}

const files = [];
const contents = new Map();
for (const skill of sourceSkills) {
    const skillRoot = join(sourceRoot, skill);
    if (!existsSync(join(skillRoot, "SKILL.md"))) throw new Error(`missing canonical Skill: ${skill}`);
    for (const sourceFile of await listTextFiles(skillRoot)) {
        const relativeSource = relative(skillRoot, sourceFile).split(sep).join("/");
        if (legacyFiles.has(`${skill}/${relativeSource}`)) continue;
        const content = normalize(await readFile(sourceFile, "utf8"));
        const output = `references/${skill}/${relativeSource}`;
        contents.set(output, content);
        files.push({
            source: `.agents/skills/${skill}/${relativeSource}`,
            output,
            sha256: createHash("sha256").update(content).digest("hex"),
        });
    }
}
files.sort((left, right) => left.output.localeCompare(right.output, "en"));
const rootContent = buildRoot(version);
const manifestContent = `${JSON.stringify({ package: "ai-drama-production", version, files }, null, 2)}\n`;
if (options.check) {
    await assertContent(join(outputRoot, "SKILL.md"), rootContent);
    await assertContent(join(outputRoot, "SOURCE-MANIFEST.txt"), manifestContent);
    for (const [output, content] of contents) await assertContent(join(outputRoot, output), content);
    process.stdout.write(`verified AI drama Skill v${version} with ${files.length} source files\n`);
} else {
    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(join(outputRoot, "references"), { recursive: true });
    for (const [output, content] of contents) {
        await mkdir(dirname(join(outputRoot, output)), { recursive: true });
        await writeFile(join(outputRoot, output), content, "utf8");
    }
    await writeFile(join(outputRoot, "SKILL.md"), rootContent, "utf8");
    await writeFile(join(outputRoot, "SOURCE-MANIFEST.txt"), manifestContent, "utf8");
    process.stdout.write(`generated AI drama Skill v${version} with ${files.length} source files\n`);
}

async function listTextFiles(root) {
    const result = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
        const file = join(root, entry.name);
        if (entry.isDirectory()) result.push(...await listTextFiles(file));
        else if ([".md", ".markdown", ".txt"].includes(extname(entry.name).toLowerCase())) result.push(file);
    }
    return result.sort((left, right) => left.localeCompare(right, "en"));
}

function normalize(value) {
    return `${value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/\n+$/g, "")}\n`;
}

function parseArgs(args) {
    const result = {};
    for (let index = 0; index < args.length;) {
        const key = args[index]?.replace(/^--?/, "");
        if (key === "check") {
            result.check = true;
            index += 1;
            continue;
        }
        if (!key || args[index + 1] === undefined) throw new Error(`invalid argument: ${args[index] || ""}`);
        result[key] = args[index + 1];
        index += 2;
    }
    return result;
}

async function assertContent(file, expected) {
    const actual = await readFile(file, "utf8").catch(() => "");
    if (actual !== expected) throw new Error(`generated package is stale: ${relative(process.cwd(), file)}`);
}

function buildRoot(packageVersion) {
    return `---
name: AI 漫剧完整制作
description: 在正式漫剧分集画布中，从立项、剧本、Clip 拆解、资产、导演故事板到视频生成和必剪交接的唯一总入口。
id: ai-drama-production
version: ${packageVersion}
---

# AI 漫剧完整制作

本 Skill 仅在已关联 dramaProjectId 和 dramaEpisodeId 的正式分集画布中使用。Infinite Canvas 数据库是剧本、Clip、Shot、资产版本、绑定、生成草稿、运行和采用结果的唯一生产真相；ComfyUI 只是媒体执行引擎，必剪负责最终剪辑和声音后期。

## 必须执行

1. 先调用 get_canvas_summary，确认当前项目、分集和画布关联；缺失关联或漫剧工具时报告基础设施阻塞，不转回本地文档或任何旧生产入口续做。
2. 依当前阶段读取下方对应的专业 Skill，只加载本轮所需文件。
3. 正式 Clip 故事板和视频一律走 drama 专用节点、绑定、运行和采用工具；不得使用通用 generate_image/generate_video 绕过生产记录。
4. 编辑状态只保存结构化引用，不写旧式文本引用或手写供应商标签；只由提交编译层按真实输入顺序生成供应商标签。
5. 绑定的资产版本是权威记录，节点与连线是可视投影。同一版本在同一 Clip 共享一个参考节点。
6. 提交后草稿修改不改变已入队快照；只有未开始任务取消可退费。不确定的任务先检查运行和队列，不重复提交。
7. Voice 样本是普通音频资产，仅绑定真实 Speaker。处理已完成视频的声音时，先调用 create_audio_excerpt 从真实媒体分离完整 WAV，再从该 audio 节点裁剪或调用 find_voice_excerpt 定位候选；不得用 videoSupportsAudio/videoGenerateAudio 推断成品是否有音轨。试听确认后的当前画布 WAV 可直接用 register_drama_asset_version 登记到既有 voice 资产（无需由该资产生成），再设置 defaultVoiceVersionId 并按实际 speaker 绑定。双人或多人同镜按逐行“角色：台词”标签识别全部实际 Speaker，可在一个 Shot 中绑定多个 Voice；不能为此拆 Shot。不得重新生成音频替代该 WAV。视频后的对白修补、环境音、拟音、BGM、混音和字幕校准交给必剪。
8. 故事板图片及其静态图片提示词不得包含角色对话信息：不写台词正文、发言者标签、对白引用 ID、旁白/内心独白文本、字幕或对话气泡。精确对白只保留在剧本/Shot 结构及后续视频、音频提示中；故事板只承接由其产生的可见表演、镜头节拍与非对白声音事实。
9. 进入视频阶段必须实际读取当前 ai-media-prompt-compiler 与 minimax-h3-video-production，不能只凭本总入口、导演板文字、旧 Prompt 或记忆执行。导演板可显示 Shot 的开始–结束范围，但 H3 最终 Prompt 必须重新编译：\`[Shot 1]\` 无时间戳，后续 \`[Shot N] At MM:SS.mmm,\` 只写由前序 Shot 时长累计得到的单一切入时刻，禁止复制开始–结束范围。
10. 所有视觉板都只按当前 Skill 声明的控制域传递语义，不能按板面观感或旧 Prompt 扩写：身份板只管身份/比例/固定 Look/服饰，道具板只管形制/材质/结构/机关/当前状态，表情板只管选定单一状态的可见反应，导演板只管 Shot 顺序/构图/调度/动作阶段/空间锚点/Look/可见表演。白底、中性姿态、展示角度、宫格与其他状态，以及页面、编号、时间文字、表格、缩略图、边框、箭头、标签和对白信息都不得泄漏到下游画面或最终视频。
11. 每次收到新的用户消息都先执行 Skill 路由，再回复、提问或操作：结合本轮请求、当前 Canvas 阶段、所选对象和 current 状态，选择最小必要专业 Skill，并在第一次实质操作前调用 read_skill_file 读取其当前 SKILL.md；不能凭上一轮、Skill 名称、旧对话或记忆继续。任务跨阶段时按生产顺序到达对应阶段再读取，不一次加载全部 Skills。纯问候、确认、停止/取消或只报告既有工具结果由本入口直接处理，不为形式读取无关 Skill。
12. 视频同步对白默认只在实际 Speaker 已在当前 Shot 清楚可见时开始；若画面只覆盖听者、其他角色或空景，必须先切到/跟到说话者、重构焦点或让其入画，再写该 Speaker 的精确台词，不能让画内人物代说画外角色台词。明确的画外对白使用官方句式 \`[Speaker] (Sx) says in an off-screen voiceover: <d>[Language]...</d> while the corresponding on-screen character's lips remain completely closed.\`，并写清声源方位/距离/设备与听者反应。
13. Ref2VA 的完整导演故事板必须作为普通 \`<Picture 1>\` 输入，当前完整场景板作为后续普通 Picture 输入；导演板控制 Shot 规划，场景板控制拓扑、固定锚点、材质、主光和多方向关系。两者都不得进入 \`picture_1_keyframe\`，板式、网格、文字和参考页本身不得渲染进成片。\`picture_1_keyframe\` 继续断开，除非主人明确选择 I2VA 或 FL2VA 端点模式。
14. H3 Prompt 语法和模型能力以 references/h3-prompt-writing/SKILL.md 及其官方模式指南为准；Infinite Canvas 当前 UI JSON/服务端 schema 决定可执行输入。官方支持但当前 Canvas 未暴露的模式或槽位不得猜测接线，本地生产 Skill 只能补结构化绑定、制作语义、提交与媒体 QA。

## 逐轮路由矩阵

先确定 current 最早未完成阶段并选择一个主责 Skill，再按真实条件附加辅助 Skill；不得只按关键词同时加载所有命中项。

- 完整项目、继续制作、跨阶段、恢复或职责漂移：先读 references/ai-drama-studio-workflow/SKILL.md，再读当前阶段主责 Skill。
- 原创故事确需建立或修复结构：references/ai-story-architecture/SKILL.md；已有 accepted script 没有真实故事问题时跳过。
- 原创分集故事、材料叙事改写或制作剧本：references/ai-drama-story-writing/SKILL.md。
- 已完成且权利路线明确的小说改编：references/novel-to-ai-drama-adaptation/SKILL.md；不得与原创剧本 Skill 重复写同一剧本。
- 系列 Bible、分集规划、跨集连续性或 Clip/Shot 制作拆解：references/ai-drama-series-production/SKILL.md；它协调并验证 accepted script，不负责创作剧本。
- 身份板、表情板、场景板、道具板、色板、导演故事板及视觉修复：主责 references/ai-drama-visual-assets/SKILL.md，配套读取 references/ai-media-prompt-compiler/SKILL.md 的对应方法。
- 从 current 同场资产派生新视角：附加 references/scene-multiview-consistency/SKILL.md；采用与 QA 仍归 Visual Skill。
- 主人明确选择白模或直接要求 Blender：附加 references/blender-whitebox-previs/SKILL.md；它不是默认阶段。
- MiniMax H3 模式、绑定、正式 Prompt、提交、返修和视频 QA：先读官方 references/h3-prompt-writing/SKILL.md 及所选模式指南，再读主责 references/minimax-h3-video-production/SKILL.md，并配套读取 references/ai-media-prompt-compiler/SKILL.md；仅在存在实际 Speaker、Voice、原生对白或唇同步输入时附加 references/ai-drama-audio-post-production/SKILL.md。
- 视频后的对白修复、环境音、拟音、SFX、音乐、字幕、混音或 Bcut 音轨：references/ai-drama-audio-post-production/SKILL.md。
- 必剪、整片审查、导出或交付：references/short-video-production/SKILL.md；它不与总编排争夺其他漫剧阶段。

SOURCE-MANIFEST.txt 是生成清单，用于校验本包与规范源的 SHA256，不是生产输入。
`;
}
