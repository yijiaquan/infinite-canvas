package service

import (
	"context"
	"encoding/json"
	"github.com/google/uuid"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"math"
	"strings"
	"time"
	"unicode/utf8"
)

type DramaClipInput struct {
	Title            *string            `json:"title"`
	Scene            *string            `json:"scene"`
	Position         *int               `json:"position"`
	Summary          *string            `json:"summary"`
	EntryState       *string            `json:"entryState"`
	ExitState        *string            `json:"exitState"`
	Shots            *[]model.DramaShot `json:"shots"`
	Archived         *bool              `json:"archived"`
	ExpectedRevision int64              `json:"expectedRevision"`
}

type DramaClipReorderInput struct {
	Clips []model.DramaClipOrder `json:"clips"`
}

func ReorderCurrentUserDramaClips(ctx context.Context, projectID, episodeID string, input DramaClipReorderInput) ([]model.DramaClip, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return nil, err
	}
	if input.Clips == nil {
		return nil, safeMessageError{message: "缺少 Clip 排序"}
	}
	seen := map[string]bool{}
	for _, item := range input.Clips {
		if item.ID == "" || strings.TrimSpace(item.ID) != item.ID || len(item.ID) > 64 || seen[item.ID] || item.ExpectedRevision < 1 {
			return nil, safeMessageError{message: "Clip 排序包含无效 ID 或版本"}
		}
		seen[item.ID] = true
	}
	clips, err := repository.ReorderDramaClips(user, projectID, episodeID, input.Clips, time.Now().UTC().Format(time.RFC3339Nano))
	for i := range clips {
		clips[i] = normalizeDramaClip(clips[i])
	}
	return clips, dramaError(err)
}

func validateDramaClip(input DramaClipInput, create bool) error {
	if err := validateDramaTitle(input.Title, create); err != nil {
		return err
	}
	if !create && input.ExpectedRevision < 1 {
		return safeMessageError{message: "缺少有效内容版本，请刷新后重试"}
	}
	if input.Position != nil {
		return safeMessageError{message: "请通过整集排序更新 Clip 顺序"}
	}
	if utf8.RuneCountInString(dramaText(input.Scene)) > 200 {
		return safeMessageError{message: "场次名称不能超过200个字符"}
	}
	for _, value := range []*string{input.Summary, input.EntryState, input.ExitState} {
		if utf8.RuneCountInString(dramaText(value)) > 100000 {
			return safeMessageError{message: "Clip 正文字段不能超过100000个字符"}
		}
	}
	if input.Shots == nil {
		return nil
	}
	if len(*input.Shots) > 200 {
		return safeMessageError{message: "单个 Clip 不能超过200个镜头"}
	}
	ids := map[string]bool{}
	for _, shot := range *input.Shots {
		if shot.ID == "" || strings.TrimSpace(shot.ID) != shot.ID || len(shot.ID) > 64 || ids[shot.ID] {
			return safeMessageError{message: "镜头 ID 不能为空、包含首尾空格、超过64字节或在 Clip 内重复"}
		}
		ids[shot.ID] = true
		if shot.Duration <= 0 || math.IsNaN(shot.Duration) || math.IsInf(shot.Duration, 0) {
			return safeMessageError{message: "镜头时长必须是大于零的有限秒数"}
		}
		for _, value := range []string{shot.Title, shot.Speaker} {
			if utf8.RuneCountInString(value) > 200 {
				return safeMessageError{message: "镜头标题与发声者不能超过200个字符"}
			}
		}
		for _, value := range []string{shot.Action, shot.Dialogue, shot.Camera, shot.Sound, shot.EntryState, shot.ExitState} {
			if utf8.RuneCountInString(value) > 100000 {
				return safeMessageError{message: "镜头正文字段不能超过100000个字符"}
			}
		}
	}
	return nil
}

func normalizeDramaClip(clip model.DramaClip) model.DramaClip {
	if clip.Shots == nil {
		clip.Shots = []model.DramaShot{}
	}
	return clip
}

func CurrentUserDramaClips(ctx context.Context, projectID, episodeID string) ([]model.DramaClip, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return nil, err
	}
	clips, err := repository.ListDramaClips(user, projectID, episodeID)
	if err != nil {
		return nil, dramaError(err)
	}
	for i := range clips {
		clips[i] = normalizeDramaClip(clips[i])
	}
	return clips, nil
}

func CreateCurrentUserDramaClip(ctx context.Context, projectID, episodeID string, input DramaClipInput) (model.DramaClip, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return model.DramaClip{}, err
	}
	if err := validateDramaClip(input, true); err != nil {
		return model.DramaClip{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	clip := model.DramaClip{ID: uuid.NewString(), UserID: user, ProjectID: projectID, EpisodeID: episodeID, Title: strings.TrimSpace(*input.Title), Scene: dramaText(input.Scene), Summary: dramaText(input.Summary), EntryState: dramaText(input.EntryState), ExitState: dramaText(input.ExitState), Revision: 1, CreatedAt: now, UpdatedAt: now, Shots: []model.DramaShot{}}
	if input.Shots != nil {
		clip.Shots = *input.Shots
	}
	if input.Archived != nil {
		clip.Archived = *input.Archived
	}
	clip, err = repository.CreateDramaClip(normalizeDramaClip(clip))
	return normalizeDramaClip(clip), dramaError(err)
}

func UpdateCurrentUserDramaClip(ctx context.Context, projectID, episodeID, id string, input DramaClipInput) (model.DramaClip, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return model.DramaClip{}, err
	}
	if err := validateDramaClip(input, false); err != nil {
		return model.DramaClip{}, err
	}
	values := map[string]any{"updated_at": time.Now().UTC().Format(time.RFC3339Nano)}
	for key, value := range map[string]*string{"title": input.Title, "scene": input.Scene, "summary": input.Summary, "entry_state": input.EntryState, "exit_state": input.ExitState} {
		if value != nil {
			values[key] = *value
		}
	}
	if input.Title != nil {
		values["title"] = strings.TrimSpace(*input.Title)
	}
	if input.Position != nil {
		values["position"] = *input.Position
	}
	if input.Archived != nil {
		values["archived"] = *input.Archived
	}
	if input.Shots != nil {
		shots := *input.Shots
		if shots == nil {
			shots = []model.DramaShot{}
		}
		raw, err := json.Marshal(shots)
		if err != nil {
			return model.DramaClip{}, err
		}
		values["shots"] = string(raw)
	}
	clip, err := repository.UpdateDramaClip(user, projectID, episodeID, id, input.ExpectedRevision, values)
	return normalizeDramaClip(clip), dramaError(err)
}
