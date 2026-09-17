package repository

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"sort"
)

func ListDramaAdoptions(user, project, episode, clip string) ([]model.DramaAdoption, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if err = dramaEpisodeScope(db, user, project, episode); err != nil {
		return nil, err
	}
	rows := []model.DramaAdoption{}
	err = db.Transaction(func(tx *gorm.DB) error {
		scoped := tx.Where("user_id = ? AND project_id = ? AND episode_id = ?", user, project, episode)
		if clip != "" {
			scoped = scoped.Where("clip_id = ?", clip)
		}
		if err := scoped.Find(&rows).Error; err != nil {
			return err
		}
		for i := range rows {
			fingerprint, err := dramaAdoptionFingerprint(tx, rows[i])
			if err != nil {
				return err
			}
			rows[i].NeedsReview = rows[i].ContentFingerprint == "" || rows[i].ContentFingerprint != fingerprint
		}
		return nil
	})
	return rows, err
}

func SaveDramaAdoption(value model.DramaAdoption, expected int64) (model.DramaAdoption, error) {
	db, err := DB()
	if err != nil {
		return value, err
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		var clip model.DramaClip
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND user_id = ? AND project_id = ? AND episode_id = ?", value.ClipID, value.UserID, value.ProjectID, value.EpisodeID).First(&clip).Error; err != nil {
			return err
		}
		if clip.Archived || clip.Revision != value.ClipRevision {
			return ErrDramaRevisionConflict
		}
		fingerprint, err := dramaAdoptionFingerprint(tx, value)
		if err != nil {
			return err
		}
		value.ContentFingerprint = fingerprint
		var current model.DramaAdoption
		err = tx.Where("user_id = ? AND clip_id = ? AND kind = ?", value.UserID, value.ClipID, value.Kind).First(&current).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if expected != 0 {
				return ErrDramaRevisionConflict
			}
			value.Revision = 1
			return tx.Create(&value).Error
		}
		if err != nil {
			return err
		}
		value.ID = current.ID
		value.Revision = expected + 1
		result := tx.Model(&model.DramaAdoption{}).Where("id = ? AND revision = ?", current.ID, expected).Updates(map[string]any{"run_id": value.RunID, "storage_id": value.StorageID, "clip_revision": value.ClipRevision, "content_fingerprint": value.ContentFingerprint, "revision": value.Revision, "updated_at": value.UpdatedAt})
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

// SaveLatestDramaAdoption advances the current pick without requiring a browser-side
// revision. It is reserved for the durable run worker after a new media result exists.
func SaveLatestDramaAdoption(value model.DramaAdoption) (model.DramaAdoption, error) {
	db, err := DB()
	if err != nil {
		return value, err
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		var clip model.DramaClip
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND user_id = ? AND project_id = ? AND episode_id = ?", value.ClipID, value.UserID, value.ProjectID, value.EpisodeID).First(&clip).Error; err != nil {
			return err
		}
		if clip.Archived || clip.Revision != value.ClipRevision {
			return ErrDramaRevisionConflict
		}
		fingerprint, err := dramaAdoptionFingerprint(tx, value)
		if err != nil {
			return err
		}
		value.ContentFingerprint = fingerprint
		var current model.DramaAdoption
		err = tx.Where("user_id = ? AND clip_id = ? AND kind = ?", value.UserID, value.ClipID, value.Kind).First(&current).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			value.Revision = 1
			return tx.Create(&value).Error
		}
		if err != nil {
			return err
		}
		value.ID = current.ID
		value.Revision = current.Revision + 1
		result := tx.Model(&model.DramaAdoption{}).Where("id = ? AND revision = ?", current.ID, current.Revision).Updates(map[string]any{"run_id": value.RunID, "storage_id": value.StorageID, "clip_revision": value.ClipRevision, "content_fingerprint": value.ContentFingerprint, "revision": value.Revision, "updated_at": value.UpdatedAt})
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

type dramaFingerprintNode struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Metadata map[string]any `json:"metadata"`
}
type dramaFingerprintCanvas struct {
	Nodes       []dramaFingerprintNode `json:"nodes"`
	Connections []struct {
		FromNodeID string `json:"fromNodeId"`
		ToNodeID   string `json:"toNodeId"`
	} `json:"connections"`
}

var dramaGenerationKeys = []string{"prompt", "composerContent", "excludeUpstreamText", "generationMode", "generationType", "model", "channelId", "size", "quality", "count", "seconds", "vquality", "mode", "negativePrompt", "generateAudio", "characterOrientation", "watermark", "references", "firstFrameNodeId", "lastFrameNodeId", "referenceAudioNodeId", "multiShot", "shotType", "klingImageNodeIds", "klingMultiPrompt", "klingElementList", "cameraControl", "seed", "steps", "apiMode", "resolution_name", "output_format", "response_format", "dramaParameters"}

