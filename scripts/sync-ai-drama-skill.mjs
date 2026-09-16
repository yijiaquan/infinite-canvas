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
const version = Number(options.version || 9);
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

## 按阶段读取

- 总编排：references/ai-drama-studio-workflow/SKILL.md
- 故事架构：references/ai-story-architecture/SKILL.md
- 系列与 Clip/Shot：references/ai-drama-series-production/SKILL.md
- 原创剧本：references/ai-drama-story-writing/SKILL.md
- 小说改编：references/novel-to-ai-drama-adaptation/SKILL.md
- 资产与导演故事板：references/ai-drama-visual-assets/SKILL.md
- 同场景新视角：references/scene-multiview-consistency/SKILL.md
- 可选白盒预演：references/blender-whitebox-previs/SKILL.md
- 提示词语义编译：references/ai-media-prompt-compiler/SKILL.md
- MiniMax H3 视频：references/minimax-h3-video-production/SKILL.md
- 声音后期：references/ai-drama-audio-post-production/SKILL.md
- 必剪交接与成片：references/short-video-production/SKILL.md

SOURCE-MANIFEST.txt 是生成清单，用于校验本包与规范源的 SHA256，不是生产输入。
`;
}
