package repository

import (
	"errors"
	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
)

var ErrDramaRevisionConflict = errors.New("drama revision conflict")

func FindDramaEpisodeByCanvas(userID, canvasID string) (*model.DramaEpisode, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var episode model.DramaEpisode
	err = db.Where("user_id = ? AND canvas_id = ?", userID, canvasID).First(&episode).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &episode, err
}

func HasDramaEpisodeCanvases(userID string, ids []string) (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	var count int64
	err = db.Model(&model.DramaEpisode{}).Where("user_id = ? AND canvas_id IN ?", userID, ids).Count(&count).Error
	return count > 0, err
}

func ListDramaProjects(userID string) ([]model.DramaProject, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	items := []model.DramaProject{}
	err = db.Where("user_id = ?", userID).Order("updated_at DESC, id ASC").Find(&items).Error
	return items, err
}

func GetDramaProject(userID, id string) (model.DramaProject, []model.DramaEpisode, error) {
	db, err := DB()
	if err != nil {
		return model.DramaProject{}, nil, err
	}
	var project model.DramaProject
	episodes := []model.DramaEpisode{}
	err = db.Where("user_id = ? AND id = ?", userID, id).First(&project).Error
	if err == nil {
		err = db.Where("user_id = ? AND project_id = ?", userID, id).Order("position ASC, id ASC").Find(&episodes).Error
	}
	return project, episodes, err
}

func CreateDramaProject(project model.DramaProject) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Create(&project).Error
}

func UpdateDramaProject(userID, id string, revision int64, values map[string]any) (model.DramaProject, error) {
	db, err := DB()
	if err != nil {
		return model.DramaProject{}, err
	}
	var project model.DramaProject
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND id = ?", userID, id).First(&project).Error; err != nil {
			return err
		}
		values["revision"] = revision + 1
		result := tx.Model(&model.DramaProject{}).Where("user_id = ? AND id = ? AND revision = ?", userID, id, revision).Updates(values)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrDramaRevisionConflict
		}
		return tx.Where("user_id = ? AND id = ?", userID, id).First(&project).Error
	})
	return project, err
}

func CreateDramaEpisode(episode model.DramaEpisode, canvas model.CanvasProject) (model.DramaEpisode, error) {
	db, err := DB()
	if err != nil {
		return episode, err
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		var project model.DramaProject
		if err := tx.Where("user_id = ? AND id = ?", episode.UserID, episode.ProjectID).First(&project).Error; err != nil {
			return err
		}
		var last int
		if err := tx.Model(&model.DramaEpisode{}).Where("user_id = ? AND project_id = ?", episode.UserID, episode.ProjectID).Select("COALESCE(MAX(position), 0)").Scan(&last).Error; err != nil {
			return err
		}
		episode.Position = last + 1
		if err := tx.Create(&canvas).Error; err != nil {
			return err
		}
		return tx.Create(&episode).Error
	})
	return episode, err
}

func UpdateDramaEpisode(userID, projectID, id string, revision int64, values map[string]any) (model.DramaEpisode, error) {
	db, err := DB()
	if err != nil {
		return model.DramaEpisode{}, err
	}
	var episode model.DramaEpisode
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND project_id = ? AND id = ?", userID, projectID, id).First(&episode).Error; err != nil {
			return err
		}
		values["revision"] = revision + 1
		result := tx.Model(&model.DramaEpisode{}).Where("user_id = ? AND project_id = ? AND id = ? AND revision = ?", userID, projectID, id, revision).Updates(values)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrDramaRevisionConflict
		}
		return tx.Where("user_id = ? AND project_id = ? AND id = ?", userID, projectID, id).First(&episode).Error
	})
	return episode, err
}
