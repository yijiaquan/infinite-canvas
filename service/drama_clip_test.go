package service

import (
	"context"
	"encoding/json"
	"github.com/tigerowo/infinite-canvas/config"
	"github.com/tigerowo/infinite-canvas/model"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestDramaClipValidation(t *testing.T) {
	title := "Clip"
	for _, duration := range []float64{0, -1, math.NaN(), math.Inf(1)} {
		shots := []model.DramaShot{{ID: "shot-1", Duration: duration}}
		if validateDramaClip(DramaClipInput{Title: &title, Shots: &shots}, true) == nil {
			t.Fatalf("accepted duration %v", duration)
		}
	}
	for _, shots := range [][]model.DramaShot{
		{{ID: "", Duration: 1}}, {{ID: " padded ", Duration: 1}}, {{ID: "same", Duration: 1}, {ID: "same", Duration: 2}},
	} {
		if validateDramaClip(DramaClipInput{Title: &title, Shots: &shots}, true) == nil {
			t.Fatal("invalid IDs accepted")
		}
	}
	if validateDramaClip(DramaClipInput{}, false) == nil {
		t.Fatal("missing revision accepted")
	}
}

func TestDramaClipLifecycle(t *testing.T) {
	// 独立进程防止复用任何现有数据库单例。
	if os.Getenv("DRAMA_CLIP_TEST_DATABASE") == "" {
		cmd := exec.Command(os.Args[0], "-test.run=^TestDramaClipLifecycle$", "-test.v")
		cmd.Env = append(os.Environ(), "DRAMA_CLIP_TEST_DATABASE="+filepath.Join(t.TempDir(), "clips.db"))
		if output, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v\n%s", err, output)
		}
		return
	}
	config.Cfg.StorageDriver = "sqlite"
	config.Cfg.DatabaseDSN = os.Getenv("DRAMA_CLIP_TEST_DATABASE")
	owner := WithUser(context.Background(), model.AuthUser{ID: "owner"})
	other := WithUser(context.Background(), model.AuthUser{ID: "other"})
	title := "Project"
	project, err := CreateCurrentUserDramaProject(owner, DramaProjectInput{Title: &title})
	if err != nil {
		t.Fatal(err)
	}
	ep1, err := CreateCurrentUserDramaEpisode(owner, project.ID, DramaEpisodeInput{Title: &title})
	if err != nil {
		t.Fatal(err)
	}
	ep2, err := CreateCurrentUserDramaEpisode(owner, project.ID, DramaEpisodeInput{Title: &title})
	if err != nil {
		t.Fatal(err)
	}
	project2, err := CreateCurrentUserDramaProject(owner, DramaProjectInput{Title: &title})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := CurrentUserDramaClips(other, project.ID, ep1.ID); err == nil {
		t.Fatal("foreign list accepted")
	}
	if _, err := CurrentUserDramaClips(owner, project2.ID, ep1.ID); err == nil {
		t.Fatal("wrong project/episode accepted")
	}
	empty, err := CurrentUserDramaClips(owner, project.ID, ep1.ID)
	if err != nil || empty == nil || len(empty) != 0 {
		t.Fatal("empty list must be []")
	}
	if _, err := CreateCurrentUserDramaClip(context.Background(), project.ID, ep1.ID, DramaClipInput{Title: &title}); err == nil {
		t.Fatal("anonymous create")
	}
	if _, err := CreateCurrentUserDramaClip(other, project.ID, ep1.ID, DramaClipInput{Title: &title}); err == nil {
		t.Fatal("foreign create")
	}
	shots := []model.DramaShot{{ID: "shot-stable-1", Title: "Opening", Duration: 2.75, Action: "look", Dialogue: "hello", Speaker: "voice-1", Camera: "close", Sound: "room", EntryState: "door closed", ExitState: "door open"}}
	summary := "Summary"
	clip, err := CreateCurrentUserDramaClip(owner, project.ID, ep1.ID, DramaClipInput{Title: &title, Summary: &summary, Shots: &shots})
	if err != nil {
		t.Fatal(err)
	}
	if clip.Position != 1 || clip.Revision != 1 || len(clip.Shots) != 1 || clip.Shots[0].Duration != 2.75 {
		t.Fatalf("create mismatch %+v", clip)
	}
	clip2, err := CreateCurrentUserDramaClip(owner, project.ID, ep1.ID, DramaClipInput{Title: &title})
	if err != nil || clip2.Position != 2 || clip2.Shots == nil {
		t.Fatalf("default create %+v %v", clip2, err)
	}
	if _, err := UpdateCurrentUserDramaClip(owner, project.ID, ep2.ID, clip.ID, DramaClipInput{ExpectedRevision: 1}); err == nil {
		t.Fatal("cross episode update")
	}
	if _, err := UpdateCurrentUserDramaClip(other, project.ID, ep1.ID, clip.ID, DramaClipInput{ExpectedRevision: 1}); err == nil {
		t.Fatal("cross user update")
	}
	newTitle := "Updated"
	clip, err = UpdateCurrentUserDramaClip(owner, project.ID, ep1.ID, clip.ID, DramaClipInput{Title: &newTitle, ExpectedRevision: 1})
	if err != nil {
		t.Fatal(err)
	}
	if clip.Title != newTitle || clip.Summary != summary || clip.Shots[0].ID != "shot-stable-1" || clip.Shots[0].Duration != 2.75 || clip.Shots[0].Dialogue != "hello" {
		t.Fatal("partial update lost fields")
	}
	if _, err := UpdateCurrentUserDramaClip(owner, project.ID, ep1.ID, clip.ID, DramaClipInput{Title: &title, ExpectedRevision: 1}); err == nil {
		t.Fatal("stale write accepted")
	}
	shots[0].Duration = 3.125
	clip, err = UpdateCurrentUserDramaClip(owner, project.ID, ep1.ID, clip.ID, DramaClipInput{Shots: &shots, ExpectedRevision: 2})
	if err != nil || clip.Shots[0].ID != "shot-stable-1" || clip.Shots[0].Duration != 3.125 {
		t.Fatalf("shot replace: %v %+v", err, clip)
	}
	archived := true
	clip, err = UpdateCurrentUserDramaClip(owner, project.ID, ep1.ID, clip.ID, DramaClipInput{Archived: &archived, ExpectedRevision: 3})
	if err != nil || !clip.Archived {
		t.Fatal("archive failed")
	}
	items, err := CurrentUserDramaClips(owner, project.ID, ep1.ID)
	if err != nil || len(items) != 2 || !items[0].Archived || items[0].Shots[0].ID != "shot-stable-1" {
		t.Fatal("archive removed history/content")
	}
	archived = false
	clear := ""
	shots = []model.DramaShot{}
	clip, err = UpdateCurrentUserDramaClip(owner, project.ID, ep1.ID, clip.ID, DramaClipInput{Archived: &archived, Summary: &clear, Shots: &shots, ExpectedRevision: 4})
	if err != nil || clip.Archived || clip.Summary != "" || clip.Shots == nil || len(clip.Shots) != 0 {
		t.Fatalf("restore/clear failed: %v %+v", err, clip)
	}
	raw, err := json.Marshal(clip)
	if err != nil {
		t.Fatal(err)
	}
	var wire map[string]json.RawMessage
	_ = json.Unmarshal(raw, &wire)
	if string(wire["shots"]) != "[]" {
		t.Fatal("shots must serialize as []")
	}
	otherEpisode, err := CurrentUserDramaClips(owner, project.ID, ep2.ID)
	if err != nil || len(otherEpisode) != 0 {
		t.Fatal("cross episode list leaked")
	}
	order := DramaClipReorderInput{Clips: []model.DramaClipOrder{{ID: clip2.ID, ExpectedRevision: clip2.Revision}, {ID: clip.ID, ExpectedRevision: clip.Revision}}}
	if _, err := ReorderCurrentUserDramaClips(other, project.ID, ep1.ID, order); err == nil {
		t.Fatal("foreign reorder accepted")
	}
	if _, err := ReorderCurrentUserDramaClips(owner, project.ID, ep2.ID, order); err == nil {
		t.Fatal("cross episode reorder accepted")
	}
	if _, err := ReorderCurrentUserDramaClips(owner, project.ID, ep1.ID, DramaClipReorderInput{Clips: order.Clips[:1]}); err == nil {
		t.Fatal("incomplete reorder accepted")
	}
	duplicate := DramaClipReorderInput{Clips: []model.DramaClipOrder{order.Clips[0], order.Clips[0]}}
	if _, err := ReorderCurrentUserDramaClips(owner, project.ID, ep1.ID, duplicate); err == nil {
		t.Fatal("duplicate reorder accepted")
	}
	stale := DramaClipReorderInput{Clips: append([]model.DramaClipOrder(nil), order.Clips...)}
	stale.Clips[1].ExpectedRevision--
	if _, err := ReorderCurrentUserDramaClips(owner, project.ID, ep1.ID, stale); err == nil {
		t.Fatal("stale reorder accepted")
	}
	unchanged, err := CurrentUserDramaClips(owner, project.ID, ep1.ID)
	if err != nil || unchanged[0].ID != clip.ID || unchanged[1].Revision != clip2.Revision {
		t.Fatal("failed reorder partially applied")
	}
	ordered, err := ReorderCurrentUserDramaClips(owner, project.ID, ep1.ID, order)
	if err != nil || len(ordered) != 2 || ordered[0].ID != clip2.ID || ordered[1].ID != clip.ID || ordered[0].Revision != clip2.Revision+1 {
		t.Fatalf("reorder failed %v %+v", err, ordered)
	}
	archived = true
	if _, err := UpdateCurrentUserDramaClip(owner, project.ID, ep1.ID, clip.ID, DramaClipInput{Archived: &archived, ExpectedRevision: ordered[1].Revision}); err != nil {
		t.Fatal(err)
	}
	order.Clips[0].ExpectedRevision = ordered[0].Revision
	order.Clips[1].ExpectedRevision = ordered[1].Revision + 1
	if _, err := ReorderCurrentUserDramaClips(owner, project.ID, ep1.ID, order); err == nil {
		t.Fatal("archived reorder accepted")
	}
	if _, err := ReorderCurrentUserDramaClips(owner, project.ID, ep1.ID, DramaClipReorderInput{Clips: order.Clips[:1]}); err != nil {
		t.Fatal(err)
	}
}
