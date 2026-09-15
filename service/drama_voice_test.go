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

func TestDramaDefaultVoiceLifecycle(t *testing.T) {
	// 独立临时库验证固定音色版本，不连接生产媒体。
	if os.Getenv("DRAMA_VOICE_TEST_DATABASE") == "" {
		cmd := exec.Command(os.Args[0], "-test.run=^TestDramaDefaultVoiceLifecycle$", "-test.v")
		cmd.Env = append(os.Environ(), "DRAMA_VOICE_TEST_DATABASE="+filepath.Join(t.TempDir(), "voices.db"))
		if output, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v\n%s", err, output)
		}
		return
	}
	config.Cfg.StorageDriver = "sqlite"
	config.Cfg.DatabaseDSN = os.Getenv("DRAMA_VOICE_TEST_DATABASE")
	owner := WithUser(context.Background(), model.AuthUser{ID: "owner"})
	other := WithUser(context.Background(), model.AuthUser{ID: "other"})
	title := "Drama"
	project, err := CreateCurrentUserDramaProject(owner, DramaProjectInput{Title: &title})
	if err != nil {
		t.Fatal(err)
	}
	db, err := repository.DB()
	if err != nil {
		t.Fatal(err)
	}
	for _, fixture := range []struct{ id, user, project, kind, mime, storageOwner, deleted string }{
		{"voice", "owner", project.ID, "voice", "audio/wav", "owner", ""},
		{"foreign", "other", project.ID, "voice", "audio/wav", "other", ""},
		{"elsewhere", "owner", "another-project", "voice", "audio/wav", "owner", ""},
		{"reference", "owner", project.ID, "reference", "audio/wav", "owner", ""},
		{"image", "owner", project.ID, "voice", "image/png", "owner", ""},
		{"wrong-storage-owner", "owner", project.ID, "voice", "audio/wav", "other", ""},
		{"deleted", "owner", project.ID, "voice", "audio/wav", "owner", "deleted"},
	} {
		asset := model.DramaAsset{ID: fixture.id, UserID: fixture.user, ProjectID: fixture.project, Kind: fixture.kind, Title: fixture.id, Revision: 1}
		storage := model.StorageObject{ID: fixture.id + "-storage", ObjectKey: fixture.id, CreatedBy: fixture.storageOwner, MimeType: fixture.mime, DeletedAt: fixture.deleted}
		version := model.DramaAssetVersion{ID: fixture.id + "-version", AssetID: fixture.id, StorageID: storage.ID, MimeType: fixture.mime}
		for _, row := range []any{&asset, &storage, &version} {
			if err := db.Create(row).Error; err != nil {
				t.Fatal(err)
			}
		}
	}
	voiceID := "voice-version"
	character, err := CreateCurrentUserDramaAsset(owner, project.ID, DramaAssetInput{Title: &title, Kind: "character", DefaultVoiceVersionID: &voiceID})
	if err != nil || character.DefaultVoiceVersionID != voiceID {
		t.Fatalf("default voice create: %+v %v", character, err)
	}
	for _, badID := range []string{"foreign-version", "elsewhere-version", "reference-version", "image-version", "wrong-storage-owner-version", "deleted-version", "missing", " padded "} {
		if _, err := UpdateCurrentUserDramaAsset(owner, project.ID, character.ID, DramaAssetInput{DefaultVoiceVersionID: &badID, ExpectedRevision: character.Revision}); err == nil {
			t.Fatalf("invalid default voice accepted: %s", badID)
		}
		if _, err := CreateCurrentUserDramaAsset(owner, project.ID, DramaAssetInput{Title: &title, Kind: "character", DefaultVoiceVersionID: &badID}); err == nil {
			t.Fatalf("invalid create voice accepted: %s", badID)
		}
	}
	for _, kind := range []string{"scene", "prop", "voice", "reference"} {
		if _, err := CreateCurrentUserDramaAsset(owner, project.ID, DramaAssetInput{Title: &title, Kind: kind, DefaultVoiceVersionID: &voiceID}); err == nil {
			t.Fatalf("non-character default voice accepted: %s", kind)
		}
	}
	if _, err := UpdateCurrentUserDramaAsset(other, project.ID, character.ID, DramaAssetInput{DefaultVoiceVersionID: &voiceID, ExpectedRevision: character.Revision}); err == nil {
		t.Fatal("foreign character update accepted")
	}
	if _, err := CreateCurrentUserDramaAsset(context.Background(), project.ID, DramaAssetInput{Title: &title, Kind: "character", DefaultVoiceVersionID: &voiceID}); err == nil {
		t.Fatal("anonymous character create accepted")
	}
	readCharacter := func() model.DramaAsset {
		catalog, err := CurrentUserDramaAssets(owner, project.ID)
		if err != nil {
			t.Fatal(err)
		}
		for _, asset := range catalog.Assets {
			if asset.ID == character.ID {
				return asset
			}
		}
		t.Fatal("character disappeared")
		return model.DramaAsset{}
	}
	if stored := readCharacter(); stored.Revision != character.Revision || stored.DefaultVoiceVersionID != voiceID {
		t.Fatal("rejected update changed default voice or revision")
	}
	description := "New description only"
	character, err = UpdateCurrentUserDramaAsset(owner, project.ID, character.ID, DramaAssetInput{Description: &description, ExpectedRevision: character.Revision})
	if err != nil || character.DefaultVoiceVersionID != voiceID || character.Description != description {
		t.Fatalf("partial edit lost voice: %+v %v", character, err)
	}
	clear := ""
	if _, err := UpdateCurrentUserDramaAsset(owner, project.ID, character.ID, DramaAssetInput{DefaultVoiceVersionID: &clear, ExpectedRevision: character.Revision - 1}); err == nil {
		t.Fatal("stale default clear accepted")
	}
	newVersion := model.DramaAssetVersion{ID: "voice-new", AssetID: "voice", StorageID: "voice-storage", MimeType: "audio/wav"}
	if err := db.Create(&newVersion).Error; err != nil {
		t.Fatal(err)
	}
	voice, err := UpdateCurrentUserDramaAsset(owner, project.ID, "voice", DramaAssetInput{AdoptedVersionID: &newVersion.ID, ExpectedRevision: 1})
	if err != nil || voice.AdoptedVersionID != newVersion.ID {
		t.Fatalf("voice adopt: %+v %v", voice, err)
	}
	if stored := readCharacter(); stored.DefaultVoiceVersionID != voiceID || stored.Revision != character.Revision {
		t.Fatal("adopting latest voice rewrote fixed character version")
	}
	archived := true
	voice, err = UpdateCurrentUserDramaAsset(owner, project.ID, voice.ID, DramaAssetInput{Archived: &archived, ExpectedRevision: voice.Revision})
	if err != nil || !voice.Archived {
		t.Fatal("voice archive failed")
	}
	character, err = UpdateCurrentUserDramaAsset(owner, project.ID, character.ID, DramaAssetInput{DefaultVoiceVersionID: &voiceID, ExpectedRevision: character.Revision})
	if err != nil || character.DefaultVoiceVersionID != voiceID {
		t.Fatalf("unchanged archived voice rejected: %v", err)
	}
	if _, err := UpdateCurrentUserDramaAsset(owner, project.ID, character.ID, DramaAssetInput{DefaultVoiceVersionID: &newVersion.ID, ExpectedRevision: character.Revision}); err == nil {
		t.Fatal("new version of archived voice accepted")
	}
	if _, err := CreateCurrentUserDramaAsset(owner, project.ID, DramaAssetInput{Title: &title, Kind: "character", DefaultVoiceVersionID: &voiceID}); err == nil {
		t.Fatal("new character with archived voice accepted")
	}
	character, err = UpdateCurrentUserDramaAsset(owner, project.ID, character.ID, DramaAssetInput{DefaultVoiceVersionID: &clear, ExpectedRevision: character.Revision})
	if err != nil || character.DefaultVoiceVersionID != "" || character.Description != description {
		t.Fatalf("clear default voice: %+v %v", character, err)
	}
	if _, err := UpdateCurrentUserDramaAsset(owner, project.ID, character.ID, DramaAssetInput{DefaultVoiceVersionID: &voiceID, ExpectedRevision: character.Revision}); err == nil {
		t.Fatal("reassign archived default voice accepted")
	}
}
