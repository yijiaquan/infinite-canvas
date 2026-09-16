---
name: AI 漫剧完整制作
description: 在正式漫剧分集画布中，从立项、剧本、Clip 拆解、资产、导演故事板到视频生成和必剪交接的唯一总入口。
id: ai-drama-production
version: 9
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
