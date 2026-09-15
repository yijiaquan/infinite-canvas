package service

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"strings"
)

type DramaImportOutputInput struct {
	RequestID    string `json:"requestId"`
	NodeID       string `json:"nodeId"`
	Kind         string `json:"kind"`
	StorageID    string `json:"storageId"`
	SourceKey    string `json:"sourceKey"`
	Prompt       string `json:"prompt"`
	ClipRevision int64  `json:"clipRevision"`
}

func ImportDramaOutput(ctx context.Context, p, e, c string, input DramaImportOutputInput) (model.DramaRun, error) {
	u, err := dramaUser(ctx)
	if err != nil {
		return model.DramaRun{}, err
	}
	if len(input.RequestID) < 1 || len(input.RequestID) > 128 || len(input.SourceKey) < 1 || len(input.SourceKey) > 1000 || len(input.Prompt) > 1000000 || input.ClipRevision < 1 || (input.Kind != "image" && input.Kind != "video" && input.Kind != "audio") {
		return model.DramaRun{}, safeMessageError{message: "导入参数无效"}
	}
	clips, err := repository.ListDramaClips(u, p, e)
	if err != nil {
		return model.DramaRun{}, dramaError(err)
	}
	found := false
	for _, clip := range clips {
		if clip.ID == c && !clip.Archived && clip.Revision == input.ClipRevision {
			found = true
		}
	}
	if !found {
		return model.DramaRun{}, safeMessageError{message: "Clip 不存在、已归档或版本已变更"}
	}
	object, err := repository.GetStorageObject(input.StorageID)
	if err != nil || object.CreatedBy != u || object.DeletedAt != "" || !strings.HasPrefix(object.MimeType, input.Kind+"/") {
		return model.DramaRun{}, safeMessageError{message: "导入媒体不存在或类型不匹配"}
	}
	timestamp := now()
	run := model.DramaRun{ID: uuid.NewString(), UserID: u, RequestID: input.RequestID, ProjectID: p, EpisodeID: e, ClipID: c, NodeID: input.NodeID, Kind: input.Kind, Status: "completed", Provider: "import", CreatedAt: timestamp, UpdatedAt: timestamp, Snapshot: model.DramaRunSnapshot{Prompt: input.Prompt, Model: "legacy-import", Parameters: map[string]any{"importSourceKey": input.SourceKey, "sourceType": "import", "clipRevision": input.ClipRevision}, References: []model.DramaRunReference{}}, Outputs: []model.DramaRunOutput{{StorageID: object.ID, URL: "/api/files/" + object.ID + "/content", MimeType: object.MimeType}}}
	stored, err := repository.CreateDramaRun(run)
	if err != nil {
		return model.DramaRun{}, err
	}
	if stored.ProjectID != p || stored.EpisodeID != e || stored.ClipID != c || stored.Provider != "import" || stored.Kind != input.Kind || stored.NodeID != input.NodeID || stored.Snapshot.Prompt != input.Prompt || stored.Snapshot.Parameters["importSourceKey"] != input.SourceKey || len(stored.Outputs) != 1 || stored.Outputs[0].StorageID != input.StorageID {
		return model.DramaRun{}, errors.New("导入请求标识已用于不同内容")
	}
	return stored, nil
}