func dramaNodeGenerationInput(node dramaFingerprintNode) map[string]any {
	result := map[string]any{"id": node.ID, "type": node.Type}
	for _, key := range dramaGenerationKeys {
		if value, ok := node.Metadata[key]; ok {
			result[key] = value
		}
	}
	return result
}
func dramaReferenceContent(node dramaFingerprintNode) map[string]any {
	result := dramaNodeGenerationInput(node)
	for _, key := range []string{"dramaAssetVersionId", "dramaInputRole", "dramaInputOrder", "dramaBindingTarget"} {
		if value, ok := node.Metadata[key]; ok {
			result[key] = value
		}
	}
	// Persistent storage identity wins over interchangeable preview/blob URLs.
	if storage, ok := node.Metadata["storageKey"].(string); ok && storage != "" {
		result["storageKey"] = storage
	} else if content, ok := node.Metadata["content"]; ok {
		result["content"] = content
	}
	return result
}
func dramaAdoptionFingerprint(tx *gorm.DB, value model.DramaAdoption) (string, error) {
	var clip model.DramaClip
	if err := tx.Where("id = ? AND user_id = ? AND project_id = ? AND episode_id = ?", value.ClipID, value.UserID, value.ProjectID, value.EpisodeID).First(&clip).Error; err != nil {
		return "", err
	}
	state := map[string]any{"version": 1, "clip": map[string]any{"scene": clip.Scene, "summary": clip.Summary, "entryState": clip.EntryState, "exitState": clip.ExitState, "shots": clip.Shots}, "archived": clip.Archived, "kind": value.Kind}
	var project model.DramaProject
	if err := tx.Where("id = ? AND user_id = ?", value.ProjectID, value.UserID).First(&project).Error; err != nil {
		return "", err
	}
	state["projectDefaults"] = project.GenerationDefaults[value.Kind]
	stage := "storyboard"
	if value.Kind == "video" {
		var boardBinding model.DramaBinding
		bindingErr := tx.Where("user_id = ? AND project_id = ? AND episode_id = ? AND clip_id = ? AND stage = ?", value.UserID, value.ProjectID, value.EpisodeID, value.ClipID, "storyboard").First(&boardBinding).Error
		if bindingErr == nil {
			state["storyboardBinding"] = map[string]any{"revision": boardBinding.Revision, "references": boardBinding.References}
		} else if !errors.Is(bindingErr, gorm.ErrRecordNotFound) {
			return "", bindingErr
		}
		stage = "video"
	}
	var binding model.DramaBinding
	err := tx.Where("user_id = ? AND project_id = ? AND episode_id = ? AND clip_id = ? AND stage = ?", value.UserID, value.ProjectID, value.EpisodeID, value.ClipID, stage).First(&binding).Error
	if err == nil {
		state["binding"] = map[string]any{"revision": binding.Revision, "references": binding.References}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", err
	}
	if value.Kind == "video" {
		var board model.DramaAdoption
		err = tx.Where("user_id = ? AND project_id = ? AND episode_id = ? AND clip_id = ? AND kind = ?", value.UserID, value.ProjectID, value.EpisodeID, value.ClipID, "image").First(&board).Error
		if err == nil {
			state["adoptedStoryboard"] = board.StorageID
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return "", err
		}
	}
	var episode model.DramaEpisode
	if err = tx.Where("id = ? AND user_id = ? AND project_id = ?", value.EpisodeID, value.UserID, value.ProjectID).First(&episode).Error; err != nil {
		return "", err
	}
	state["canvasId"] = episode.CanvasID
	canvas := dramaFingerprintCanvas{}
	if episode.CanvasID != "" {
		var record model.CanvasProject
		err = tx.Where("id = ? AND user_id = ?", episode.CanvasID, value.UserID).First(&record).Error
		if err == nil {
			if err = json.Unmarshal([]byte(record.ProjectData), &canvas); err != nil {
				return "", err
			}
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return "", err
		}
	}
	sort.Slice(canvas.Nodes, func(i, j int) bool { return canvas.Nodes[i].ID < canvas.Nodes[j].ID })
	targets := map[string]bool{}
	inputs := []map[string]any{}
	for _, node := range canvas.Nodes {
		if node.Type == value.Kind && node.Metadata["dramaClipId"] == value.ClipID && node.Metadata["dramaRole"] == stage {
			targets[node.ID] = true
			inputs = append(inputs, dramaNodeGenerationInput(node))
		}
	}
	state["generationInputs"] = inputs
	upstream := map[string]bool{}
	edges := []string{}
	for _, edge := range canvas.Connections {
		if targets[edge.ToNodeID] {
			upstream[edge.FromNodeID] = true
			edges = append(edges, edge.FromNodeID+"=>"+edge.ToNodeID)
		}
	}
	sort.Strings(edges)
	state["inputEdges"] = edges
	references := []map[string]any{}
	for _, node := range canvas.Nodes {
		if upstream[node.ID] {
			references = append(references, dramaReferenceContent(node))
		}
	}
	state["references"] = references
	raw, err := json.Marshal(state)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}
