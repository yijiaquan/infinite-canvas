package repository

import (
	"encoding/json"
	"errors"
	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"strings"
)

func GetDramaBinding(u, p, e, c, stage string) (model.DramaBinding, error) {
	value := model.DramaBinding{UserID: u, ProjectID: p, EpisodeID: e, ClipID: c, Stage: stage, References: []model.DramaBindingReference{}}
	if err := DramaRunScope(u, p, e, c); err != nil {
		return value, err
	}
	db, err := DB()
	if err != nil {
		return value, err
	}
	err = db.Where("user_id = ? AND clip_id = ? AND stage = ?", u, c, stage).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = nil
	}
	return value, err
}
func SaveDramaBinding(value model.DramaBinding, expected int64) (model.DramaBinding, error) {
	db, err := DB()
	if err != nil {
		return value, err
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		var clip model.DramaClip
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND user_id = ? AND project_id = ? AND episode_id = ?", value.ClipID, value.UserID, value.ProjectID, value.EpisodeID).First(&clip).Error; err != nil {
			return err
		}
		if clip.Archived {
			return errors.New("回收站中的 Clip 不能修改输入")
		}
		current := model.DramaBinding{References: []model.DramaBindingReference{}}
		lookup := tx.Where("user_id = ? AND clip_id = ? AND stage = ?", value.UserID, value.ClipID, value.Stage).First(&current).Error
		if lookup != nil && !errors.Is(lookup, gorm.ErrRecordNotFound) {
			return lookup
		}
		if current.Revision != expected {
			return ErrDramaRevisionConflict
		}
		for _, input := range value.References {
			var asset model.DramaAsset
			var parent model.DramaAsset
			var version model.DramaAssetVersion
			var storage model.StorageObject
			if err := tx.Where("id = ? AND user_id = ? AND project_id = ?", input.AssetID, value.UserID, value.ProjectID).First(&asset).Error; err != nil {
				return err
			}
			if asset.Archived {
				kept := false
				for _, old := range current.References {
					if old == input {
						kept = true
					}
				}
				if !kept {
					return errors.New("已归档资产只能保留原有引用")
				}
			}
			if err := tx.Where("id = ? AND asset_id = ?", input.VersionID, input.AssetID).First(&version).Error; err != nil {
				return err
			}
			parentKind := ""
			if asset.Kind == "reference" && asset.ParentID != "" {
				if err := tx.Where("id = ? AND user_id = ? AND project_id = ?", asset.ParentID, value.UserID, value.ProjectID).First(&parent).Error; err != nil {
					return err
				}
				parentKind = parent.Kind
			}
			isExpressionState := asset.Kind == "reference" && parentKind == "expression"
			if input.Role == "expression" {
				valid := value.Stage == "storyboard" && asset.Kind == "expression" || value.Stage == "video" && isExpressionState
				if !valid {
					return errors.New("人物表情用途与制作阶段或资产类型不匹配")
				}
			} else if asset.Kind == "expression" {
				return errors.New("完整人物表情板不能作为其他用途输入")
			} else if isExpressionState {
				return errors.New("人物表情单状态参考必须使用人物表情用途")
			}
			if err := tx.Where("id = ? AND created_by = ? AND deleted_at = ?", version.StorageID, value.UserID, "").First(&storage).Error; err != nil {
				return err
			}
			kind := "image/"
			if input.Role == "voice" {
				kind = "audio/"
			}
			if input.Role == "video_reference" {
				kind = "video/"
			}
			if !strings.HasPrefix(storage.MimeType, kind) {
				return errors.New("输入用途与媒体类型不一致")
			}
			if input.Role == "voice" {
				if !model.DramaClipDialogueSpeakers(clip.Shots)[input.Speaker] {
					return errors.New("声音必须绑定本 Clip 实际说话者")
				}
			}
		}
		value.Revision = expected + 1
		if errors.Is(lookup, gorm.ErrRecordNotFound) {
			return tx.Create(&value).Error
		}
		value.ID = current.ID
		raw, err := json.Marshal(value.References)
		if err != nil {
			return err
		}
		result := tx.Model(&model.DramaBinding{}).Where("id = ? AND revision = ?", current.ID, expected).Updates(map[string]any{"references": string(raw), "revision": value.Revision, "updated_at": value.UpdatedAt})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrDramaRevisionConflict
		}
		return nil
	})
	return value, err
}
