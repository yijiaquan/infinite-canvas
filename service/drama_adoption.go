package service

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

type DramaAdoptionInput struct {
	RunID            string `json:"runId"`
	StorageID        string `json:"storageId"`
	ExpectedRevision int64  `json:"expectedRevision"`
	ClipRevision     int64  `json:"clipRevision"`
}

func CurrentDramaAdoptions(ctx context.Context, p, e, c string) ([]model.DramaAdoption, error) {
	u, err := dramaUser(ctx)
	if err != nil {
		return nil, err
	}
	return repository.ListDramaAdoptions(u, p, e, c)
}
func AdoptDramaOutput(ctx context.Context, p, e, c string, input DramaAdoptionInput) (model.DramaAdoption, error) {
	u, err := dramaUser(ctx)
	if err != nil {
		return model.DramaAdoption{}, err
	}
	run, err := CurrentDramaRun(ctx, p, e, c, input.RunID)
	if err != nil {
		return model.DramaAdoption{}, err
	}
	if run.Status != "completed" {
		return model.DramaAdoption{}, errors.New("只能采用已完成且已保存的候选")
	}
	found := false
	for _, output := range run.Outputs {
		if output.StorageID == input.StorageID {
			found = true
		}
	}
	if !found {
		return model.DramaAdoption{}, errors.New("候选不属于该次生成")
	}
	object, err := repository.GetStorageObject(input.StorageID)
	if err != nil || object.CreatedBy != u || object.DeletedAt != "" {
		return model.DramaAdoption{}, errors.New("采用媒体不存在")
	}
	if !strings.HasPrefix(object.MimeType, run.Kind+"/") {
		return model.DramaAdoption{}, errors.New("候选媒体类型不匹配")
	}
	value := model.DramaAdoption{ID: uuid.NewString(), UserID: u, ProjectID: p, EpisodeID: e, ClipID: c, Kind: run.Kind, RunID: run.ID, StorageID: input.StorageID, ClipRevision: input.ClipRevision, UpdatedAt: now()}
	value, err = repository.SaveDramaAdoption(value, input.ExpectedRevision)
	return value, dramaError(err)
}

func ExportDramaEpisode(ctx context.Context, p, e string, partial bool) (*os.File, error) {
	clips, err := CurrentUserDramaClips(ctx, p, e)
	if err != nil {
		return nil, err
	}
	adopted, err := CurrentDramaAdoptions(ctx, p, e, "")
	if err != nil {
		return nil, err
	}
	type entry struct {
		ClipID   string  `json:"clipId"`
		Title    string  `json:"title"`
		Position int     `json:"position"`
		Duration float64 `json:"duration"`
		File     string  `json:"file"`
		RunID    string  `json:"runId"`
		SHA256   string  `json:"sha256"`
		Missing  bool    `json:"missing"`
	}
	manifest := []entry{}
	sources := []DownloadedStorageObject{}
	defer func() {
		for _, source := range sources {
			_ = source.Stream.Close()
		}
	}()
	for _, clip := range clips {
		if clip.Archived {
			continue
		}
		var pick *model.DramaAdoption
		for i := range adopted {
			if adopted[i].ClipID == clip.ID && adopted[i].Kind == "video" {
				pick = &adopted[i]
				break
			}
		}
		duration := 0.0
		for _, shot := range clip.Shots {
			duration += shot.Duration
		}
		item := entry{ClipID: clip.ID, Title: clip.Title, Position: clip.Position, Duration: duration}
		if pick == nil || pick.NeedsReview {
			if !partial {
				return nil, fmt.Errorf("%s 缺少采用视频或修改后尚未复核", clip.Title)
			}
			item.Missing = true
			manifest = append(manifest, item)
			continue
		}
		source, err := DownloadStorageObject(pick.StorageID, "")
		if err != nil {
			return nil, fmt.Errorf("%s 媒体无法读取", clip.Title)
		}
		user, _ := dramaUser(ctx)
		if source.Object.CreatedBy != user || source.Object.DeletedAt != "" || !strings.HasPrefix(source.Object.MimeType, "video/") {
			_ = source.Stream.Close()
			return nil, errors.New("采用视频类型不正确")
		}
		sources = append(sources, source)
		item.File = fmt.Sprintf("%03d-%s%s", clip.Position, clip.ID, extensionForContentType(source.Object.MimeType))
		item.RunID = pick.RunID
		item.SHA256 = source.Object.SHA256
		manifest = append(manifest, item)
	}
	if len(sources) == 0 {
		return nil, errors.New("没有可导出的采用视频")
	}
	file, err := os.CreateTemp("", "drama-export-*.zip")
	if err != nil {
		return nil, err
	}
	complete := false
	defer func() {
		if !complete {
			_ = file.Close()
			_ = os.Remove(file.Name())
		}
	}()
	writer := zip.NewWriter(file)
	index := 0
	for i, item := range manifest {
		if item.Missing {
			continue
		}
		target, err := writer.Create(item.File)
		if err != nil {
			return nil, err
		}
		hash := sha256.New()
		if _, err = io.Copy(io.MultiWriter(target, hash), sources[index].Stream); err != nil {
			return nil, err
		}
		actual := hex.EncodeToString(hash.Sum(nil))
		if item.SHA256 != "" && item.SHA256 != actual {
			return nil, fmt.Errorf("%s 媒体校验失败", item.Title)
		}
		manifest[i].SHA256 = actual
		index++
	}
	target, err := writer.Create("manifest.json")
	if err != nil {
		return nil, err
	}
	if err = json.NewEncoder(target).Encode(manifest); err != nil {
		return nil, err
	}
	if err = writer.Close(); err != nil {
		return nil, err
	}
	if _, err = file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	complete = true
	return file, nil
}
