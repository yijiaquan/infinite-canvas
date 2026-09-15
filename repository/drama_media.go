package repository

import (
	"errors"
	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
)

func DramaStorageReferenced(id string) (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	var count int64
	if err = db.Model(&model.DramaAssetVersion{}).Where("storage_id = ?", id).Count(&count).Error; err != nil {
		return false, err
	}
	if count > 0 {
		return true, nil
	}
	if err = db.Model(&model.DramaAdoption{}).Where("storage_id = ?", id).Count(&count).Error; err != nil {
		return false, err
	}
	if count > 0 {
		return true, nil
	}
	var runs []model.DramaRun
	found := errors.New("reference found")
	err = db.Select("id", "outputs", "snapshot").FindInBatches(&runs, 128, func(_ *gorm.DB, _ int) error {
		for _, run := range runs {
			for _, output := range run.Outputs {
				if output.StorageID == id {
					return found
				}
			}
			for _, input := range run.Snapshot.References {
				if input.StorageID == id {
					return found
				}
			}
		}
		return nil
	}).Error
	if errors.Is(err, found) {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	return false, nil
}
