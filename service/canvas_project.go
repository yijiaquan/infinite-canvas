package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

type canvasProjectMetadata struct {
	ID        string `json:"id"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

func canvasProjectFromRaw(
	userID string,
	raw json.RawMessage,
) (model.CanvasProject, error) {
	var metadata canvasProjectMetadata
	if len(raw) == 0 || json.Unmarshal(raw, &metadata) != nil {
		return model.CanvasProject{}, errors.New("画布项目数据无效")
	}

	metadata.ID = strings.TrimSpace(metadata.ID)
	metadata.CreatedAt = strings.TrimSpace(metadata.CreatedAt)
	metadata.UpdatedAt = strings.TrimSpace(metadata.UpdatedAt)
	if metadata.ID == "" || metadata.CreatedAt == "" ||
		metadata.UpdatedAt == "" {
		return model.CanvasProject{}, errors.New("画布项目数据无效")
	}
	episode, err := repository.FindDramaEpisodeByCanvas(strings.TrimSpace(userID), metadata.ID)
	if err != nil {
		return model.CanvasProject{}, err
	}
	var data map[string]json.RawMessage
	if err := json.Unmarshal(raw, &data); err != nil {
		return model.CanvasProject{}, err
	}
	if episode != nil {
		data["dramaProjectId"], _ = json.Marshal(episode.ProjectID)
		data["dramaEpisodeId"], _ = json.Marshal(episode.ID)
		raw, err = json.Marshal(data)
		if err != nil {
			return model.CanvasProject{}, err
		}
	} else if len(data["dramaProjectId"]) > 0 || len(data["dramaEpisodeId"]) > 0 {
		return model.CanvasProject{}, safeMessageError{message: "画布没有有效的分集关联，请从漫剧工作台打开"}
	}

	return model.CanvasProject{
		UserID:      strings.TrimSpace(userID),
		ID:          metadata.ID,
		ProjectData: string(raw),
		CreatedAt:   metadata.CreatedAt,
		UpdatedAt:   metadata.UpdatedAt,
	}, nil
}

func canvasProjectData(
	projects []model.CanvasProject,
) []json.RawMessage {
	result := make([]json.RawMessage, 0, len(projects))
	for _, project := range projects {
		if strings.TrimSpace(project.ProjectData) != "" {
			result = append(
				result,
				json.RawMessage(project.ProjectData),
			)
		}
	}
	return result
}

func CurrentUserCanvasProjects(
	ctx context.Context,
) ([]json.RawMessage, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return nil, errors.New("请先登录")
	}

	projects, err := repository.ListUserCanvasProjects(user.ID)
	if err != nil {
		return nil, err
	}
	return canvasProjectData(projects), nil
}

func SaveCurrentUserCanvasProject(
	ctx context.Context,
	raw json.RawMessage,
) (json.RawMessage, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return nil, errors.New("请先登录")
	}

	project, err := canvasProjectFromRaw(user.ID, raw)
	if err != nil {
		return nil, err
	}
	saved, err := repository.SaveUserCanvasProject(project)
	if err != nil {
		return nil, canvasSaveError(err)
	}
	if saved.DeletedAt != "" {
		return nil, errors.New("画布项目已删除")
	}
	return json.RawMessage(saved.ProjectData), nil
}

func SyncCurrentUserCanvasProjects(
	ctx context.Context,
	rawProjects []json.RawMessage,
) ([]json.RawMessage, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return nil, errors.New("请先登录")
	}

	projects := make([]model.CanvasProject, 0, len(rawProjects))
	for _, raw := range rawProjects {
		project, err := canvasProjectFromRaw(user.ID, raw)
		if err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}

	saved, err := repository.SaveUserCanvasProjects(user.ID, projects)
	if err != nil {
		return nil, canvasSaveError(err)
	}
	return canvasProjectData(saved), nil
}

func canvasSaveError(err error) error {
	if errors.Is(err, repository.ErrDramaCanvasRevisionConflict) {
		return safeMessageError{message: "分集画布已被其他操作更新，本次修改未覆盖已保存内容；请保留本地草稿并重新加载画布后重试"}
	}
	return err
}

func DeleteCurrentUserCanvasProjects(
	ctx context.Context,
	projectIDs []string,
) error {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return errors.New("请先登录")
	}
	linked, err := repository.HasDramaEpisodeCanvases(user.ID, projectIDs)
	if err != nil {
		return err
	}
	if linked {
		return safeMessageError{message: "分集画布不能直接删除，请保留漫剧项目关联"}
	}

	for _, projectID := range projectIDs {
		if strings.TrimSpace(projectID) != "" {
			return repository.SoftDeleteUserCanvasProjects(
				user.ID,
				projectIDs,
				time.Now().UTC().Format(time.RFC3339Nano),
			)
		}
	}
	return errors.New("画布项目参数无效")
}
