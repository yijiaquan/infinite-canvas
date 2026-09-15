# Optional Local Video Upscale

只对已经通过内容 QA、但在目标裁切下明显偏软的选中视频使用 RealESRGAN 2x。超分不能修复错误身份、手、动作、场景、数量、摄影机或剧情。

## Current Route

- Workflow：`D:/Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/user/default/workflows/本地视频超分_RealESRGAN_3070Ti-8GB_v01.json`
- Model：`D:/Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/models/upscale_models/RealESRGAN_x2plus.pth`
- Recommended local settings：`scale=2`、`per_batch=1`、`precision=float16`、`auto_free_memory=true`。

模型固定输出源宽高的 2 倍：720p 会得到 1440p 中间文件，之后可在必剪正常缩放到 1080p，不拉伸比例。

## Workflow

1. 保留原视频，不覆盖。
2. 在字幕、标题、标签和 UI 合成前运行超分。
3. 使用独立输出目录和清楚文件名。
4. 比较原片与超分片；通过才在必剪替换。
5. 超分失败就继续使用原视频，不因此重做故事或视频。

ComfyUI 会自然排队。只有结果不明时才查看 queue、History 和输出，避免重复提交。

## QA

检查实际文件：

- 宽高恰为 2 倍且显示比例不变；
- 时长、FPS、帧数、时间基、音轨和 A/V 同步保持；
- 首、中、尾和正常速度播放；
- 脸、手、文字和纹理没有新增变形；
- 没有 crawling texture、闪烁、振铃、光晕、过锐、丢帧、冻结帧或掉音。

通过后再添加字幕、标题、真相标签和界面元素。
