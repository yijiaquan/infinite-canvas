package service

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
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
		return model.DramaBinding{}, errors.New("制作阶段无效")
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
		return model.DramaBinding{}, errors.New("制作阶段无效")
	}
	if input.ExpectedRevision < 0 || len(input.References) > 16 {
		return model.DramaBinding{}, errors.New("输入版本或数量无效")
	}
	if input.References == nil {
		input.References = []model.DramaBindingReference{}
	}
	seen := map[string]bool{}
	roles := map[string]bool{"character": true, "scene": true, "prop": true, "reference": true, "voice": true, "video_reference": true}
	for i, ref := range input.References {
		key := ref.AssetID + "\x00" + ref.VersionID + "\x00" + ref.Role + "\x00" + ref.Speaker
		if ref.Order != i || ref.AssetID == "" || ref.VersionID == "" || !roles[ref.Role] || seen[key] {
			return model.DramaBinding{}, errors.New("输入必须指定唯一素材版本、用途和连续顺序")
		}
		if stage == "storyboard" && (ref.Role == "voice" || ref.Role == "video_reference") {
			return model.DramaBinding{}, errors.New("故事板只接受图片输入")
		}
		if ref.Role == "voice" && (ref.Speaker == "" || ref.Speaker != strings.TrimSpace(ref.Speaker)) {
			return model.DramaBinding{}, errors.New("声音需要实际说话者")
		}
		seen[key] = true
	}
	value := model.DramaBinding{ID: uuid.NewString(), UserID: u, ProjectID: p, EpisodeID: e, ClipID: c, Stage: stage, References: input.References, UpdatedAt: now()}
	value, err = repository.SaveDramaBinding(value, input.ExpectedRevision)
	return value, dramaError(err)
}
