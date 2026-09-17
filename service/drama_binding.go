package service

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"gorm.io/gorm"
	"strings"
)

type DramaBindingInput struct {
	References       []model.DramaBindingReference `json:"references"`
	ExpectedRevision int64                         `json:"expectedRevision"`
}

func CurrentDramaBinding(ctx context.Context, p, e, c, stage string) (model.DramaBinding, error) {
	u, err := dramaUser(ctx)
	if err != nil {
		return model.DramaBinding{}, err
	}
	if stage != "storyboard" && stage != "video" {
		return model.DramaBinding{}, safeMessageError{message: "制作阶段无效"}
	}
	value, err := repository.GetDramaBinding(u, p, e, c, stage)
	return value, dramaError(err)
}
func UpdateCurrentDramaBinding(ctx context.Context, p, e, c, stage string, input DramaBindingInput) (model.DramaBinding, error) {
	u, err := dramaUser(ctx)
	if err != nil {
		return model.DramaBinding{}, err
	}
	if stage != "storyboard" && stage != "video" {
		return model.DramaBinding{}, safeMessageError{message: "制作阶段无效"}
	}
	if input.ExpectedRevision < 0 || len(input.References) > 16 {
		return model.DramaBinding{}, safeMessageError{message: "输入版本或数量无效"}
	}
	if input.References == nil {
		input.References = []model.DramaBindingReference{}
	}
	seen := map[string]bool{}
	roles := map[string]bool{"character": true, "scene": true, "prop": true, "reference": true, "expression": true, "voice": true, "video_reference": true}
	for i, ref := range input.References {
		key := ref.AssetID + "\x00" + ref.VersionID + "\x00" + ref.Role + "\x00" + ref.Speaker
		if ref.Order != i || ref.AssetID == "" || ref.VersionID == "" || !roles[ref.Role] || seen[key] {
			return model.DramaBinding{}, safeMessageError{message: "输入必须指定唯一素材版本、用途和连续顺序"}
		}
		if stage == "storyboard" && (ref.Role == "voice" || ref.Role == "video_reference") {
			return model.DramaBinding{}, safeMessageError{message: "故事板只接受图片输入"}
		}
		if ref.Role == "voice" && (ref.Speaker == "" || ref.Speaker != strings.TrimSpace(ref.Speaker)) {
			return model.DramaBinding{}, safeMessageError{message: "声音需要实际说话者"}
		}
		seen[key] = true
	}
	value := model.DramaBinding{ID: uuid.NewString(), UserID: u, ProjectID: p, EpisodeID: e, ClipID: c, Stage: stage, References: input.References, UpdatedAt: now()}
	value, err = repository.SaveDramaBinding(value, input.ExpectedRevision)
	return value, dramaBindingError(err)
}

func dramaBindingError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, repository.ErrDramaRevisionConflict) || errors.Is(err, gorm.ErrRecordNotFound) {
		return dramaError(err)
	}
	switch err.Error() {
	case "输入必须指定唯一素材版本、用途和连续顺序", "故事板只接受图片输入", "声音需要实际说话者", "输入用途与媒体类型不一致", "人物表情用途与制作阶段或资产类型不匹配", "完整人物表情板不能作为其他用途输入", "人物表情单状态参考必须使用人物表情用途", "声音必须绑定本 Clip 实际说话者", "已归档资产只能保留原有引用", "回收站中的 Clip 不能修改输入":
		return safeMessageError{message: err.Error()}
	default:
		return err
	}
}
