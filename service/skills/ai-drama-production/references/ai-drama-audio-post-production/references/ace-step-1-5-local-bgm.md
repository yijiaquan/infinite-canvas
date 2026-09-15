# ACE-Step 1.5 Local BGM

只在成片确实需要原创配乐时使用。`BGM=none`、有商业授权的音乐或原创录音都可以，不因模型已安装而自动生成。

## Current Local Route

- Workflow：`D:/Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/user/default/workflows/本地背景音乐_ACE-Step1.5_3070Ti-8GB_v01.json`
- Model：`D:/Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/models/checkpoints/ace_step_1.5_turbo_aio.safetensors`
- Output：48 kHz stereo FLAC
- Use through `本地背景音乐_ACE-Step1.5_3070Ti-8GB_v01.json` and keep the result on a separate editable `MUS` track in Bcut.

模型、节点或工作流发生变化时重新核对本机配置。普通生成直接生成、试听并采用可用结果。

## Prompt

按以下顺序写：

1. 叙事功能和使用场景；
2. 情绪与强度曲线；
3. 乐器、音色和层次；
4. 节奏、BPM、调性（确实需要时）；
5. 对白优先和低存在感要求；
6. 精确时长；
7. `underscore_segment` 结尾淡出或 `seamless_loop` 循环；
8. 当前真实风险限制。

无歌词配乐明确写 `instrumental, no vocals, no spoken words`。不要写艺术家名、歌名、影视主题或要求模仿可识别旋律。不要把 Voice、对白、H3 音色参考或别人的音乐喂给当前 text-to-music 路线。

## Production Use

1. 根据已剪画面确定配乐时间窗和强度变化。
2. 在 `本地背景音乐_ACE-Step1.5_3070Ti-8GB_v01.json` 提交一次当前 Cue。
3. 听完整结果；不合格时只修提示、结构或参数中的一个主要变量。
4. 把选中结果放入必剪的独立 MUS 轨并做对白 ducking。
5. 在整片混音中决定最终响度，不硬编码一个通用衰减值。

## Listening QA

检查：

- 实际时长、采样率、声道和可播放性；
- 意外人声、歌词、讲话或熟悉旋律；
- 点击、削波、失真、掉音和提前静音；
- 情绪、强度、转折、循环接缝或尾部淡化；
- 放入成片后对白仍清楚；
- 来源与使用权说明。

技术 smoke 只证明模型能运行，不等于配乐适合当前成片。
