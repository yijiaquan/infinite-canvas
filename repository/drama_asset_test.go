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

func TestDramaAssetOwnershipVersionsAndParents(t *testing.T) {
	oldDB, oldErr := db, dbErr
	testDB, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "assets.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := testDB.AutoMigrate(&model.DramaProject{}, &model.DramaAsset{}, &model.DramaAssetVersion{}, &model.StorageObject{}); err != nil {
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
	if err := testDB.Create(&model.DramaProject{ID: "p", UserID: "u"}).Error; err != nil {
		t.Fatal(err)
	}
	a, err := CreateDramaAsset(model.DramaAsset{ID: "a", UserID: "u", ProjectID: "p", Title: "Hero", Kind: "character", Revision: 1})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := ListDramaAssets("other", "p"); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("foreign list %v", err)
	}
	if _, err := CreateDramaAsset(model.DramaAsset{ID: "foreign", UserID: "other", ProjectID: "p"}); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("foreign create %v", err)
	}
	if _, err := CreateDramaAsset(model.DramaAsset{ID: "child", UserID: "u", ProjectID: "p", ParentID: "a", Kind: "character", Revision: 1}); err != nil {
		t.Fatal(err)
	}
	voice, err := CreateDramaAsset(model.DramaAsset{ID: "voice", UserID: "u", ProjectID: "p", Title: "Voice", Kind: "voice", Revision: 1})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateDramaAsset("u", "p", "a", 1, map[string]any{"parent_id": "child"}); !errors.Is(err, ErrDramaAssetParent) {
		t.Fatalf("cycle %v", err)
	}
	if _, err := UpdateDramaAsset("u", "p", "a", 1, map[string]any{"parent_id": "a"}); !errors.Is(err, ErrDramaAssetParent) {
		t.Fatalf("self %v", err)
	}
	for _, s := range []model.StorageObject{{ID: "image", ObjectKey: "image", CreatedBy: "u", MimeType: "image/png"}, {ID: "foreign", ObjectKey: "foreign", CreatedBy: "other", MimeType: "image/png"}, {ID: "audio", ObjectKey: "audio", CreatedBy: "u", MimeType: "audio/mpeg"}, {ID: "deleted", ObjectKey: "deleted", CreatedBy: "u", MimeType: "image/png", DeletedAt: "now"}} {
		if err := testDB.Create(&s).Error; err != nil {
			t.Fatal(err)
		}
	}
	for _, id := range []string{"foreign", "deleted", "audio"} {
		if _, err := CreateDramaAssetVersion("u", "p", "a", 1, model.DramaAssetVersion{ID: "bad-" + id, StorageID: id}); err == nil {
			t.Fatalf("accepted %s", id)
		}
	}
	voice, err = CreateDramaAssetVersion("u", "p", "voice", voice.Revision, model.DramaAssetVersion{ID: "voice-wav", StorageID: "audio", Note: "existing canvas WAV"})
	if err != nil || voice.Revision != 2 {
		t.Fatalf("existing WAV voice version %+v %v", voice, err)
	}
	a, err = CreateDramaAssetVersion("u", "p", "a", 1, model.DramaAssetVersion{ID: "v", StorageID: "image", Note: "first"})
	if err != nil || a.Revision != 2 || a.AdoptedVersionID != "" {
		t.Fatalf("version %+v %v", a, err)
	}
	if _, err := CreateDramaAssetVersion("u", "p", "a", 1, model.DramaAssetVersion{ID: "stale", StorageID: "image"}); !errors.Is(err, ErrDramaRevisionConflict) {
		t.Fatalf("stale %v", err)
	}
	if _, err := UpdateDramaAsset("u", "p", "child", 1, map[string]any{"adopted_version_id": "v"}); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("wrong asset version %v", err)
	}
	a, err = UpdateDramaAsset("u", "p", "a", 2, map[string]any{"adopted_version_id": "v"})
	if err != nil || a.Revision != 3 || a.AdoptedVersionID != "v" {
		t.Fatalf("adopt %v", err)
	}
	if _, err := UpdateDramaAsset("other", "p", "a", 3, map[string]any{"title": "bad"}); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("foreign update %v", err)
	}
	if _, err := UpdateDramaAsset("u", "p", "a", 3, map[string]any{"archived": true}); err != nil {
		t.Fatal(err)
	}
	if _, err := CreateDramaAssetVersion("u", "p", "a", 4, model.DramaAssetVersion{ID: "archived", StorageID: "image"}); !errors.Is(err, ErrDramaAssetArchived) {
		t.Fatalf("archive %v", err)
	}
	assets, versions, err := ListDramaAssets("u", "p")
	if err != nil || len(assets) != 3 || len(versions) != 2 || versions[0].MimeType != "image/png" || versions[0].Note != "first" {
		t.Fatalf("immutable list %+v %v", versions, err)
	}
	if _, err := UpdateDramaAsset("u", "p", "a", 4, map[string]any{"archived": false}); err != nil {
		t.Fatal(err)
	}
	if _, err := CreateDramaAssetVersion("u", "p", "a", 5, model.DramaAssetVersion{ID: "v2", StorageID: "image"}); err != nil {
		t.Fatal(err)
	}
}
