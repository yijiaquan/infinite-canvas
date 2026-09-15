# FFmpeg 媒体助手

FFmpeg 是本项目的本地技术工具，不是视频模型，也不是创意剪辑器。只在真实媒体检查、明确的技术修正，或已经定稿的简单裁切/拼接时调用；不要为每个 Shot 例行转码或输出额外报告。

```powershell
$ffmpeg = 'D:\work\剪映\tools\ffmpeg-9.0.1-essentials_build\bin\ffmpeg.exe'
$ffprobe = 'D:\work\剪映\tools\ffmpeg-9.0.1-essentials_build\bin\ffprobe.exe'
```

## Real-media inspection

先用 `ffprobe` 读取源文件真实属性，而不是根据队列、文件名或播放器标签判断：

```powershell
& $ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,nb_frames -of json -- "$inputVideo"
```

需要检查画面时，从同一源 MP4 抽取明确时间点的一帧：

```powershell
& $ffmpeg -hide_banner -y -ss 00:00:02.500 -i "$inputVideo" -frames:v 1 -q:v 2 "$frameOutput"
```

对短 Shot，可按开场、关键动作和结尾各抽一帧；对接缝，抽取上一 Shot 结尾与下一 Shot 开头的相邻源帧。不要截取播放器、ComfyUI 界面、Blender 窗口或桌面画面来代替源帧。抽帧只辅助定位，仍要正常速度观看视频并检查声音。

## Permitted technical post-fix

- 已确定裁点的简单裁切；
- 已经统一编码、画幅、FPS 与音轨结构的片段拼接；
- 已确认不改变创意内容的封装、转码、音轨或字幕技术修正。

处理后重新用 `ffprobe` 检查输出，再看片确认时长、画幅、音轨和同步。若仍要挑镜头、调整节奏、做声桥、多轨混音、替换镜头或继续反复修改，回到必剪。

## Boundaries

- 必剪是创意剪辑和可编辑时间线的唯一默认工具。
- 不用 FFmpeg 把静态图、导演板、白模、截图或不合格片段伪造成要求的生成视频。
- 不因工具可用而自动裁切、拼接、转码或覆盖已有媒体；每次只执行已明确的技术目标。
