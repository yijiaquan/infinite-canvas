# 岗位交接卡

> LEGACY / READ-ONLY：以下内容仅保留为历史查证，不是当前生产指令。不要执行其中写入、同步、注册、采用或提交命令；新生产使用 ai-drama-studio-workflow/references/infinite-canvas-production-contract.md 中的 Canvas DB/MCP 契约。技术实验须有独立明确授权。

```text
当前岗位：[DIR / WRT / ART / STB / VID / EDT]
当前任务：[本阶段唯一业务任务]
使用的 current 输入：[文件或资产 ID]
本阶段完成结果：[实际可用结果及路径/资产 ID]
必须保持：[下游不可改变的剧情、身份、空间、道具、镜头、声音或状态]
允许下游改变：[属于下游职责的实现空间]
真实未解决问题：[无 / 一个具体问题]
下一岗位：[岗位 ID 与下一项工作]
```

只在岗位切换、跨会话恢复或真实返修退回时更新。普通模型调用、内部 lint、排队和候选淘汰不写交接卡。
