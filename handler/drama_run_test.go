package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/tigerowo/infinite-canvas/config"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"github.com/tigerowo/infinite-canvas/service"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCreateDramaImageFormPartPreservesMimeType(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := createDramaImageFormPart(writer, "../reference.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = part.Write([]byte("png")); err != nil {
		t.Fatal(err)
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}
	reader := multipart.NewReader(&body, writer.Boundary())
	item, err := reader.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	if item.FormName() != "image" || item.FileName() != "reference.png" || item.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("unexpected multipart image headers: %#v", item.Header)
	}
}

func TestDramaRunLifecycle(t *testing.T) {
	if os.Getenv("DRAMA_RUN_TEST_DIR") == "" {
		cmd := exec.Command(os.Args[0], "-test.run=^TestDramaRunLifecycle$", "-test.v")
		cmd.Env = append(os.Environ(), "DRAMA_RUN_TEST_DIR="+t.TempDir())
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("%v\n%s", err, out)
		}
		return
	}
	root := os.Getenv("DRAMA_RUN_TEST_DIR")
	if err := os.Chdir(root); err != nil {
		t.Fatal(err)
	}
	config.Cfg.StorageDriver = "sqlite"
	config.Cfg.DatabaseDSN = filepath.Join(root, "queue.db")
	db, err := repository.DB()
	if err != nil {
		t.Fatal(err)
	}
	if err = db.AutoMigrate(&model.DramaRun{}); err != nil {
		t.Fatal(err)
	}
	owner := model.User{ID: "owner", Username: "owner", Role: model.UserRoleAdmin, Status: model.UserStatusActive, Credits: 100, AffCode: "owner"}
	if err = db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	for _, item := range []any{&model.DramaProject{ID: "project", UserID: owner.ID}, &model.DramaEpisode{ID: "episode", UserID: owner.ID, ProjectID: "project", CanvasID: "canvas"}, &model.DramaClip{ID: "clip", UserID: owner.ID, ProjectID: "project", EpisodeID: "episode"}, &model.CanvasProject{ID: "canvas", UserID: owner.ID, ProjectData: `{"nodes":[{"id":"board","type":"image","metadata":{"dramaClipId":"clip","dramaRole":"storyboard"}}]}`}} {
		if err = db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}
	var submits atomic.Int32
	png := "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII="
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/generations" {
			t.Errorf("unexpected path %s", r.URL.Path)
			w.WriteHeader(404)
			return
		}
		submits.Add(1)
		var input map[string]any
		json.NewDecoder(r.Body).Decode(&input)
		if input["prompt"] != "frozen prompt" {
			t.Error("frozen prompt changed")
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"data": []map[string]string{{"b64_json": png}}})
	}))
	defer server.Close()
	channel := model.ModelChannel{ID: "test", Protocol: "openai", Name: "test", BaseURL: server.URL, APIKey: "test-only", Models: []string{"test-image"}, Enabled: true, Weight: 1}
	settings := model.Settings{Private: model.PrivateSetting{Channels: []model.ModelChannel{channel}}, Public: model.PublicSetting{ModelChannel: model.PublicModelChannelSetting{AvailableModels: []string{"test-image"}, ModelCosts: []model.ModelCost{{Model: "test-image", Credits: 3}}}}}
	if _, err = repository.SaveSettings(settings, time.Now().UTC().Format(time.RFC3339Nano)); err != nil {
		t.Fatal(err)
	}
	ctx := service.WithUser(context.Background(), model.PublicUser(owner))
	previewRaw, _ := json.Marshal(DramaRunInput{RequestID: "preview-only", NodeID: "board", Kind: "image", Model: "test-image", ChannelID: "test", Prompt: "frozen prompt"})
	previewRec := httptest.NewRecorder()
	PreviewDramaRun(previewRec, httptest.NewRequest("POST", "/preview", bytes.NewReader(previewRaw)).WithContext(ctx), "project", "episode", "clip")
	var preview struct {
		Data struct {
			Credits  int
			Snapshot model.DramaRunSnapshot
		}
	}
	if err = json.Unmarshal(previewRec.Body.Bytes(), &preview); err != nil || preview.Data.Credits != 3 || preview.Data.Snapshot.Prompt != "frozen prompt" {
		t.Fatalf("preview failed %s", previewRec.Body.String())
	}
	if _, err = repository.FindDramaRunRequest("owner", "preview-only"); err == nil {
		t.Fatal("preview persisted a queued task")
	}
	enqueue := func(requestID, node string) model.DramaRun {
		t.Helper()
		raw, _ := json.Marshal(DramaRunInput{RequestID: requestID, NodeID: node, Kind: "image", Model: "test-image", ChannelID: "test", Prompt: "frozen prompt"})
		rec := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/runs", bytes.NewReader(raw)).WithContext(ctx)
		CreateDramaRun(rec, req, "project", "episode", "clip")
		var result struct {
			Code    int
			Data    model.DramaRun
			Message string
		}
		if err = json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if result.Data.ID == "" {
			t.Fatalf("enqueue failed: %s", rec.Body.String())
		}
		return result.Data
	}
	run := enqueue("unique", "board")
	duplicate := enqueue("unique", "board")
	if run.ID != duplicate.ID {
		t.Fatal("duplicate created new task")
	}
	if submits.Load() != 0 {
		t.Fatal("enqueue submitted generation")
	}
	run, _ = repository.FindDramaRunRequest("owner", "unique")
	if ok, err := repository.ClaimDramaRun(run.ID); err != nil || !ok {
		t.Fatalf("claim: %v %v", ok, err)
	}
	run.Status = "preparing"
	executeDramaRun(run)
	run, err = repository.FindDramaRunRequest("owner", "unique")
	if err != nil || run.Status != "saving" {
		t.Fatalf("state %s err %v", run.Status, err)
	}
	executeDramaRun(run)
	run, _ = repository.FindDramaRunRequest("owner", "unique")
	if run.Status != "completed" || len(run.Outputs) != 1 {
		t.Fatalf("save failed: %#v", run)
	}
	data, mime, err := dramaReferenceBytes(ctx, run.Outputs[0].StorageID)
	if err != nil || mime != "image/png" || len(data) == 0 {
		t.Fatalf("durable media missing: %s %v", mime, err)
	}
	expected, _ := base64.StdEncoding.DecodeString(png)
	if !bytes.Equal(data, expected) {
		t.Fatal("media bytes changed")
	}
	stale := run
	stale.Status = "preparing"
	executeDramaRun(stale)
	if submits.Load() != 1 {
		t.Fatal("stale execution resubmitted")
	}
	var updated model.User
	db.First(&updated, "id = ?", "owner")
	if updated.Credits != 97 {
		t.Fatalf("credits %d", updated.Credits)
	}
	cancelled := enqueue("cancel", "board")
	if _, err = service.CancelCurrentDramaRun(ctx, "project", "episode", "clip", cancelled.ID); err != nil {
		t.Fatal(err)
	}
	if ok, _ := repository.ClaimDramaRun(cancelled.ID); ok {
		t.Fatal("cancelled job claimed")
	}
	interrupted := enqueue("interrupted", "board")
	interrupted, _ = repository.FindDramaRunRequest("owner", "interrupted")
	repository.ClaimDramaRun(interrupted.ID)
	interrupted.Status = "preparing"
	if err = repository.StartDramaRunSubmission(interrupted); err != nil {
		t.Fatal(err)
	}
	queued := enqueue("queued", "board")
	repository.ClaimDramaRun(queued.ID)
	if err = repository.RecoverDramaRuns(); err != nil {
		t.Fatal(err)
	}
	interrupted, _ = repository.FindDramaRunRequest("owner", "interrupted")
	queued, _ = repository.FindDramaRunRequest("owner", "queued")
	if interrupted.Status != "unknown" || queued.Status != "queued" {
		t.Fatalf("unsafe recovery: %s %s", interrupted.Status, queued.Status)
	}
	if _, err = service.RecheckCurrentDramaRun(ctx, "project", "episode", "clip", interrupted.ID); err == nil {
		t.Fatal("unknown without upstream id allowed retry")
	}
	if _, err = service.CurrentDramaRuns(service.WithUser(context.Background(), model.AuthUser{ID: "other"}), "project", "episode", "clip"); err == nil {
		t.Fatal("other owner read runs")
	}
	if err = repository.ValidateDramaRunNode("owner", "project", "episode", "clip", "other", "image"); err == nil {
		t.Fatal("arbitrary node accepted")
	}
	all, err := service.CurrentDramaEpisodeRuns(ctx, "project", "episode")
	if err != nil || len(all) != 4 {
		t.Fatalf("episode history: %d %v", len(all), err)
	}
	for _, listed := range all {
		if len(listed.Body) != 0 || len(listed.Response) != 0 || listed.Endpoint != "" || listed.Provider != "" {
			t.Fatal("episode history loaded internal request payloads")
		}
	}
	// Unknown submissions retain their concurrency slot until explicitly reconciled.
	if claimed, err := repository.ClaimDramaRun(queued.ID); err != nil || !claimed {
		t.Fatalf("second slot: %v %v", claimed, err)
	}
	blocked := enqueue("blocked", "board")
	if claimed, err := repository.ClaimDramaRun(blocked.ID); err != nil || claimed {
		t.Fatalf("concurrency limit exceeded: %v %v", claimed, err)
	}
	if _, err = service.CancelCurrentDramaRun(ctx, "project", "episode", "clip", interrupted.ID); err == nil {
		t.Fatal("submitted unknown task cancellation accepted")
	}
	db.First(&updated, "id = ?", "owner")
	if updated.Credits != 94 {
		t.Fatalf("cancel/recovery changed debit: %d", updated.Credits)
	}
	// Concurrent callers sharing a request ID may not obtain a run from another node.
	var wg sync.WaitGroup
	wg.Add(2)
	results := make(chan error, 2)
	for i, node := range []string{"node-a", "node-b"} {
		go func(i int, node string) {
			defer wg.Done()
			candidate := model.DramaRun{ID: fmt.Sprintf("collision-%d", i), UserID: "owner", ProjectID: "project", EpisodeID: "episode", ClipID: "clip", NodeID: node, RequestID: "collision", Kind: "image", Provider: "image", Status: "queued", ConcurrencyKey: "test", ConcurrencyLimit: 2}
			saved, err := repository.CreateDramaRun(candidate)
			if err == nil && saved.NodeID != node {
				err = fmt.Errorf("cross-node collision returned %s", saved.NodeID)
			}
			results <- err
		}(i, node)
	}
	wg.Wait()
	close(results)
	successes := 0
	for err := range results {
		if err == nil {
			successes++
		}
	}
	if successes != 1 {
		t.Fatalf("expected one collision winner, got %d", successes)
	}
	var count int64
	db.Model(&model.DramaRun{}).Where("request_id = ?", "collision").Count(&count)
	if count != 1 {
		t.Fatalf("idempotency row count %d", count)
	}
}
