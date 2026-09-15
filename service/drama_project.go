package service

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/google/uuid"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"gorm.io/gorm"
	"math"
	"strings"
	"time"
)

type DramaProjectInput struct {
	Title              *string                    `json:"title"`
	SourceType         *string                    `json:"sourceType"`
	SourceText         *string                    `json:"sourceText"`
	Adaptation         *string                    `json:"adaptation"`
	GlobalStyle        *string                    `json:"globalStyle"`
	GenerationDefaults *map[string]map[string]any `json:"generationDefaults"`
	ExpectedRevision   int64                      `json:"expectedRevision"`
}

type DramaEpisodeInput struct {
	Title            *string `json:"title"`
	Script           *string `json:"script"`
	Position         *int    `json:"position"`
	ExpectedRevision int64   `json:"expectedRevision"`
}

type DramaProjectDetail struct {
	Project  model.DramaProject   `json:"project"`
	Episodes []model.DramaEpisode `json:"episodes"`
}

func dramaUser(ctx context.Context) (string, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return "", safeMessageError{message: "请先登录"}
	}
	return user.ID, nil
}

func dramaError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return safeMessageError{message: "项目或分集不存在"}
	}
	if errors.Is(err, repository.ErrDramaRevisionConflict) {
		return safeMessageError{message: "内容已被其他操作更新，请刷新后重试；本次修改未覆盖已保存内容"}
	}
	return err
}

func dramaText(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func validateDramaTitle(title *string, required bool) error {
	if title == nil {
		if required {
			return safeMessageError{message: "名称不能为空"}
		}
		return nil
	}
	if strings.TrimSpace(*title) == "" || len([]rune(*title)) > 200 {
		return safeMessageError{message: "名称不能为空且不能超过200个字符"}
	}
	return nil
}

func validateDramaProject(input DramaProjectInput, create bool) error {
	if input.GenerationDefaults != nil {
		for stage, parameters := range *input.GenerationDefaults {
			if stage != "image" && stage != "video" {
				return errors.New("生成默认值类型无效")
			}
			for key, value := range parameters {
				switch key {
				case "seed", "steps", "seconds":
					n, ok := value.(float64)
					if !ok || math.IsNaN(n) || math.IsInf(n, 0) || n < 0 || n > 9007199254740991 {
						return errors.New("生成数值无效")
					}
					if key != "seconds" && math.Trunc(n) != n {
						return errors.New("种子和步数必须为整数")
					}
					if key == "seconds" && n <= 0 {
						return errors.New("时长必须大于零")
					}
					if key == "steps" && (n < 1 || n > 1000) {
						return errors.New("步数必须在1到1000之间")
					}
				case "size", "resolution_name", "quality":
					text, ok := value.(string)
					if !ok || len(text) > 100 {
						return errors.New("生成参数无效")
					}
				default:
					return errors.New("不支持的项目生成参数")
				}
			}
		}
	}
	if err := validateDramaTitle(input.Title, create); err != nil {
		return err
	}
	if input.SourceType != nil && *input.SourceType != "novel" && *input.SourceType != "script" {
		return safeMessageError{message: "来源类型必须是小说或剧本"}
	}
	if !create && input.ExpectedRevision < 1 {
		return safeMessageError{message: "缺少有效内容版本，请刷新后重试"}
	}
	return nil
}

func CurrentUserDramaProjects(ctx context.Context) ([]model.DramaProject, error) {
	id, err := dramaUser(ctx)
	if err != nil {
		return nil, err
	}
	return repository.ListDramaProjects(id)
}

func CurrentUserDramaProject(ctx context.Context, id string) (DramaProjectDetail, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return DramaProjectDetail{}, err
	}
	project, episodes, err := repository.GetDramaProject(user, id)
	return DramaProjectDetail{Project: project, Episodes: episodes}, dramaError(err)
}

