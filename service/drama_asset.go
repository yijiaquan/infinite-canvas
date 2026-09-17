package service

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"strings"
	"time"
	"unicode/utf8"
)

type DramaAssetInput struct {
	Title                 *string `json:"title"`
	Kind                  string  `json:"kind"`
	ParentID              *string `json:"parentId"`
	Description           *string `json:"description"`
	AdoptedVersionID      *string `json:"adoptedVersionId"`
	DefaultVoiceVersionID *string `json:"defaultVoiceVersionId"`
	Archived              *bool   `json:"archived"`
	ExpectedRevision      int64   `json:"expectedRevision"`
}

type DramaAssetVersionInput struct {
	StorageID        string `json:"storageId"`
	Note             string `json:"note"`
	ExpectedRevision int64  `json:"expectedRevision"`
}

type DramaAssetDetail struct {
	Assets   []model.DramaAsset        `json:"assets"`
	Versions []model.DramaAssetVersion `json:"versions"`
}

type DramaAssetVersionResult struct {
	Asset   model.DramaAsset        `json:"asset"`
	Version model.DramaAssetVersion `json:"version"`
}

func dramaAssetError(err error) error {
	if errors.Is(err, repository.ErrDramaAssetParent) {
		return safeMessageError{message: "资产父级无效，不能形成循环或引用已归档资产"}
	}
	if errors.Is(err, repository.ErrDramaAssetArchived) {
		return safeMessageError{message: "请先恢复已归档资产"}
	}
	if errors.Is(err, repository.ErrDramaAssetMedia) {
		return safeMessageError{message: "资产类型与素材格式不匹配"}
	}
	return dramaError(err)
}

func validDramaAssetID(id string) bool { return len(id) <= 64 && strings.TrimSpace(id) == id }

func validateDramaAsset(input DramaAssetInput, create bool) error {
	if err := validateDramaTitle(input.Title, create); err != nil {
		return err
	}
	if !create && input.ExpectedRevision < 1 {
		return safeMessageError{message: "缺少有效内容版本，请刷新后重试"}
	}
	if create {
		switch input.Kind {
		case "character", "scene", "prop", "voice", "reference", "expression":
		default:
			return safeMessageError{message: "资产类型无效"}
		}
		if input.AdoptedVersionID != nil && *input.AdoptedVersionID != "" {
			return safeMessageError{message: "新建资产后才能采用版本"}
		}
	} else if input.Kind != "" {
		return safeMessageError{message: "已有资产不能修改类型"}
	}
	for _, id := range []*string{input.ParentID, input.AdoptedVersionID, input.DefaultVoiceVersionID} {
		if id != nil && !validDramaAssetID(*id) {
			return safeMessageError{message: "资产 ID 无效"}
		}
	}
	if utf8.RuneCountInString(dramaText(input.Description)) > 100000 {
		return safeMessageError{message: "资产描述过长"}
	}
	return nil
}

func CurrentUserDramaAssets(ctx context.Context, projectID string) (DramaAssetDetail, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return DramaAssetDetail{}, err
	}
	assets, versions, err := repository.ListDramaAssets(user, projectID)
	return DramaAssetDetail{Assets: assets, Versions: versions}, dramaAssetError(err)
}

func CreateCurrentUserDramaAsset(ctx context.Context, projectID string, input DramaAssetInput) (model.DramaAsset, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return model.DramaAsset{}, err
	}
	if err := validateDramaAsset(input, true); err != nil {
		return model.DramaAsset{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	asset := model.DramaAsset{ID: uuid.NewString(), UserID: user, ProjectID: projectID, Title: strings.TrimSpace(*input.Title), Kind: input.Kind, ParentID: dramaText(input.ParentID), Description: dramaText(input.Description), Revision: 1, CreatedAt: now, UpdatedAt: now}
	asset.DefaultVoiceVersionID = dramaText(input.DefaultVoiceVersionID)
	if input.Archived != nil {
		asset.Archived = *input.Archived
	}
	asset, err = repository.CreateDramaAsset(asset)
	return asset, dramaAssetError(err)
}

func UpdateCurrentUserDramaAsset(ctx context.Context, projectID, id string, input DramaAssetInput) (model.DramaAsset, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return model.DramaAsset{}, err
	}
	if err := validateDramaAsset(input, false); err != nil {
		return model.DramaAsset{}, err
	}
	values := map[string]any{"updated_at": time.Now().UTC().Format(time.RFC3339Nano)}
	for key, value := range map[string]*string{"title": input.Title, "description": input.Description, "parent_id": input.ParentID, "adopted_version_id": input.AdoptedVersionID, "default_voice_version_id": input.DefaultVoiceVersionID} {
		if value != nil {
			values[key] = *value
		}
	}
	if input.Title != nil {
		values["title"] = strings.TrimSpace(*input.Title)
	}
	if input.Archived != nil {
		values["archived"] = *input.Archived
	}
	asset, err := repository.UpdateDramaAsset(user, projectID, id, input.ExpectedRevision, values)
	return asset, dramaAssetError(err)
}

func CreateCurrentUserDramaAssetVersion(ctx context.Context, projectID, assetID string, input DramaAssetVersionInput) (DramaAssetVersionResult, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return DramaAssetVersionResult{}, err
	}
	if input.StorageID == "" || !validDramaAssetID(input.StorageID) || input.ExpectedRevision < 1 || utf8.RuneCountInString(input.Note) > 100000 {
		return DramaAssetVersionResult{}, safeMessageError{message: "资产版本参数无效"}
	}
	version := model.DramaAssetVersion{ID: uuid.NewString(), AssetID: assetID, StorageID: input.StorageID, Note: input.Note, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}
	asset, err := repository.CreateDramaAssetVersion(user, projectID, assetID, input.ExpectedRevision, version)
	if err == nil {
		_, versions, readErr := repository.ListDramaAssets(user, projectID)
		if readErr != nil {
			return DramaAssetVersionResult{}, dramaAssetError(readErr)
		}
		for _, stored := range versions {
			if stored.ID == version.ID {
				version = stored
				break
			}
		}
	}
	return DramaAssetVersionResult{Asset: asset, Version: version}, dramaAssetError(err)
}
