# 漫剧项目与分集接口

## Clip 与镜头

- GET `/api/v1/drama/projects/:id/episodes/:episodeId/clips`：返回按 `position,id` 排序的 Clip 数组，包含已归档条目供回收站筛选。
- POST 同路径：创建 Clip，title 必填，position 自动追加末尾，revision 为 1；可提交 scene、summary、entryState、exitState、shots、archived。
- POST 同路径加 `/:clipId`：expectedRevision 必填；以上内容字段可局部更新，省略保留。position只能通过`/clips/reorder`提交全部活动Clip的`{id,expectedRevision}`列表事务更新，避免重复序号。archived=true归档、false恢复，无硬删除，不清理媒体。
- Clip 包含 id/projectId/episodeId/title/scene/position/summary/entryState/exitState/shots/revision/archived/createdAt/updatedAt。此记录不保存生成提示词或节点参数；当前画布视图通过一次准备操作创建制作节点，提示词直接编辑节点 metadata.prompt。
- Shot 包含 id/title/duration/action/dialogue/speaker/camera/sound/entryState/exitState。duration 是大于零的有限秒数，允许小数，不静默截断。ID 由调用方提供，非空、无首尾空格、最多64字节、单 Clip 内唯一；更新不重新生成 ID。
- shots 整体替换，`[]` 清空，省略或 null 保留；响应数组始终为 `[]` 而非 null。最多200个镜头；标题、场次和发声者最多200字符，单个正文字段最多100000字符。
- 每次查询与写入同时核实账号、项目、分集完整归属；版本冲突不覆盖已有内容。

接口沿用 `{code,data,msg}`，所有制作业务按当前账号及项目/分集归属校验，业务失败保留当前数据库内容。

| 方法与路径（前缀 `/api/v1`） | 请求 | data |
| --- | --- | --- |
| GET `/drama/projects` | 无 | Project[]，只返回当前账号 |
| POST `/drama/projects` | title；可选 sourceType/sourceText/adaptation/globalStyle | Project |
| GET `/drama/projects/:id` | 无 | `{project,episodes}`，分集按 position/id 排序 |
| POST `/drama/projects/:id` | expectedRevision；可选可编辑字段 | Project |
| POST `/drama/projects/:id/episodes` | title；可选 script | Episode，自动追加末尾 |
| POST `/drama/projects/:id/episodes/:episodeId` | expectedRevision；可选 title/script/position | Episode |

Project 包含 id、title、sourceType（novel/script，默认 script）、sourceText、adaptation、globalStyle、revision、createdAt、updatedAt。Episode 包含 id、projectId、canvasId、title、position、script、revision、createdAt、updatedAt。时间使用 UTC RFC3339Nano。创建版本为 1，更新以 expectedRevision 条件写入，冲突不覆盖；省略字段保留，空字符串清空正文。

创建分集在事务内创建唯一 CanvasProject。画布使用现有完整 JSON 格式，附加 dramaProjectId/dramaEpisodeId。画布保存接口按账号和实际分集关联规范这两个字段，拒绝非关联画布伪造标记。普通画布删除接口拒绝删除分集画布；首阶段不提供删除分集。

画布标题初始使用集名，此后属于画布展示名称；分集名称以 Episode 为准。首阶段不自动改写已保存的画布布局及标题。

正式分集画布的 JSON 含 `dramaRevision`，新建为1。单条和批量保存均按实际分集关联执行版本比较，成功返回递增版本，陈旧版本不能覆盖。前端串行提交，收到版本后继续保存期间产生的新修改。冲突保留本地；“加载服务器版本”需明确选择，替换本地画布并清空旧撤销历史。普通画布仍使用原保存规则。

`dramaPreparedClipIds` 保留已准备记录；Clip 对应节点 metadata 使用 `dramaClipId` 与 `dramaRole`（group/storyboard/video/reference）。首次创建故事板到视频的实际输入边；重复操作不复制，缺失结构先预览并选择恢复空节点，保留已有内容与布局。

## 资产、绑定与生成

路径以 `/api/v1/drama/projects/:id` 为基础。所有修改需要登录；版本不匹配拒绝覆盖。

- GET/POST `/assets`，POST `/assets/:assetId`，POST `/assets/:assetId/versions`：档案、固定媒体版本、显式采用。上传经 `/api/v1/drama/media` 注册现有存储；保留原文件，不把浏览器临时URL作为正式采用。人物的 `defaultVoiceVersionId` 必须是同项目音色的固定音频版本。
- GET/POST `/episodes/:episodeId/clips/:clipId/bindings/:stage`：stage是storyboard/video，写入`{expectedRevision,references}`，每项包含assetId/versionId/role/order/speaker。语音仅用于实际说话者，顺序必须连续；不因资产采用新版本而替换原引用。
- GET/POST `/episodes/:episodeId/clips/:clipId/runs`：列出历史／按requestId入队。请求包含nodeId/kind/model/channelId/prompt/parameters/references。正式节点归属须与数据库分集画布一致。
- POST同路径`/preview`：校验与编译，不创建运行或提交生成，返回snapshot/credits/kind。inputMapping列出实际H3标签、顺序和媒体来源；视频内嵌音轨经ffprobe检查，不能猜测Audio编号。
- POST同路径`/:runId/cancel`：仅等待提交队列可以取消；尚未扣费。提交后不会退款，不通过全局ComfyUI中断误伤其他任务。
- POST同路径`/:runId/recheck`：只查询已知上游ID或重试保存现有响应。未知提交不自动重发，无法查询时保持明确错误。
- GET/POST `/episodes/:episodeId/clips/:clipId/adoption`：明确选择已持久保存的候选。POST需要runId/storageId/clipRevision/expectedRevision；语义修改后needsReview为true，布局和显示名称变化不影响采用。
- GET `/episodes/:episodeId/runs`与`/adoptions`：制作总览；GET `/episodes/:episodeId/export?partial=false`：按Clip顺序导出采用视频与manifest.json，校验实际媒体SHA256，缺失与待复核默认拦截。
- POST `/episodes/:episodeId/clips/:clipId/import-output`：专用历史记录入口，只接受当前账号已经注册的媒体；来源明确标为legacy-import，不伪造真实provider任务或扣费。

队列冻结参数及编译后请求，修改草稿不影响已入队任务。重复requestId只返回同一任务；启动恢复已知ID继续查询，未知提交不重发。后台工作线程复用现有渠道，初始并发为每个ComfyUI实例一项、每个图片渠道两项；无独立支付系统。

项目`generationDefaults`按image/video存显式参数；工作台/画布共用构建函数合并项目默认值和节点`dramaParameters`，再冻结为请求。未设置的字段不填固定步数、种子或时长。原输入重跑只使用原快照，不合并新默认值。
