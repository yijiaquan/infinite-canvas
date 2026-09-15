package repository

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/tigerowo/infinite-canvas/model"
	"gorm.io/gorm"
)

func TestDramaCanvasRevisionSaves(t *testing.T) {
	oldDB, oldErr := db, dbErr
	testDB, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "canvas.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := testDB.AutoMigrate(&model.CanvasProject{}, &model.DramaEpisode{}); err != nil {
		t.Fatal(err)
	}
	dbOnce = sync.Once{}
	dbOnce.Do(func() { db = testDB; dbErr = nil })
	t.Cleanup(func() {
		db, dbErr = oldDB, oldErr
		dbOnce = sync.Once{}
		if oldDB != nil || oldErr != nil {
			dbOnce.Do(func() {})
		}
		sqlDB, _ := testDB.DB()
		_ = sqlDB.Close()
	})
	initial := model.CanvasProject{ID: "episode-canvas", UserID: "owner", DramaRevision: 1, ProjectData: `{"dramaRevision":1,"nodes":["original"]}`, CreatedAt: "1", UpdatedAt: "1"}
	if err := testDB.Create(&initial).Error; err != nil {
		t.Fatal(err)
	}
	if err := testDB.Create(&model.DramaEpisode{ID: "ep", UserID: "owner", ProjectID: "project", CanvasID: initial.ID}).Error; err != nil {
		t.Fatal(err)
	}
	first := initial
	first.ProjectData = `{"dramaRevision":1,"nodes":["new"]}`
	first.UpdatedAt = "2"
	saved, err := SaveUserCanvasProject(first)
	if err != nil || saved.DramaRevision != 2 {
		t.Fatalf("save: %+v %v", saved, err)
	}
	var output struct {
		Revision int64 `json:"dramaRevision"`
	}
	if err := json.Unmarshal([]byte(saved.ProjectData), &output); err != nil || output.Revision != 2 {
		t.Fatal("returned JSON revision missing")
	}
	stale := initial
	stale.ProjectData = `{"dramaRevision":1,"nodes":["overwrite"]}`
	stale.UpdatedAt = "9"
	if _, err := SaveUserCanvasProject(stale); !errors.Is(err, ErrDramaCanvasRevisionConflict) {
		t.Fatalf("stale save: %v", err)
	}
	if _, err := SaveUserCanvasProjects("owner", []model.CanvasProject{stale}); !errors.Is(err, ErrDramaCanvasRevisionConflict) {
		t.Fatalf("bulk bypass: %v", err)
	}
	for _, raw := range []string{`{"nodes":[]}`, `{"dramaRevision":null}`, `{"dramaRevision":2.5}`, `{"dramaRevision":-1}`} {
		stale.ProjectData = raw
		if _, err := SaveUserCanvasProject(stale); !errors.Is(err, ErrDramaCanvasRevisionConflict) {
			t.Fatalf("invalid revision accepted: %s %v", raw, err)
		}
	}
	var current model.CanvasProject
	if err := testDB.First(&current, "user_id = ? AND id = ?", "owner", initial.ID).Error; err != nil {
		t.Fatal(err)
	}
	if current.ProjectData != saved.ProjectData || current.DramaRevision != 2 {
		t.Fatal("conflict overwrote saved graph")
	}
	// Ordinary canvases keep last-write-wins, even with a client-supplied drama flag.
	ordinary := model.CanvasProject{ID: "ordinary", UserID: "owner", ProjectData: `{"dramaProjectId":"fake","nodes":[]}`, UpdatedAt: "2"}
	if _, err := SaveUserCanvasProject(ordinary); err != nil {
		t.Fatal(err)
	}
	ordinary.ProjectData = `{"nodes":["latest"]}`
	ordinary.UpdatedAt = "3"
	if got, err := SaveUserCanvasProject(ordinary); err != nil || got.ProjectData != ordinary.ProjectData || got.DramaRevision != 0 {
		t.Fatalf("ordinary changed: %+v %v", got, err)
	}
	ordinary.ProjectData = `{"nodes":["older"]}`
	ordinary.UpdatedAt = "1"
	if got, err := SaveUserCanvasProject(ordinary); err != nil || got.UpdatedAt != "3" {
		t.Fatal("ordinary timestamp ordering changed")
	}
	// Existing associated rows start at zero and advance without requiring migration of JSON.
	legacy := model.CanvasProject{ID: "legacy", UserID: "owner", ProjectData: `{"nodes":[]}`}
	if err := testDB.Create(&legacy).Error; err != nil {
		t.Fatal(err)
	}
	if err := testDB.Create(&model.DramaEpisode{ID: "legacy-ep", UserID: "owner", CanvasID: legacy.ID}).Error; err != nil {
		t.Fatal(err)
	}
	if got, err := SaveUserCanvasProject(legacy); err != nil || got.DramaRevision != 1 {
		t.Fatalf("legacy revision: %+v %v", got, err)
	}
}
