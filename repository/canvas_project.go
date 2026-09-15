package repository

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrDramaCanvasRevisionConflict = errors.New("drama canvas revision conflict")

func saveDramaCanvasProject(db *gorm.DB, project model.CanvasProject) (model.CanvasProject, error) {
	err := db.Transaction(func(tx *gorm.DB) error {
		var current model.CanvasProject
		if err := tx.First(&current, "user_id = ? AND id = ?", project.UserID, project.ID).Error; err != nil {
			return err
		}
		var data map[string]json.RawMessage
		if err := json.Unmarshal([]byte(project.ProjectData), &data); err != nil || data == nil {
			return ErrDramaCanvasRevisionConflict
		}
		var expected int64
		if raw, exists := data["dramaRevision"]; exists {
			if string(raw) == "null" || json.Unmarshal(raw, &expected) != nil {
				return ErrDramaCanvasRevisionConflict
			}
		}
		if current.DeletedAt != "" || expected < 0 || expected != current.DramaRevision {
			return ErrDramaCanvasRevisionConflict
		}
		project.DramaRevision = current.DramaRevision + 1
		data["dramaRevision"], _ = json.Marshal(project.DramaRevision)
		raw, err := json.Marshal(data)
		if err != nil {
			return err
		}
		project.ProjectData = string(raw)
		project.CreatedAt = current.CreatedAt
		result := tx.Model(&model.CanvasProject{}).
			Where("user_id = ? AND id = ? AND deleted_at = '' AND drama_revision = ?", project.UserID, project.ID, expected).
			Updates(map[string]any{"project_data": project.ProjectData, "updated_at": project.UpdatedAt, "drama_revision": project.DramaRevision})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrDramaCanvasRevisionConflict
		}
		return nil
	})
	return project, err
}

func ListUserCanvasProjects(userID string) ([]model.CanvasProject, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}

	var projects []model.CanvasProject
	err = db.Where(
		"user_id = ? AND deleted_at = ''",
		strings.TrimSpace(userID),
	).Order("updated_at DESC").Find(&projects).Error
	return projects, err
}

func SaveUserCanvasProject(
	project model.CanvasProject,
) (model.CanvasProject, error) {
	db, err := DB()
	if err != nil {
		return project, err
	}

	project.UserID = strings.TrimSpace(project.UserID)
	project.ID = strings.TrimSpace(project.ID)
	var episodeCount int64
	if err := db.Model(&model.DramaEpisode{}).Where("user_id = ? AND canvas_id = ?", project.UserID, project.ID).Count(&episodeCount).Error; err != nil {
		return project, err
	}
	if episodeCount > 0 {
		return saveDramaCanvasProject(db, project)
	}

	var current model.CanvasProject
	err = db.First(
		&current,
		"user_id = ? AND id = ?",
		project.UserID,
		project.ID,
	).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return project, db.Create(&project).Error
	}
	if err != nil {
		return project, err
	}
	if current.DeletedAt != "" || current.UpdatedAt > project.UpdatedAt {
		return current, nil
	}

	result := db.Model(&model.CanvasProject{}).
		Where(
			"user_id = ? AND id = ? AND deleted_at = '' AND updated_at <= ?",
			project.UserID,
			project.ID,
			project.UpdatedAt,
		).
		Updates(map[string]any{
			"project_data": project.ProjectData,
			"updated_at":   project.UpdatedAt,
		})
	if result.Error != nil {
		return project, result.Error
	}
	if result.RowsAffected == 0 {
		if err := db.First(
			&current,
			"user_id = ? AND id = ?",
			project.UserID,
			project.ID,
		).Error; err != nil {
			return project, err
		}
		return current, nil
	}
	return project, nil
}

func SaveUserCanvasProjects(
	userID string,
	projects []model.CanvasProject,
) ([]model.CanvasProject, error) {
	for _, project := range projects {
		project.UserID = userID
		if _, err := SaveUserCanvasProject(project); err != nil {
			return nil, err
		}
	}
	return ListUserCanvasProjects(userID)
}

func SoftDeleteUserCanvasProjects(
	userID string,
	ids []string,
	deletedAt string,
) error {
	ids = uniqueTrimmedValues(ids...)
	if len(ids) == 0 {
		return nil
	}

	db, err := DB()
	if err != nil {
		return err
	}

	records := make([]model.CanvasProject, 0, len(ids))
	for _, id := range ids {
		records = append(records, model.CanvasProject{
			UserID:    strings.TrimSpace(userID),
			ID:        id,
			CreatedAt: deletedAt,
			UpdatedAt: deletedAt,
			DeletedAt: deletedAt,
		})
	}

	return db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "id"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"project_data",
			"updated_at",
			"deleted_at",
		}),
	}).Create(&records).Error
}

func CleanupDeletedCanvasProjects(before string) error {
	db, err := DB()
	if err != nil {
		return err
	}

	return db.Where(
		"deleted_at <> '' AND deleted_at < ?",
		before,
	).Delete(&model.CanvasProject{}).Error
}
