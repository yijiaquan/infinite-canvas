package repository

import (
	"errors"
	"github.com/glebarez/sqlite"
	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
	"path/filepath"
	"sync"
	"testing"
)

func TestDramaProjectIsolationAndRevisions(t *testing.T) {
	oldDB, oldErr := db, dbErr
	testDB, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "drama.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := testDB.AutoMigrate(&model.DramaProject{}, &model.DramaEpisode{}, &model.CanvasProject{}); err != nil {
		t.Fatal(err)
	}
	dbOnce = sync.Once{}
	dbOnce.Do(func() { db = testDB; dbErr = nil })
	t.Cleanup(func() {
		db = oldDB
		dbErr = oldErr
		dbOnce = sync.Once{}
		if oldDB != nil || oldErr != nil {
			dbOnce.Do(func() {})
		}
		sqlDB, _ := testDB.DB()
		_ = sqlDB.Close()
	})
	project := model.DramaProject{ID: "project", UserID: "owner", Title: "Drama", Revision: 1}
	if err := CreateDramaProject(project); err != nil {
		t.Fatal(err)
	}
	if _, _, err := GetDramaProject("other", "project"); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("owner isolation: %v", err)
	}
	if items, err := ListDramaProjects("other"); err != nil || len(items) != 0 {
		t.Fatal("foreign list leaked")
	}
	updated, err := UpdateDramaProject("owner", "project", 1, map[string]any{"title": "new"})
	if err != nil || updated.Revision != 2 {
		t.Fatalf("update: %v %+v", err, updated)
	}
	if _, err := UpdateDramaProject("owner", "project", 1, map[string]any{"title": "stale"}); !errors.Is(err, ErrDramaRevisionConflict) {
		t.Fatalf("stale: %v", err)
	}
	if _, err := UpdateDramaProject("other", "project", 2, map[string]any{"title": "foreign"}); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("foreign update: %v", err)
	}
	episode := model.DramaEpisode{ID: "episode", UserID: "owner", ProjectID: "project", CanvasID: "canvas", Revision: 1}
	canvas := model.CanvasProject{ID: "canvas", UserID: "owner", ProjectData: "{}"}
	created, err := CreateDramaEpisode(episode, canvas)
	if err != nil || created.Position != 1 {
		t.Fatalf("episode create: %v", err)
	}
	_, items, err := GetDramaProject("owner", "project")
	if err != nil || len(items) != 1 || items[0].CanvasID != "canvas" {
		t.Fatal("episode association missing")
	}
	if linked, err := HasDramaEpisodeCanvases("owner", []string{"canvas"}); err != nil || !linked {
		t.Fatal("deletion guard missing")
	}
	if linked, _ := HasDramaEpisodeCanvases("other", []string{"canvas"}); linked {
		t.Fatal("deletion guard leaked")
	}
	if _, err := UpdateDramaEpisode("other", "project", "episode", 1, map[string]any{"title": "foreign"}); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("foreign episode update: %v", err)
	}
	if _, err := UpdateDramaEpisode("owner", "project", "episode", 1, map[string]any{"script": "new script"}); err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateDramaEpisode("owner", "project", "episode", 1, map[string]any{"script": "stale"}); !errors.Is(err, ErrDramaRevisionConflict) {
		t.Fatalf("episode conflict: %v", err)
	}
	// 关联冲突时，事务必须回滚先创建的画布。
	episode.CanvasID = "rollback-canvas"
	canvas.ID = "rollback-canvas"
	if _, err := CreateDramaEpisode(episode, canvas); err == nil {
		t.Fatal("duplicate episode accepted")
	}
	var count int64
	testDB.Model(&model.CanvasProject{}).Where("id = ?", "rollback-canvas").Count(&count)
	if count != 0 {
		t.Fatal("orphan canvas after rollback")
	}
	episode.ID = "foreign-episode"
	episode.UserID = "other"
	episode.CanvasID = "foreign-canvas"
	canvas.ID = "foreign-canvas"
	canvas.UserID = "other"
	if _, err := CreateDramaEpisode(episode, canvas); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("foreign create: %v", err)
	}
}