func CreateCurrentUserDramaProject(ctx context.Context, input DramaProjectInput) (model.DramaProject, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return model.DramaProject{}, err
	}
	if err := validateDramaProject(input, true); err != nil {
		return model.DramaProject{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	source := dramaText(input.SourceType)
	if source == "" {
		source = "script"
	}
	project := model.DramaProject{ID: uuid.NewString(), UserID: user, Title: strings.TrimSpace(*input.Title), SourceType: source, SourceText: dramaText(input.SourceText), Adaptation: dramaText(input.Adaptation), GlobalStyle: dramaText(input.GlobalStyle), Revision: 1, CreatedAt: now, UpdatedAt: now}
	if input.GenerationDefaults != nil {
		project.GenerationDefaults = *input.GenerationDefaults
	}
	return project, repository.CreateDramaProject(project)
}

func UpdateCurrentUserDramaProject(ctx context.Context, id string, input DramaProjectInput) (model.DramaProject, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return model.DramaProject{}, err
	}
	if err := validateDramaProject(input, false); err != nil {
		return model.DramaProject{}, err
	}
	values := map[string]any{"updated_at": time.Now().UTC().Format(time.RFC3339Nano)}
	if input.GenerationDefaults != nil {
		raw, err := json.Marshal(*input.GenerationDefaults)
		if err != nil {
			return model.DramaProject{}, err
		}
		values["generation_defaults"] = string(raw)
	}
	for key, value := range map[string]*string{"title": input.Title, "source_type": input.SourceType, "source_text": input.SourceText, "adaptation": input.Adaptation, "global_style": input.GlobalStyle} {
		if value != nil {
			values[key] = *value
		}
	}
	if input.Title != nil {
		values["title"] = strings.TrimSpace(*input.Title)
	}
	project, err := repository.UpdateDramaProject(user, id, input.ExpectedRevision, values)
	return project, dramaError(err)
}

func CreateCurrentUserDramaEpisode(ctx context.Context, projectID string, input DramaEpisodeInput) (model.DramaEpisode, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return model.DramaEpisode{}, err
	}
	if err := validateDramaTitle(input.Title, true); err != nil {
		return model.DramaEpisode{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	episode := model.DramaEpisode{ID: uuid.NewString(), UserID: user, ProjectID: projectID, CanvasID: uuid.NewString(), Title: strings.TrimSpace(*input.Title), Script: dramaText(input.Script), Revision: 1, CreatedAt: now, UpdatedAt: now}
	raw, err := json.Marshal(map[string]any{
		"id": episode.CanvasID, "title": episode.Title, "createdAt": now, "updatedAt": now,
		"dramaProjectId": projectID, "dramaEpisodeId": episode.ID, "dramaRevision": 1,
		"nodes": []any{}, "connections": []any{}, "chatSessions": []any{}, "activeChatId": nil, "agentConfig": nil,
		"autoTitlePending": false, "backgroundMode": "lines", "showImageInfo": true,
		"viewport": map[string]any{"x": 0, "y": 0, "k": 1}, "sidePanel": map[string]any{"open": true, "width": 280}, "agentPanel": map[string]any{"open": false, "width": 464},
	})
	if err != nil {
		return model.DramaEpisode{}, err
	}
	episode, err = repository.CreateDramaEpisode(episode, model.CanvasProject{UserID: user, ID: episode.CanvasID, DramaRevision: 1, ProjectData: string(raw), CreatedAt: now, UpdatedAt: now})
	return episode, dramaError(err)
}

func UpdateCurrentUserDramaEpisode(ctx context.Context, projectID, id string, input DramaEpisodeInput) (model.DramaEpisode, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return model.DramaEpisode{}, err
	}
	if err := validateDramaTitle(input.Title, false); err != nil {
		return model.DramaEpisode{}, err
	}
	if input.ExpectedRevision < 1 {
		return model.DramaEpisode{}, safeMessageError{message: "缺少有效内容版本，请刷新后重试"}
	}
	if input.Position != nil && *input.Position < 1 {
		return model.DramaEpisode{}, safeMessageError{message: "分集排序必须大于零"}
	}
	values := map[string]any{"updated_at": time.Now().UTC().Format(time.RFC3339Nano)}
	if input.Title != nil {
		values["title"] = strings.TrimSpace(*input.Title)
	}
	if input.Script != nil {
		values["script"] = *input.Script
	}
	if input.Position != nil {
		values["position"] = *input.Position
	}
	episode, err := repository.UpdateDramaEpisode(user, projectID, id, input.ExpectedRevision, values)
	return episode, dramaError(err)
}
