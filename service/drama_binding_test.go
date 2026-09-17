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
	shots := []model.DramaShot{{ID: "shot", Duration: 3, Speaker: "双人同镜", Dialogue: "Alice：Hello\nBob：Reply"}}
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
		{"image", "image/png", "owner", project.ID}, {"audio", "audio/wav", "owner", project.ID}, {"audio-bob", "audio/wav", "owner", project.ID}, {"video", "video/mp4", "owner", project.ID},
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
	for _, asset := range []model.DramaAsset{
		{ID: "character", UserID: "owner", ProjectID: project.ID, Kind: "character", Revision: 1},
		{ID: "expression", UserID: "owner", ProjectID: project.ID, Kind: "expression", ParentID: "character", Revision: 1},
		{ID: "expression-state", UserID: "owner", ProjectID: project.ID, Kind: "reference", ParentID: "expression", Revision: 1},
	} {
		if err := db.Create(&asset).Error; err != nil {
			t.Fatal(err)
		}
	}
	for _, version := range []model.DramaAssetVersion{
		{ID: "expression-version", AssetID: "expression", StorageID: "image-storage", MimeType: "image/png"},
		{ID: "expression-state-version", AssetID: "expression-state", StorageID: "image-storage", MimeType: "image/png"},
	} {
		if err := db.Create(&version).Error; err != nil {
			t.Fatal(err)
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
	secondVoice := model.DramaBindingReference{AssetID: "audio-bob", VersionID: "audio-bob-version", Role: "voice", Speaker: "Bob", Order: 2}
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
		{AssetID: "audio", VersionID: "audio-version", Role: "voice", Speaker: "Carol"},
		{AssetID: "audio", VersionID: "audio-version", Role: "voice"},
		{AssetID: "image", VersionID: "image-version", Role: "invalid"},
		{AssetID: "image", VersionID: "image-version", Role: "reference", Order: 2},
	} {
		if _, err := save("video", 0, ref); err == nil {
			t.Fatalf("invalid reference accepted: %+v", ref)
		}
	}
	if _, err := save("video", 0, model.DramaBindingReference{AssetID: "audio", VersionID: "audio-version", Role: "voice", Speaker: "Carol", Order: 0}); err == nil {
		t.Fatal("unknown speaker accepted")
	} else if safe, ok := err.(interface{ SafeMessage() string }); !ok || safe.SafeMessage() != "声音必须绑定本 Clip 实际说话者" {
		t.Fatalf("unknown speaker error was not readable: %v", err)
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
	bound, err := save("video", 0, image, voice, secondVoice)
	if err != nil || bound.Revision != 1 || len(bound.References) != 3 || bound.References[0].VersionID != image.VersionID {
		t.Fatalf("bind: %+v %v", bound, err)
	}
	if err := ValidateDramaRunReferences(owner, project.ID, episode.ID, clip.ID, "video", []model.DramaRunReference{
		{AssetID: "image", VersionID: "image-version", StorageID: "image-storage", Role: "character", Order: 0},
		{AssetID: "audio", VersionID: "audio-version", StorageID: "audio-storage", Role: "voice", Speaker: "Alice", Order: 1},
		{AssetID: "audio-bob", VersionID: "audio-bob-version", StorageID: "audio-bob-storage", Role: "voice", Speaker: "Bob", Order: 2},
	}); err != nil {
		t.Fatalf("multi-speaker run validation: %v", err)
	}
	boardExpression := model.DramaBindingReference{AssetID: "expression", VersionID: "expression-version", Role: "expression", Order: 0}
	stateExpression := model.DramaBindingReference{AssetID: "expression-state", VersionID: "expression-state-version", Role: "expression", Order: 0}
	if _, err := save("storyboard", 0, boardExpression); err != nil {
		t.Fatalf("storyboard expression rejected: %v", err)
	}
	for name, tc := range map[string]struct {
		stage    string
		revision int64
		ref      model.DramaBindingReference
	}{
		"board in video":            {"video", 0, boardExpression},
		"state in storyboard":       {"storyboard", 1, stateExpression},
		"board with reference role": {"video", 0, model.DramaBindingReference{AssetID: "expression", VersionID: "expression-version", Role: "reference", Order: 0}},
		"state with reference role": {"video", 0, model.DramaBindingReference{AssetID: "expression-state", VersionID: "expression-state-version", Role: "reference", Order: 0}},
	} {
		if _, err := save(tc.stage, tc.revision, tc.ref); err == nil {
			t.Fatalf("%s accepted", name)
		}
	}
	if err := ValidateDramaRunReferences(owner, project.ID, episode.ID, clip.ID, "image", []model.DramaRunReference{{AssetID: "expression", VersionID: "expression-version", StorageID: "image-storage", Role: "expression", Order: 0}}); err != nil {
		t.Fatalf("image run expression board rejected: %v", err)
	}
	if err := ValidateDramaRunReferences(owner, project.ID, episode.ID, clip.ID, "video", []model.DramaRunReference{{AssetID: "expression-state", VersionID: "expression-state-version", StorageID: "image-storage", Role: "expression", Order: 0}}); err != nil {
		t.Fatalf("video run expression state rejected: %v", err)
	}
	if err := ValidateDramaRunReferences(owner, project.ID, episode.ID, clip.ID, "video", []model.DramaRunReference{{AssetID: "expression", VersionID: "expression-version", StorageID: "image-storage", Role: "expression", Order: 0}}); err == nil {
		t.Fatal("video run accepted complete expression board")
	}
	if _, err := save("video", 0, image); err == nil {
		t.Fatal("stale insert accepted")
	}
	if err := db.Model(&model.DramaAsset{}).Where("id = ?", "image").Update("archived", true).Error; err != nil {
		t.Fatal(err)
	}
	kept, err := save("video", 1, image, voice, secondVoice)
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
	if err != nil || current.Revision != 2 || len(current.References) != 3 {
		t.Fatal("failed save mutated binding")
	}
	cleared, err := save("video", 2)
	if err != nil || cleared.ID != bound.ID || cleared.Revision != 3 || cleared.References == nil || len(cleared.References) != 0 {
		t.Fatalf("clear: %+v %v", cleared, err)
	}
	if expressionBound, err := save("video", 3, stateExpression); err != nil || expressionBound.Revision != 4 {
		t.Fatalf("video expression state rejected: %+v %v", expressionBound, err)
	}
	archived := true
	if _, err := UpdateCurrentUserDramaClip(owner, project.ID, episode.ID, clip.ID, DramaClipInput{Archived: &archived, ExpectedRevision: clip.Revision}); err != nil {
		t.Fatal(err)
	}
	if _, err := save("video", 4, video); err == nil {
		t.Fatal("archived Clip accepted write")
	}
}
