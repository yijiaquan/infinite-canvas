package service

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/tigerowo/infinite-canvas/config"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestDramaAdoptionExportAndMediaProtection(t *testing.T) {
	if os.Getenv("DRAMA_ADOPTION_TEST_DIR") == "" {
		cmd := exec.Command(os.Args[0], "-test.run=^TestDramaAdoptionExportAndMediaProtection$")
		cmd.Env = append(os.Environ(), "DRAMA_ADOPTION_TEST_DIR="+t.TempDir())
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v: %s", err, out)
		}
		return
	}
	dir := os.Getenv("DRAMA_ADOPTION_TEST_DIR")
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	config.Cfg.StorageDriver = "sqlite"
	config.Cfg.DatabaseDSN = filepath.Join(dir, "test.db")
	db, err := repository.DB()
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.DramaRun{}, &model.DramaAssetVersion{}, &model.DramaAdoption{}); err != nil {
		t.Fatal(err)
	}
	for _, value := range []any{&model.DramaProject{ID: "p", UserID: "u"}, &model.DramaEpisode{ID: "e", ProjectID: "p", UserID: "u"}, &model.DramaClip{ID: "second", Title: "Second", ProjectID: "p", EpisodeID: "e", UserID: "u", Position: 2, Revision: 1, Shots: []model.DramaShot{{ID: "s", Duration: 1.5}}}, &model.DramaClip{ID: "first", Title: "First", ProjectID: "p", EpisodeID: "e", UserID: "u", Position: 1, Revision: 1, Shots: []model.DramaShot{{ID: "s", Duration: 2.5}}}} {
		if err := db.Create(value).Error; err != nil {
			t.Fatal(err)
		}
	}
	ctx := WithUser(context.Background(), model.AuthUser{ID: "u"})
	foreign := WithUser(context.Background(), model.AuthUser{ID: "foreign"})
	// Binary fixture tests durable byte preservation; no generation or codec claim.
	data := append([]byte{0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'}, make([]byte, 100)...)
	object, err := UploadDramaMedia(ctx, bytes.NewReader(data), "video/mp4")
	if err != nil {
		t.Fatal(err)
	}
	if err := DeleteStorageObject(context.Background(), object.ID, nil); err == nil {
		t.Fatal("anonymous deletion accepted")
	}
	if err := PreflightDeleteStorageObject(context.Background(), object.ID); err == nil {
		t.Fatal("anonymous preflight accepted")
	}
	if err := PreflightDeleteStorageObject(foreign, object.ID); err == nil {
		t.Fatal("foreign preflight accepted")
	}
	if err := PreflightDeleteStorageObject(ctx, object.ID); err != nil {
		t.Fatalf("unreferenced preflight %v", err)
	}
	run, err := ImportDramaOutput(ctx, "p", "e", "first", DramaImportOutputInput{RequestID: "a", Kind: "video", StorageID: object.ID, SourceKey: "legacy:a", ClipRevision: 1})
	if err != nil {
		t.Fatal(err)
	}
	input := DramaAdoptionInput{RunID: run.ID, StorageID: object.ID, ClipRevision: 1}
	if _, err := AdoptDramaOutput(foreign, "p", "e", "first", input); err == nil {
		t.Fatal("foreign adoption accepted")
	}
	if _, err := AdoptDramaOutput(ctx, "p", "e", "second", input); err == nil {
		t.Fatal("cross clip run accepted")
	}
	input.ClipRevision = 2
	if _, err := AdoptDramaOutput(ctx, "p", "e", "first", input); err == nil {
		t.Fatal("stale Clip accepted")
	}
	input.ClipRevision = 1
	adoption, err := AdoptDramaOutput(ctx, "p", "e", "first", input)
	if err != nil || adoption.Revision != 1 {
		t.Fatalf("adopt %v", err)
	}
	if _, err := AdoptDramaOutput(ctx, "p", "e", "first", input); err == nil {
		t.Fatal("stale adoption accepted")
	}
	if _, err := ExportDramaEpisode(ctx, "p", "e", false); err == nil {
		t.Fatal("full export missing second accepted")
	}
	checkZip := func(file *os.File, wantMissing bool) {
		t.Helper()
		defer file.Close()
		defer os.Remove(file.Name())
		info, _ := file.Stat()
		archive, err := zip.NewReader(file, info.Size())
		if err != nil {
			t.Fatal(err)
		}
		var manifest []struct {
			ClipID   string  `json:"clipId"`
			Missing  bool    `json:"missing"`
			Duration float64 `json:"duration"`
			SHA256   string  `json:"sha256"`
		}
		mediaCount := 0
		for _, entry := range archive.File {
			r, err := entry.Open()
			if err != nil {
				t.Fatal(err)
			}
			raw, err := io.ReadAll(r)
			r.Close()
			if err != nil {
				t.Fatal(err)
			}
			if entry.Name == "manifest.json" {
				if err := json.Unmarshal(raw, &manifest); err != nil {
					t.Fatal(err)
				}
			} else {
				mediaCount++
				if !bytes.Equal(raw, data) {
					t.Fatal("export bytes changed")
				}
			}
		}
		if len(manifest) != 2 || manifest[0].ClipID != "first" || manifest[1].ClipID != "second" || manifest[1].Missing != wantMissing || manifest[0].Duration != 2.5 || len(manifest[0].SHA256) != 64 {
			t.Fatalf("manifest %+v", manifest)
		}
		if (wantMissing && mediaCount != 1) || (!wantMissing && mediaCount != 2) {
			t.Fatal("wrong media count")
		}
	}
	file, err := ExportDramaEpisode(ctx, "p", "e", true)
	if err != nil {
		t.Fatal(err)
	}
	checkZip(file, true)
	second, err := ImportDramaOutput(ctx, "p", "e", "second", DramaImportOutputInput{RequestID: "b", Kind: "video", StorageID: object.ID, SourceKey: "legacy:b", ClipRevision: 1})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := AdoptDramaOutput(ctx, "p", "e", "second", DramaAdoptionInput{RunID: second.ID, StorageID: object.ID, ClipRevision: 1}); err != nil {
		t.Fatal(err)
	}
	file, err = ExportDramaEpisode(ctx, "p", "e", false)
	if err != nil {
		t.Fatal(err)
	}
	checkZip(file, false)
	if err := DeleteStorageObject(ctx, object.ID, nil); err == nil {
		t.Fatal("referenced media deleted")
	}
	if err := PreflightDeleteStorageObject(ctx, object.ID); err == nil {
		t.Fatal("linked preflight accepted")
	}
	if err := db.Model(&model.StorageObject{}).Where("id = ?", object.ID).Update("direct", true).Error; err != nil {
		t.Fatal(err)
	}
	if err := DeleteDirectStorageObjectRecord(ctx, object.ID); err == nil {
		t.Fatal("direct guard bypass")
	}
	for i := 0; i < 140; i++ {
		row := model.DramaRun{ID: fmt.Sprintf("batch-%03d", i), UserID: "batch", RequestID: fmt.Sprint(i), Status: "completed", Snapshot: model.DramaRunSnapshot{References: []model.DramaRunReference{}}}
		if i == 139 {
			row.Snapshot.References = append(row.Snapshot.References, model.DramaRunReference{StorageID: "late-reference"})
		}
		if err := db.Create(&row).Error; err != nil {
			t.Fatal(err)
		}
	}
	if found, err := repository.DramaStorageReferenced("late-reference"); err != nil || !found {
		t.Fatalf("batched reference lost %v", err)
	}
	if found, err := repository.DramaStorageReferenced("absent-reference"); err != nil || found {
		t.Fatalf("false reference %v", err)
	}
	mediaPath, _ := dramaMediaPath(object.ID)
	raw, err := os.ReadFile(mediaPath)
	if err != nil || !bytes.Equal(raw, data) {
		t.Fatal("original media changed")
	}
	if err := os.WriteFile(mediaPath, append(data, 1), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := ExportDramaEpisode(ctx, "p", "e", false); err == nil {
		t.Fatal("corrupt media exported")
	}
	if err := os.WriteFile(mediaPath, data, 0600); err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.DramaClip{}).Where("id = ?", "first").Updates(map[string]any{"revision": 2, "summary": "changed content"}).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := ExportDramaEpisode(ctx, "p", "e", false); err == nil {
		t.Fatal("stale adopted clip exported")
	}
}
