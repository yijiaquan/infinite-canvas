package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"github.com/tigerowo/infinite-canvas/config"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestDramaAdoptionReviewTracksInputsNotLayout(t *testing.T) {
	if os.Getenv("DRAMA_REVIEW_TEST_DIR") == "" {
		cmd := exec.Command(os.Args[0], "-test.run=^TestDramaAdoptionReviewTracksInputsNotLayout$", "-test.v")
		cmd.Env = append(os.Environ(), "DRAMA_REVIEW_TEST_DIR="+t.TempDir())
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("%v\n%s", err, out)
		}
		return
	}
	dir := os.Getenv("DRAMA_REVIEW_TEST_DIR")
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	config.Cfg.StorageDriver = "sqlite"
	config.Cfg.DatabaseDSN = filepath.Join(dir, "review.db")
	db, err := repository.DB()
	if err != nil {
		t.Fatal(err)
	}
	if err = db.AutoMigrate(&model.DramaAdoption{}); err != nil {
		t.Fatal(err)
	}
	board := map[string]any{"id": "board", "type": "image", "title": "Board", "position": map[string]any{"x": 0, "y": 0}, "metadata": map[string]any{"dramaClipId": "c", "dramaRole": "storyboard", "prompt": "board prompt", "storageKey": "server:board-source", "content": "preview-url"}}
	video := map[string]any{"id": "video", "type": "video", "metadata": map[string]any{"dramaClipId": "c", "dramaRole": "video", "prompt": "video prompt", "model": "h3", "channelId": "local"}}
	canvas := map[string]any{"id": "canvas", "nodes": []any{board, video}, "connections": []any{map[string]any{"id": "edge", "fromNodeId": "board", "toNodeId": "video"}}}
	raw, _ := json.Marshal(canvas)
	for _, item := range []any{&model.DramaProject{ID: "p", UserID: "u"}, &model.DramaEpisode{ID: "e", UserID: "u", ProjectID: "p", CanvasID: "canvas"}, &model.DramaClip{ID: "c", UserID: "u", ProjectID: "p", EpisodeID: "e", Revision: 1, Title: "Clip", Position: 1, Shots: []model.DramaShot{{ID: "s", Duration: 1}}}, &model.CanvasProject{ID: "canvas", UserID: "u", ProjectData: string(raw)}} {
		if err = db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}
	ctx := WithUser(context.Background(), model.AuthUser{ID: "u"})
	videoBytes := append([]byte{0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'}, make([]byte, 100)...)
	media, err := UploadDramaMedia(ctx, bytes.NewReader(videoBytes), "video/mp4")
	if err != nil {
		t.Fatal(err)
	}
	run, err := ImportDramaOutput(ctx, "p", "e", "c", DramaImportOutputInput{RequestID: "video", Kind: "video", StorageID: media.ID, SourceKey: "legacy:video", ClipRevision: 1})
	if err != nil {
		t.Fatal(err)
	}
	videoPick, err := AdoptDramaOutput(ctx, "p", "e", "c", DramaAdoptionInput{RunID: run.ID, StorageID: media.ID, ClipRevision: 1})
	if err != nil {
		t.Fatal(err)
	}
	assertReview := func(kind string, want bool) {
		t.Helper()
		rows, err := CurrentDramaAdoptions(ctx, "p", "e", "c")
		if err != nil {
			t.Fatal(err)
		}
		for _, row := range rows {
			if row.Kind == kind {
				if row.NeedsReview != want {
					t.Fatalf("%s review=%v want=%v", kind, row.NeedsReview, want)
				}
				return
			}
		}
		t.Fatalf("%s adoption missing", kind)
	}
	saveCanvas := func() {
		t.Helper()
		raw, _ := json.Marshal(canvas)
		if err = db.Model(&model.CanvasProject{}).Where("id = ?", "canvas").Update("project_data", string(raw)).Error; err != nil {
			t.Fatal(err)
		}
	}
	readoptVideo := func() {
		t.Helper()
		var err error
		videoPick, err = AdoptDramaOutput(ctx, "p", "e", "c", DramaAdoptionInput{RunID: run.ID, StorageID: media.ID, ClipRevision: 1, ExpectedRevision: videoPick.Revision})
		if err != nil {
			t.Fatal(err)
		}
		assertReview("video", false)
	}
	assertReview("video", false)
	board["title"] = "Renamed"
	board["position"] = map[string]any{"x": 123, "y": 456}
	board["width"] = 999
	boardMeta := board["metadata"].(map[string]any)
	videoMeta := video["metadata"].(map[string]any)
	boardMeta["content"] = "blob:new-preview"
	boardMeta["status"] = "loading"
	boardMeta["progress"] = 30
	videoMeta["content"] = "new-output"
	videoMeta["storageKey"] = "server:new-video-output"
	videoMeta["dramaRunId"] = "new-candidate"
	saveCanvas()
	assertReview("video", false)
	videoMeta["prompt"] = "changed video prompt"
	saveCanvas()
	assertReview("video", true)
	if file, err := ExportDramaEpisode(ctx, "p", "e", false); err == nil {
		file.Close()
		os.Remove(file.Name())
		t.Fatal("changed prompt exported without review")
	}
	readoptVideo()
	videoMeta["seconds"] = "7.5"
	saveCanvas()
	assertReview("video", true)
	readoptVideo()
	binding := model.DramaBinding{ID: "binding", UserID: "u", ProjectID: "p", EpisodeID: "e", ClipID: "c", Stage: "video", Revision: 1, References: []model.DramaBindingReference{{AssetID: "asset", VersionID: "v1", Role: "character", Order: 0}}}
	if err = db.Create(&binding).Error; err != nil {
		t.Fatal(err)
	}
	assertReview("video", true)
	readoptVideo()
	if err = db.Model(&binding).Updates(map[string]any{"revision": 2, "references": `[{"assetId":"asset","versionId":"v2","role":"character","order":0}]`}).Error; err != nil {
		t.Fatal(err)
	}
	assertReview("video", true)
	readoptVideo()
	boardMeta["storageKey"] = "server:another-storyboard"
	saveCanvas()
	assertReview("video", true)
	readoptVideo()
	png, _ := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=")
	image, err := UploadDramaMedia(ctx, bytes.NewReader(png), "image/png")
	if err != nil {
		t.Fatal(err)
	}
	imageRun, err := ImportDramaOutput(ctx, "p", "e", "c", DramaImportOutputInput{RequestID: "image", Kind: "image", StorageID: image.ID, SourceKey: "legacy:image", ClipRevision: 1})
	if err != nil {
		t.Fatal(err)
	}
	imagePick, err := AdoptDramaOutput(ctx, "p", "e", "c", DramaAdoptionInput{RunID: imageRun.ID, StorageID: image.ID, ClipRevision: 1})
	if err != nil {
		t.Fatal(err)
	}
	assertReview("video", true)
	assertReview("image", false)
	boardMeta["storageKey"] = "server:" + image.ID
	boardMeta["content"] = image.URL
	saveCanvas()
	assertReview("image", false)
	readoptVideo()
	// A no-op explicit re-adoption of the same board does not invalidate the video.
	_, err = AdoptDramaOutput(ctx, "p", "e", "c", DramaAdoptionInput{RunID: imageRun.ID, StorageID: image.ID, ClipRevision: 1, ExpectedRevision: imagePick.Revision})
	if err != nil {
		t.Fatal(err)
	}
	assertReview("video", false)
	if err = db.Model(&model.DramaProject{}).Where("id = ?", "p").Update("generation_defaults", `{"video":{"steps":12}}`).Error; err != nil {
		t.Fatal(err)
	}
	assertReview("video", true)
	readoptVideo()
	videoMeta["dramaParameters"] = map[string]any{"steps": 13}
	saveCanvas()
	assertReview("video", true)
	readoptVideo()
	boardMeta["prompt"] = "new board prompt"
	saveCanvas()
	assertReview("image", true)
	assertReview("video", true)
	boardMeta["prompt"] = "board prompt"
	saveCanvas()
	assertReview("image", false)
	assertReview("video", false)
	if err = db.Model(&model.DramaClip{}).Where("id = ?", "c").Updates(map[string]any{"revision": 2, "position": 9, "title": "Display rename"}).Error; err != nil {
		t.Fatal(err)
	}
	assertReview("image", false)
	assertReview("video", false)
	exported, err := ExportDramaEpisode(ctx, "p", "e", false)
	if err != nil {
		t.Fatalf("cosmetic clip change blocked export: %v", err)
	}
	exported.Close()
	os.Remove(exported.Name())
	if err = db.Model(&model.DramaClip{}).Where("id = ?", "c").Updates(map[string]any{"revision": 3, "summary": "Changed story action"}).Error; err != nil {
		t.Fatal(err)
	}
	assertReview("image", true)
	assertReview("video", true)
}
