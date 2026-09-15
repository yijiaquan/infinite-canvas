package repository

import (
	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func dramaEpisodeScope(tx *gorm.DB, userID, projectID, episodeID string) error {
	var project model.DramaProject
	if err := tx.Where("user_id = ? AND id = ?", userID, projectID).First(&project).Error; err != nil {
		return err
	}
	var episode model.DramaEpisode
	return tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("user_id = ? AND project_id = ? AND id = ?", userID, projectID, episodeID).First(&episode).Error
}

func ListDramaClips(userID, projectID, episodeID string) ([]model.DramaClip, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	clips := []model.DramaClip{}
	if err := dramaEpisodeScope(db, userID, projectID, episodeID); err != nil {
		return nil, err
	}
	err = db.Where("user_id = ? AND project_id = ? AND episode_id = ?", userID, projectID, episodeID).Order("position ASC, id ASC").Find(&clips).Error
	return clips, err
}

func ReorderDramaClips(userID, projectID, episodeID string, order []model.DramaClipOrder, updatedAt string) ([]model.DramaClip, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	clips := []model.DramaClip{}
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := dramaEpisodeScope(tx, userID, projectID, episodeID); err != nil {
			return err
		}
		scope := func() *gorm.DB {
			return tx.Model(&model.DramaClip{}).Where("user_id = ? AND project_id = ? AND episode_id = ?", userID, projectID, episodeID)
		}
		var active []model.DramaClip
		if err := scope().Where("archived = ?", false).Find(&active).Error; err != nil {
			return err
		}
		if len(active) != len(order) {
			return ErrDramaRevisionConflict
		}
		versions := map[string]int64{}
		for _, clip := range active {
			versions[clip.ID] = clip.Revision
		}
		for _, item := range order {
			if revision, ok := versions[item.ID]; !ok || revision != item.ExpectedRevision {
				return ErrDramaRevisionConflict
			}
			delete(versions, item.ID)
		}
		for i, item := range order {
			result := scope().Where("id = ? AND revision = ? AND archived = ?", item.ID, item.ExpectedRevision, false).Updates(map[string]any{"position": i + 1, "revision": item.ExpectedRevision + 1, "updated_at": updatedAt})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return ErrDramaRevisionConflict
			}
		}
		return scope().Order("position ASC, id ASC").Find(&clips).Error
	})
	return clips, err
}

func CreateDramaClip(clip model.DramaClip) (model.DramaClip, error) {
	db, err := DB()
	if err != nil {
		return clip, err
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := dramaEpisodeScope(tx, clip.UserID, clip.ProjectID, clip.EpisodeID); err != nil {
			return err
		}
		var last int
		if err := tx.Model(&model.DramaClip{}).Where("user_id = ? AND project_id = ? AND episode_id = ?", clip.UserID, clip.ProjectID, clip.EpisodeID).Select("COALESCE(MAX(position), 0)").Scan(&last).Error; err != nil {
			return err
		}
		clip.Position = last + 1
		return tx.Create(&clip).Error
	})
	return clip, err
}

func UpdateDramaClip(userID, projectID, episodeID, id string, revision int64, values map[string]any) (model.DramaClip, error) {
	db, err := DB()
	if err != nil {
		return model.DramaClip{}, err
	}
	var clip model.DramaClip
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := dramaEpisodeScope(tx, userID, projectID, episodeID); err != nil {
			return err
		}
		if err := tx.Where("user_id = ? AND project_id = ? AND episode_id = ? AND id = ?", userID, projectID, episodeID, id).First(&clip).Error; err != nil {
			return err
		}
		values["revision"] = revision + 1
		result := tx.Model(&model.DramaClip{}).Where("user_id = ? AND project_id = ? AND episode_id = ? AND id = ? AND revision = ?", userID, projectID, episodeID, id, revision).Updates(values)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrDramaRevisionConflict
		}
		return tx.Where("user_id = ? AND project_id = ? AND episode_id = ? AND id = ?", userID, projectID, episodeID, id).First(&clip).Error
	})
	return clip, err
}
