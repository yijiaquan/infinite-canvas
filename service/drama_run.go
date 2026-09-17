package service

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"strings"
)

func CurrentDramaRuns(ctx context.Context, p, e, c string) ([]model.DramaRun, error) {
	u, err := dramaUser(ctx)
	if err != nil {
		return nil, err
	}
	runs, err := repository.ListDramaRuns(u, p, e, c)
	return runs, dramaError(err)
}
func CurrentDramaEpisodeRuns(ctx context.Context, p, e string) ([]model.DramaRun, error) {
	u, err := dramaUser(ctx)
	if err != nil {
		return nil, err
	}
	return repository.ListDramaEpisodeRuns(u, p, e)
}
func CurrentDramaRun(ctx context.Context, p, e, c, id string) (model.DramaRun, error) {
	runs, err := CurrentDramaRuns(ctx, p, e, c)
	if err != nil {
		return model.DramaRun{}, err
	}
	for _, r := range runs {
		if r.ID == id {
			return r, nil
		}
	}
	return model.DramaRun{}, errors.New("任务不存在")
}
func CancelCurrentDramaRun(ctx context.Context, p, e, c, id string) (model.DramaRun, error) {
	run, err := CurrentDramaRun(ctx, p, e, c, id)
	if err != nil {
		return run, err
	}
	if run.Status == "cancelled" {
		return run, nil
	}
	ok, err := repository.ChangeDramaRun(id, []string{"queued"}, map[string]any{"status": "cancelled", "error": ""})
	if err != nil {
		return run, err
	}
	if !ok {
		return run, errors.New("任务已开始或状态已变更，不能取消尚未提交队列之外的任务")
	}
	return CurrentDramaRun(ctx, p, e, c, id)
}
func RecheckCurrentDramaRun(ctx context.Context, p, e, c, id string) (model.DramaRun, error) {
	run, err := CurrentDramaRun(ctx, p, e, c, id)
	if err != nil {
		return run, err
	}
	status := ""
	if run.Status == "save_failed" && len(run.Response) > 0 {
		status = "saving"
	}
	if run.Status == "unknown" && run.UpstreamID != "" {
		status = "running"
	}
	if status == "" {
		return run, errors.New("没有可重新查询的上游任务或可重试保存的响应；不会自动重新提交")
	}
	_, err = repository.ChangeDramaRun(id, []string{run.Status}, map[string]any{"status": status, "error": ""})
	if err != nil {
		return run, err
	}
	return CurrentDramaRun(ctx, p, e, c, id)
}
func ValidateDramaRunReferences(ctx context.Context, p, e, c, runKind string, refs []model.DramaRunReference) error {
	u, err := dramaUser(ctx)
	if err != nil {
		return err
	}
	if len(refs) > 16 {
		return errors.New("参考素材不能超过16项")
	}
	assets, versions, err := repository.ListDramaAssets(u, p)
	if err != nil {
		return err
	}
	assetMap := map[string]model.DramaAsset{}
	versionMap := map[string]model.DramaAssetVersion{}
	for _, a := range assets {
		assetMap[a.ID] = a
	}
	for _, v := range versions {
		versionMap[v.ID] = v
	}
	clips, err := repository.ListDramaClips(u, p, e)
	if err != nil {
		return err
	}
	speakers := map[string]bool{}
	for _, clip := range clips {
		if clip.ID == c {
			speakers = model.DramaClipDialogueSpeakers(clip.Shots)
		}
	}
	for i, r := range refs {
		if r.Order != i || strings.TrimSpace(r.Role) == "" {
			return errors.New("参考素材必须按用途和从零开始的连续顺序明确绑定")
		}
		obj, err := repository.GetStorageObject(r.StorageID)
		if err != nil || obj.CreatedBy != u {
			return errors.New("参考素材不存在或不属于当前账号")
		}
		switch r.Role {
		case "storyboard", "character", "scene", "prop", "reference", "expression":
			if !strings.HasPrefix(obj.MimeType, "image/") {
				return errors.New("图片用途不能绑定音视频素材")
			}
		case "voice":
			if !strings.HasPrefix(obj.MimeType, "audio/") {
				return errors.New("声音用途需要音频素材")
			}
		case "video_reference":
			if !strings.HasPrefix(obj.MimeType, "video/") {
				return errors.New("视频参考用途需要视频素材")
			}
		default:
			return errors.New("参考用途无效")
		}
		if r.Role == "expression" && (r.AssetID == "" || r.VersionID == "") {
			return errors.New("人物表情用途必须绑定正式资产版本")
		}
		if r.AssetID != "" || r.VersionID != "" {
			a, ok := assetMap[r.AssetID]
			v, exists := versionMap[r.VersionID]
			if !ok || !exists || v.AssetID != a.ID || v.StorageID != r.StorageID {
				return errors.New("素材版本与当前项目或文件不匹配")
			}
			parent := assetMap[a.ParentID]
			isExpressionState := a.Kind == "reference" && parent.Kind == "expression"
			if r.Role == "expression" {
				valid := runKind == "image" && a.Kind == "expression" || runKind == "video" && isExpressionState
				if !valid {
					return errors.New("人物表情用途与生成阶段或资产类型不匹配")
				}
			} else if a.Kind == "expression" {
				return errors.New("完整人物表情板不能作为其他用途输入")
			} else if isExpressionState {
				return errors.New("人物表情单状态参考必须使用人物表情用途")
			}
		}
		if r.Role == "voice" && (!strings.HasPrefix(obj.MimeType, "audio/") || !speakers[r.Speaker]) {
			return errors.New("声音只能绑定当前 Clip 中实际说话的人物")
		}
	}
	return nil
}
func EncodeDramaRunOutputs(outputs []model.DramaRunOutput) string {
	raw, _ := json.Marshal(outputs)
	return string(raw)
}
