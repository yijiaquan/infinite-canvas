package service

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/tigerowo/infinite-canvas/config"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

func TestDramaBindingLifecycle(t *testing.T) {
	// 独立进程与临时数据库，不接触现有项目或媒体。
	if os.Getenv("DRAMA_BINDING_TEST_DATABASE") == "" {
		cmd := exec.Command(os.Args[0], "-test.run=^TestDramaBindingLifecycle$", "-test.v")
		cmd.Env = append(os.Environ(), "DRAMA_BINDING_TEST_DATABASE="+filepath.Join(t.TempDir(), "bindings.db"))
		if output, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v\n%s", err, output)
		}
		return
	}
	config.Cfg.StorageDriver = "sqlite"
	config.Cfg.DatabaseDSN = os.Getenv("DRAMA_BINDING_TEST_DATABASE")
	owner := WithUser(context.Background(), model.AuthUser{ID: "owner"})
	other := WithUser(context.Background(), model.AuthUser{ID: "other"})
	title := "Project"
	project, err := CreateCurrentUserDramaProject(owner, DramaProjectInput{Title: &title})
	if err != nil {
		t.Fatal(err)
	}
	episode, err := CreateCurrentUserDramaEpisode(owner, project.ID, DramaEpisodeInput{Title: &title})
	if err != nil {
		t.Fatal(err)
	}
	shots := []model.DramaShot{{ID: "shot", Duration: 3, Speaker: "Alice", Dialogue: "Hello"}}
	clip, err := CreateCurrentUserDramaClip(owner, project.ID, episode.ID, DramaClipInput{Title: &title, Shots: &shots})
	if err != nil {
		t.Fatal(err)
	}
	db, err := repository.DB()
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.DramaBinding{}, &model.DramaAsset{}, &model.DramaAssetVersion{}); err != nil {
		t.Fatal(err)
	}
	for _, item := range []struct{ id, mime, user, project string }{
		{"image", "image/png", "owner", project.ID}, {"audio", "audio/wav", "owner", project.ID}, {"video", "video/mp4", "owner", project.ID},
		{"foreign", "image/png", "other", project.ID}, {"elsewhere", "image/png", "owner", "another-project"},
	} {
		asset := model.DramaAsset{ID: item.id, UserID: item.user, ProjectID: item.project, Kind: "reference", Revision: 1, AdoptedVersionID: item.id + "-new"}
		storage := model.StorageObject{ID: item.id + "-storage", ObjectKey: item.id, CreatedBy: item.user, MimeType: item.mime}
		version := model.DramaAssetVersion{ID: item.id + "-version", AssetID: item.id, StorageID: storage.ID, MimeType: item.mime}
		for _, row := range []any{&asset, &storage, &version} {
			if err := db.Create(row).Error; err != nil {
				t.Fatal(err)
			}
		}
	}
	read := func(ctx context.Context, stage string) (model.DramaBinding, error) {
		return CurrentDramaBinding(ctx, project.ID, episode.ID, clip.ID, stage)
	}
	save := func(stage string, revision int64, refs ...model.DramaBindingReference) (model.DramaBinding, error) {
		return UpdateCurrentDramaBinding(owner, project.ID, episode.ID, clip.ID, stage, DramaBindingInput{ExpectedRevision: revision, References: refs})
	}
	image := model.DramaBindingReference{AssetID: "image", VersionID: "image-version", Role: "character", Order: 0}
	voice := model.DramaBindingReference{AssetID: "audio", VersionID: "audio-version", Role: "voice", Speaker: "Alice", Order: 1}
	empty, err := read(owner, "video")
	if err != nil || empty.Revision != 0 || empty.References == nil || len(empty.References) != 0 {
		t.Fatalf("empty: %+v %v", empty, err)
	}
	if _, err := read(other, "video"); err == nil {
		t.Fatal("foreign read accepted")
	}
	if _, err := read(context.Background(), "video"); err == nil {
		t.Fatal("anonymous read accepted")
	}
	if _, err := read(owner, "unknown"); err == nil {
		t.Fatal("invalid stage accepted")
	}
	if _, err := UpdateCurrentDramaBinding(other, project.ID, episode.ID, clip.ID, "video", DramaBindingInput{References: []model.DramaBindingReference{image}}); err == nil {
		t.Fatal("foreign write accepted")
	}
	if _, err := UpdateCurrentDramaBinding(owner, project.ID, "another-episode", clip.ID, "video", DramaBindingInput{References: []model.DramaBindingReference{image}}); err == nil {
		t.Fatal("wrong episode accepted")
	}
	for _, ref := range []model.DramaBindingReference{
		{AssetID: "foreign", VersionID: "foreign-version", Role: "reference"},
		{AssetID: "elsewhere", VersionID: "elsewhere-version", Role: "reference"},
		{AssetID: "image", VersionID: "audio-version", Role: "reference"},
		{AssetID: "audio", VersionID: "audio-version", Role: "reference"},
		{AssetID: "image", VersionID: "image-version", Role: "voice", Speaker: "Alice"},
		{AssetID: "audio", VersionID: "audio-version", Role: "voice", Speaker: "Bob"},
		{AssetID: "audio", VersionID: "audio-version", Role: "voice"},
		{AssetID: "image", VersionID: "image-version", Role: "invalid"},
		{AssetID: "image", VersionID: "image-version", Role: "reference", Order: 2},
	} {
		if _, err := save("video", 0, ref); err == nil {
			t.Fatalf("invalid reference accepted: %+v", ref)
		}
	}
	duplicate := image
	duplicate.Order = 1
	if _, err := save("video", 0, image, duplicate); err == nil {
		t.Fatal("duplicate reference accepted")
	}
	voiceOnly := voice
	voiceOnly.Order = 0
	if _, err := save("storyboard", 0, voiceOnly); err == nil {
		t.Fatal("storyboard voice accepted")
	}
	video := model.DramaBindingReference{AssetID: "video", VersionID: "video-version", Role: "video_reference", Order: 0}
	if _, err := save("storyboard", 0, video); err == nil {
		t.Fatal("storyboard video accepted")
	}
	if _, err := save("video", 1, image); err == nil {
		t.Fatal("nonzero initial revision accepted")
	}
	bound, err := save("video", 0, image, voice)
	if err != nil || bound.Revision != 1 || len(bound.References) != 2 || bound.References[0].VersionID != image.VersionID {
		t.Fatalf("bind: %+v %v", bound, err)
	}
	if _, err := save("video", 0, image); err == nil {
		t.Fatal("stale insert accepted")
	}
	if err := db.Model(&model.DramaAsset{}).Where("id = ?", "image").Update("archived", true).Error; err != nil {
		t.Fatal(err)
	}
	kept, err := save("video", 1, image, voice)
	if err != nil || kept.ID != bound.ID || kept.Revision != 2 {
		t.Fatalf("archived existing reference lost: %+v %v", kept, err)
	}
	if _, err := save("storyboard", 0, image); err == nil {
		t.Fatal("new archived reference accepted")
	}
	if _, err := save("video", 1, video); err == nil {
		t.Fatal("stale update accepted")
	}
	current, err := read(owner, "video")
	if err != nil || current.Revision != 2 || len(current.References) != 2 {
		t.Fatal("failed save mutated binding")
	}
	cleared, err := save("video", 2)
	if err != nil || cleared.ID != bound.ID || cleared.Revision != 3 || cleared.References == nil || len(cleared.References) != 0 {
		t.Fatalf("clear: %+v %v", cleared, err)
	}
	archived := true
	if _, err := UpdateCurrentUserDramaClip(owner, project.ID, episode.ID, clip.ID, DramaClipInput{Archived: &archived, ExpectedRevision: clip.Revision}); err != nil {
		t.Fatal(err)
	}
	if _, err := save("video", 3, video); err == nil {
		t.Fatal("archived Clip accepted write")
	}
}
