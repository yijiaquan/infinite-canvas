package service

import (
	"context"
	"github.com/tigerowo/infinite-canvas/config"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestDramaLegacyImport(t *testing.T) {
	if os.Getenv("DRAMA_LEGACY_TEST_DIR") == "" {
		cmd := exec.Command(os.Args[0], "-test.run=^TestDramaLegacyImport$")
		cmd.Env = append(os.Environ(), "DRAMA_LEGACY_TEST_DIR="+t.TempDir())
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v: %s", err, out)
		}
		return
	}
	config.Cfg.StorageDriver = "sqlite"
	config.Cfg.DatabaseDSN = filepath.Join(os.Getenv("DRAMA_LEGACY_TEST_DIR"), "test.db")
	db, err := repository.DB()
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.DramaRun{}); err != nil {
		t.Fatal(err)
	}
	for _, value := range []any{&model.DramaProject{ID: "p", UserID: "u"}, &model.DramaEpisode{ID: "e", ProjectID: "p", UserID: "u"}, &model.DramaClip{ID: "c", ProjectID: "p", EpisodeID: "e", UserID: "u", Revision: 1}, &model.StorageObject{ID: "s", CreatedBy: "u", MimeType: "video/mp4", ObjectKey: "s"}} {
		if err := db.Create(value).Error; err != nil {
			t.Fatal(err)
		}
	}
	ctx := WithUser(context.Background(), model.AuthUser{ID: "u"})
	input := DramaImportOutputInput{RequestID: "import-r", NodeID: "video", Kind: "video", StorageID: "s", SourceKey: "old-project:old-candidate", Prompt: "original adopted prompt", ClipRevision: 1}
	run, err := ImportDramaOutput(ctx, "p", "e", "c", input)
	if err != nil || run.Status != "completed" || run.UpstreamID != "" || run.Credits != 0 || run.Provider != "import" {
		t.Fatalf("import %v %+v", err, run)
	}
	again, err := ImportDramaOutput(ctx, "p", "e", "c", input)
	if err != nil || again.ID != run.ID {
		t.Fatalf("idempotency %v", err)
	}
	var count int64
	db.Model(&model.DramaRun{}).Count(&count)
	if count != 1 {
		t.Fatal("duplicate imported run")
	}
	input.SourceKey = "other-candidate"
	if _, err := ImportDramaOutput(ctx, "p", "e", "c", input); err == nil {
		t.Fatal("request reuse accepted")
	}
	if _, err := ImportDramaOutput(WithUser(context.Background(), model.AuthUser{ID: "other"}), "p", "e", "c", input); err == nil {
		t.Fatal("foreign import accepted")
	}
	input.RequestID = "wrong-kind"
	input.Kind = "image"
	if _, err := ImportDramaOutput(ctx, "p", "e", "c", input); err == nil {
		t.Fatal("wrong media kind accepted")
	}
}
