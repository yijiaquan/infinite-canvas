package repository

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const dramaRunPublicColumns = "id, request_id, project_id, episode_id, clip_id, node_id, kind, status, upstream_id, snapshot, outputs, error, credits, created_at, updated_at"

func ListDramaEpisodeRuns(userID, p, e string) ([]model.DramaRun, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if err = dramaEpisodeScope(db, userID, p, e); err != nil {
		return nil, err
	}
	runs := []model.DramaRun{}
	err = db.Select(dramaRunPublicColumns).Where("user_id = ? AND project_id = ? AND episode_id = ?", userID, p, e).Order("created_at DESC,id DESC").Find(&runs).Error
	return runs, err
}
func ValidateDramaRunNode(userID, p, e, c, nodeID, kind string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	var clip model.DramaClip
	if err = db.Where("user_id = ? AND project_id = ? AND episode_id = ? AND id = ? AND archived = ?", userID, p, e, c, false).First(&clip).Error; err != nil {
		return err
	}
	var episode model.DramaEpisode
	if err = db.First(&episode, "id = ? AND user_id = ? AND project_id = ?", e, userID, p).Error; err != nil {
		return err
	}
	var canvas model.CanvasProject
	if err = db.First(&canvas, "id = ? AND user_id = ?", episode.CanvasID, userID).Error; err != nil {
		return err
	}
	var document struct {
		Nodes []struct {
			ID       string
			Type     string
			Metadata struct {
				DramaClipID string
				DramaRole   string
			}
		}
	}
	if err = json.Unmarshal([]byte(canvas.ProjectData), &document); err != nil {
		return err
	}
	role := "storyboard"
	if kind == "video" {
		role = "video"
	}
	for _, n := range document.Nodes {
		if n.ID == nodeID && n.Type == kind && n.Metadata.DramaClipID == c && n.Metadata.DramaRole == role {
			return nil
		}
	}
	return errors.New("节点不属于当前正式集的 Clip，请先保存画布")
}

func DramaRunScope(userID, projectID, episodeID, clipID string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	if err = dramaEpisodeScope(db, userID, projectID, episodeID); err != nil {
		return err
	}
	var clip model.DramaClip
	return db.Where("user_id = ? AND project_id = ? AND episode_id = ? AND id = ?", userID, projectID, episodeID, clipID).First(&clip).Error
}
func FindDramaRunRequest(userID, requestID string) (model.DramaRun, error) {
	db, err := DB()
	if err != nil {
		return model.DramaRun{}, err
	}
	var run model.DramaRun
	err = db.Where("user_id = ? AND request_id = ?", userID, requestID).First(&run).Error
	return run, err
}
func CreateDramaRun(run model.DramaRun) (model.DramaRun, error) {
	db, err := DB()
	if err != nil {
		return run, err
	}
	if err = DramaRunScope(run.UserID, run.ProjectID, run.EpisodeID, run.ClipID); err != nil {
		return run, err
	}
	err = db.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "user_id"}, {Name: "request_id"}}, DoNothing: true}).Create(&run).Error
	if err != nil {
		return run, err
	}
	saved, err := FindDramaRunRequest(run.UserID, run.RequestID)
	if err == nil && (saved.ProjectID != run.ProjectID || saved.EpisodeID != run.EpisodeID || saved.ClipID != run.ClipID || saved.NodeID != run.NodeID || saved.Kind != run.Kind || saved.Provider != run.Provider) {
		return model.DramaRun{}, errors.New("请求 ID 已用于其他任务")
	}
	return saved, err
}
func ListDramaRuns(userID, projectID, episodeID, clipID string) ([]model.DramaRun, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if err = DramaRunScope(userID, projectID, episodeID, clipID); err != nil {
		return nil, err
	}
	runs := []model.DramaRun{}
	err = db.Select(dramaRunPublicColumns).Where("user_id = ? AND project_id = ? AND episode_id = ? AND clip_id = ?", userID, projectID, episodeID, clipID).Order("created_at DESC,id DESC").Find(&runs).Error
	return runs, err
}
func ChangeDramaRun(id string, states []string, values map[string]any) (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	values["updated_at"] = time.Now().UTC().Format(time.RFC3339Nano)
	r := db.Model(&model.DramaRun{}).Where("id = ? AND status IN ?", id, states).Updates(values)
	return r.RowsAffected == 1, r.Error
}
func RecoverDramaRuns() error {
	db, err := DB()
	if err != nil {
		return err
	}
	if err = db.Model(&model.DramaRun{}).Where("status = ?", "preparing").Update("status", "queued").Error; err != nil {
		return err
	}
	return db.Model(&model.DramaRun{}).Where("status = ?", "submitting").Updates(map[string]any{"status": "unknown", "error": "服务中断时提交结果未确认，请核查，不要重复提交"}).Error
}
func PendingDramaRuns() ([]model.DramaRun, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	runs := []model.DramaRun{}
	err = db.Where("status IN ?", []string{"queued", "preparing", "submitting", "running", "saving"}).Order("CASE WHEN status = 'queued' THEN 1 ELSE 0 END, created_at ASC,id ASC").Find(&runs).Error
	return runs, err
}
func ClaimDramaRun(id string) (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	claimed := false
	err = db.Transaction(func(tx *gorm.DB) error {
		var run model.DramaRun
		if err := tx.Where("id = ? AND status = ?", id, "queued").First(&run).Error; err != nil {
			return err
		}
		var active int64
		if err := tx.Model(&model.DramaRun{}).Where("concurrency_key = ? AND status IN ?", run.ConcurrencyKey, []string{"preparing", "submitting", "running", "unknown"}).Count(&active).Error; err != nil {
			return err
		}
		if active >= int64(run.ConcurrencyLimit) {
			return nil
		}
		r := tx.Model(&model.DramaRun{}).Where("id = ? AND status = ?", id, "queued").Update("status", "preparing")
		claimed = r.RowsAffected == 1
		return r.Error
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return claimed, err
}

// The debit and dispatch marker commit together; a restart never charges or submits this row twice.
func StartDramaRunSubmission(run model.DramaRun) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error {
		r := tx.Model(&model.DramaRun{}).Where("id = ? AND status = ?", run.ID, "preparing").Update("status", "submitting")
		if r.Error != nil {
			return r.Error
		}
		if r.RowsAffected != 1 {
			return errors.New("任务已变更")
		}
		if run.Credits <= 0 {
			return nil
		}
		r = tx.Model(&model.User{}).Where("id = ? AND credits >= ?", run.UserID, run.Credits).Update("credits", gorm.Expr("credits - ?", run.Credits))
		if r.Error != nil {
			return r.Error
		}
		if r.RowsAffected != 1 {
			return errors.New("算力点不足")
		}
		var user model.User
		if err := tx.First(&user, "id = ?", run.UserID).Error; err != nil {
			return err
		}
		return tx.Create(&model.CreditLog{ID: uuid.NewString(), UserID: run.UserID, Type: model.CreditLogTypeAIConsume, Amount: -run.Credits, Balance: user.Credits, RelatedID: run.ID, Remark: "漫剧生成", CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}).Error
	})
}
