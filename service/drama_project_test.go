package service

import (
	"context"
	"encoding/json"
	"github.com/tigerowo/infinite-canvas/config"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestDramaFoundation(t *testing.T) {
	// 子进程隔离 DB 单例，始终使用测试临时目录，不读取本机配置。
	if os.Getenv("DRAMA_TEST_DATABASE") == "" {
		cmd := exec.Command(os.Args[0], "-test.run=^TestDramaFoundation$", "-test.v")
		cmd.Env = append(os.Environ(), "DRAMA_TEST_DATABASE="+filepath.Join(t.TempDir(), "drama.db"))
		if output, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v\n%s", err, output)
		}
		return
	}
	config.Cfg.StorageDriver = "sqlite"
	config.Cfg.DatabaseDSN = os.Getenv("DRAMA_TEST_DATABASE")
	title, source := "Test Drama", "novel"
	owner := WithUser(context.Background(), model.AuthUser{ID: "owner"})
	other := WithUser(context.Background(), model.AuthUser{ID: "other"})
	if _, err := CreateCurrentUserDramaProject(context.Background(), DramaProjectInput{Title: &title}); err == nil {
		t.Fatal("anonymous project accepted")
	}
	project, err := CreateCurrentUserDramaProject(owner, DramaProjectInput{Title: &title, SourceType: &source})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := CreateCurrentUserDramaEpisode(other, project.ID, DramaEpisodeInput{Title: &title}); err == nil {
		t.Fatal("foreign project accepted")
	}
	episode, err := CreateCurrentUserDramaEpisode(owner, project.ID, DramaEpisodeInput{Title: &title})
	if err != nil {
		t.Fatal(err)
	}
	canvases, err := repository.ListUserCanvasProjects("owner")
	if err != nil || len(canvases) != 1 {
		t.Fatalf("canvas missing: %v", err)
	}
	var data map[string]any
	if err := json.Unmarshal([]byte(canvases[0].ProjectData), &data); err != nil {
		t.Fatal(err)
	}
	if data["id"] != episode.CanvasID || data["dramaEpisodeId"] != episode.ID || data["backgroundMode"] != "lines" {
		t.Fatalf("invalid canvas: %+v", data)
	}
	for _, key := range []string{"nodes", "connections", "chatSessions"} {
		if _, ok := data[key].([]any); !ok {
			t.Fatalf("missing array %s", key)
		}
	}
	if viewport, ok := data["viewport"].(map[string]any); !ok || viewport["k"] != float64(1) {
		t.Fatal("invalid viewport")
	}
	delete(data, "dramaProjectId")
	delete(data, "dramaEpisodeId")
	raw, _ := json.Marshal(data)
	normalized, err := canvasProjectFromRaw("owner", raw)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(normalized.ProjectData), &data); err != nil {
		t.Fatal(err)
	}
	if data["dramaProjectId"] != project.ID || data["dramaEpisodeId"] != episode.ID {
		t.Fatal("server failed to restore markers")
	}
	raw, _ = json.Marshal(data)
	if _, err := canvasProjectFromRaw("other", raw); err == nil {
		t.Fatal("foreign marker accepted")
	}
	if err := DeleteCurrentUserCanvasProjects(owner, []string{"ordinary", episode.CanvasID}); err == nil {
		t.Fatal("linked canvas deleted")
	}
	canvases, err = repository.ListUserCanvasProjects("owner")
	if err != nil || len(canvases) != 1 || canvases[0].DeletedAt != "" {
		t.Fatal("batch deletion was not blocked")
	}
	script := "current script"
	if _, err := UpdateCurrentUserDramaEpisode(owner, project.ID, episode.ID, DramaEpisodeInput{Script: &script, ExpectedRevision: 1}); err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateCurrentUserDramaEpisode(owner, project.ID, episode.ID, DramaEpisodeInput{Script: &script, ExpectedRevision: 1}); err == nil {
		t.Fatal("stale write accepted")
	}
	if _, err := CurrentUserDramaProject(other, project.ID); err == nil {
		t.Fatal("foreign project read")
	}
	detail, err := CurrentUserDramaProject(owner, project.ID)
	if err != nil || len(detail.Episodes) != 1 || detail.Episodes[0].Script != script {
		t.Fatalf("detail: %v %+v", err, detail)
	}
}
