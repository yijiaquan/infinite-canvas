package repository

import (
	"errors"
	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"strings"
)

var ErrDramaAssetParent = errors.New("invalid drama asset parent")
var ErrDramaAssetArchived = errors.New("archived drama asset")
var ErrDramaAssetMedia = errors.New("invalid drama asset media")

func dramaAssetDefaultVoice(tx *gorm.DB, asset model.DramaAsset, id string) error {
	if id == "" {
		return nil
	}
	if asset.Kind != "character" {
		return ErrDramaAssetMedia
	}
	var version model.DramaAssetVersion
	if err := tx.Where("id = ?", id).First(&version).Error; err != nil {
		return err
	}
	var voice model.DramaAsset
	if err := tx.Where("id = ? AND project_id = ? AND user_id = ? AND kind = ?", version.AssetID, asset.ProjectID, asset.UserID, "voice").First(&voice).Error; err != nil {
		return err
	}
	if voice.Archived && asset.DefaultVoiceVersionID != id {
		return ErrDramaAssetArchived
	}
	var object model.StorageObject
	if err := tx.Where("id = ? AND created_by = ? AND (deleted_at = '' OR deleted_at IS NULL)", version.StorageID, asset.UserID).First(&object).Error; err != nil {
		return err
	}
	if !strings.HasPrefix(object.MimeType, "audio/") {
		return ErrDramaAssetMedia
	}
	return nil
}

func dramaAssetProject(tx *gorm.DB, userID, projectID string) error {
	var project model.DramaProject
	return tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND user_id = ?", projectID, userID).First(&project).Error
}

func dramaAssetParent(tx *gorm.DB, asset model.DramaAsset, parentID string) error {
	if asset.Kind == "expression" && parentID == "" {
		return ErrDramaAssetParent
	}
	seen := map[string]bool{asset.ID: true}
	direct := true
	for parentID != "" {
		if seen[parentID] {
			return ErrDramaAssetParent
		}
		seen[parentID] = true
		var parent model.DramaAsset
		if err := tx.Where("id = ? AND project_id = ? AND user_id = ?", parentID, asset.ProjectID, asset.UserID).First(&parent).Error; err != nil {
			return err
		}
		if parent.Archived {
			return ErrDramaAssetParent
		}
		if direct && asset.Kind == "expression" && parent.Kind != "character" {
			return ErrDramaAssetParent
		}
		direct = false
		parentID = parent.ParentID
	}
	return nil
}

func ListDramaAssets(userID, projectID string) ([]model.DramaAsset, []model.DramaAssetVersion, error) {
	db, err := DB()
	if err != nil {
		return nil, nil, err
	}
	assets := []model.DramaAsset{}
	versions := []model.DramaAssetVersion{}
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := dramaAssetProject(tx, userID, projectID); err != nil {
			return err
		}
		if err := tx.Where("user_id = ? AND project_id = ?", userID, projectID).Order("created_at ASC, id ASC").Find(&assets).Error; err != nil {
			return err
		}
		return tx.Where("asset_id IN (?)", tx.Model(&model.DramaAsset{}).Select("id").Where("user_id = ? AND project_id = ?", userID, projectID)).Order("created_at ASC, id ASC").Find(&versions).Error
	})
	return assets, versions, err
}

func CreateDramaAsset(asset model.DramaAsset) (model.DramaAsset, error) {
	db, err := DB()
	if err != nil {
		return asset, err
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := dramaAssetProject(tx, asset.UserID, asset.ProjectID); err != nil {
			return err
		}
		if err := dramaAssetParent(tx, asset, asset.ParentID); err != nil {
			return err
		}
		voiceID := asset.DefaultVoiceVersionID
		check := asset
		check.DefaultVoiceVersionID = ""
		if err := dramaAssetDefaultVoice(tx, check, voiceID); err != nil {
			return err
		}
		return tx.Create(&asset).Error
	})
	return asset, err
}

func UpdateDramaAsset(userID, projectID, id string, revision int64, values map[string]any) (model.DramaAsset, error) {
	db, err := DB()
	if err != nil {
		return model.DramaAsset{}, err
	}
	var asset model.DramaAsset
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := dramaAssetProject(tx, userID, projectID); err != nil {
			return err
		}
		if err := tx.Where("id = ? AND project_id = ? AND user_id = ?", id, projectID, userID).First(&asset).Error; err != nil {
			return err
		}
		if asset.Revision != revision {
			return ErrDramaRevisionConflict
		}
		if voiceID, ok := values["default_voice_version_id"].(string); ok {
			if err := dramaAssetDefaultVoice(tx, asset, voiceID); err != nil {
				return err
			}
		}
		if parent, ok := values["parent_id"].(string); ok {
			if err := dramaAssetParent(tx, asset, parent); err != nil {
				return err
			}
		}
		if versionID, ok := values["adopted_version_id"].(string); ok && versionID != "" {
			if asset.Archived {
				return ErrDramaAssetArchived
			}
			var version model.DramaAssetVersion
			if err := tx.Where("id = ? AND asset_id = ?", versionID, id).First(&version).Error; err != nil {
				return err
			}
		}
		values["revision"] = revision + 1
		result := tx.Model(&model.DramaAsset{}).Where("id = ? AND user_id = ? AND project_id = ? AND revision = ?", id, userID, projectID, revision).Updates(values)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrDramaRevisionConflict
		}
		return tx.Where("id = ?", id).First(&asset).Error
	})
	return asset, err
}

func CreateDramaAssetVersion(userID, projectID, assetID string, revision int64, version model.DramaAssetVersion) (model.DramaAsset, error) {
	db, err := DB()
	if err != nil {
		return model.DramaAsset{}, err
	}
	var asset model.DramaAsset
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := dramaAssetProject(tx, userID, projectID); err != nil {
			return err
		}
		if err := tx.Where("id = ? AND user_id = ? AND project_id = ?", assetID, userID, projectID).First(&asset).Error; err != nil {
			return err
		}
		if asset.Revision != revision {
			return ErrDramaRevisionConflict
		}
		if asset.Archived {
			return ErrDramaAssetArchived
		}
		var storage model.StorageObject
		if err := tx.Where("id = ? AND created_by = ? AND (deleted_at = '' OR deleted_at IS NULL)", version.StorageID, userID).First(&storage).Error; err != nil {
			return err
		}
		isImage := strings.HasPrefix(storage.MimeType, "image/")
		isAudio := strings.HasPrefix(storage.MimeType, "audio/")
		isExpressionState := false
		if asset.Kind == "reference" && asset.ParentID != "" {
			var parent model.DramaAsset
			parentErr := tx.Select("kind").Where("id = ? AND user_id = ? AND project_id = ?", asset.ParentID, userID, projectID).First(&parent).Error
			if parentErr == nil {
				isExpressionState = parent.Kind == "expression"
			} else if !errors.Is(parentErr, gorm.ErrRecordNotFound) {
				return parentErr
			}
		}
		invalidMedia := asset.Kind == "voice" && !isAudio || asset.Kind != "voice" && asset.Kind != "reference" && !isImage
		if asset.Kind == "reference" {
			invalidMedia = isExpressionState && !isImage || !isExpressionState && !isImage && !isAudio && !strings.HasPrefix(storage.MimeType, "video/")
		}
		if invalidMedia {
			return ErrDramaAssetMedia
		}
		version.AssetID = assetID
		version.MimeType = storage.MimeType
		if err := tx.Create(&version).Error; err != nil {
			return err
		}
		result := tx.Model(&model.DramaAsset{}).Where("id = ? AND revision = ?", assetID, revision).Updates(map[string]any{"revision": revision + 1, "updated_at": version.CreatedAt})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrDramaRevisionConflict
		}
		return tx.Where("id = ?", assetID).First(&asset).Error
	})
	return asset, err
}
