package service

import (
	"context"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/tigerowo/infinite-canvas/config"
	"github.com/tigerowo/infinite-canvas/model"
)

func TestDramaParametersValidation(t *testing.T) {
	title := "Project"
	for _, tc := range []struct {
		name, stage, key string
		value            any
		valid            bool
	}{
		{"zero seed", "video", "seed", float64(0), true},
		{"largest seed", "video", "seed", float64(9007199254740991), true},
		{"fractional duration", "video", "seconds", 7.5, true},
		{"step upper bound", "video", "steps", float64(1000), true},
		{"size", "image", "size", "1536x1024", true},
		{"quality", "image", "quality", "high", true},
		{"resolution", "video", "resolution_name", "720p", true},
		{"unknown stage", "audio", "seed", float64(1), false},
		{"unknown parameter", "image", "apiKey", "secret", false},
		{"numeric string", "video", "steps", "12", false},
		{"fractional steps", "video", "steps", 12.5, false},
		{"fractional seed", "video", "seed", 1.5, false},
		{"zero steps", "video", "steps", float64(0), false},
		{"too many steps", "video", "steps", float64(1001), false},
		{"zero duration", "video", "seconds", float64(0), false},
		{"negative", "video", "seed", float64(-1), false},
		{"unsafe integer", "video", "seed", float64(9007199254740992), false},
		{"nan", "video", "seconds", math.NaN(), false},
		{"positive infinity", "video", "seconds", math.Inf(1), false},
		{"negative infinity", "video", "seconds", math.Inf(-1), false},
		{"wrong text type", "image", "size", float64(1), false},
		{"long text", "image", "quality", strings.Repeat("x", 101), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			defaults := map[string]map[string]any{tc.stage: {tc.key: tc.value}}
			err := validateDramaProject(DramaProjectInput{Title: &title, GenerationDefaults: &defaults}, true)
			if (err == nil) != tc.valid {
				t.Fatalf("valid=%v error=%v", tc.valid, err)
			}
		})
	}
}

func TestDramaParametersCRUD(t *testing.T) {
	if os.Getenv("DRAMA_PARAMETERS_TEST_DIR") == "" {
		cmd := exec.Command(os.Args[0], "-test.run=^TestDramaParametersCRUD$", "-test.v")
		cmd.Env = append(os.Environ(), "DRAMA_PARAMETERS_TEST_DIR="+t.TempDir())
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v\n%s", err, out)
		}
		return
	}
	dir := os.Getenv("DRAMA_PARAMETERS_TEST_DIR")
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	config.Cfg.StorageDriver = "sqlite"
	config.Cfg.DatabaseDSN = filepath.Join(dir, "parameters.db")
	ctx := WithUser(context.Background(), model.AuthUser{ID: "owner"})
	other := WithUser(context.Background(), model.AuthUser{ID: "other"})
	title := "Original"
	defaults := map[string]map[string]any{"image": {"quality": "high"}, "video": {"steps": float64(12), "seconds": 7.5, "seed": float64(0)}}
	project, err := CreateCurrentUserDramaProject(ctx, DramaProjectInput{Title: &title, GenerationDefaults: &defaults})
	if err != nil {
		t.Fatal(err)
	}
	assertSaved := func(revision int64, want map[string]map[string]any) {
		t.Helper()
		detail, err := CurrentUserDramaProject(ctx, project.ID)
		if err != nil {
			t.Fatal(err)
		}
		if detail.Project.Revision != revision || !reflect.DeepEqual(detail.Project.GenerationDefaults, want) {
			t.Fatalf("revision/defaults mismatch: %+v", detail.Project)
		}
	}
	assertSaved(1, defaults)
	if _, err = CurrentUserDramaProject(other, project.ID); err == nil {
		t.Fatal("other user read project")
	}
	if _, err = UpdateCurrentUserDramaProject(other, project.ID, DramaProjectInput{ExpectedRevision: 1, GenerationDefaults: &defaults}); err == nil {
		t.Fatal("other user updated project")
	}
	title = "Renamed"
	if _, err = UpdateCurrentUserDramaProject(ctx, project.ID, DramaProjectInput{Title: &title, ExpectedRevision: 1}); err != nil {
		t.Fatal(err)
	}
	assertSaved(2, defaults)
	replacement := map[string]map[string]any{"video": {"steps": float64(20)}}
	if _, err = UpdateCurrentUserDramaProject(ctx, project.ID, DramaProjectInput{ExpectedRevision: 1, GenerationDefaults: &replacement}); err == nil {
		t.Fatal("stale revision replaced defaults")
	}
	assertSaved(2, defaults)
	invalid := map[string]map[string]any{"video": {"steps": 2.5}}
	if _, err = UpdateCurrentUserDramaProject(ctx, project.ID, DramaProjectInput{ExpectedRevision: 2, GenerationDefaults: &invalid}); err == nil {
		t.Fatal("invalid defaults persisted")
	}
	assertSaved(2, defaults)
	if _, err = UpdateCurrentUserDramaProject(ctx, project.ID, DramaProjectInput{ExpectedRevision: 2, GenerationDefaults: &replacement}); err != nil {
		t.Fatal(err)
	}
	assertSaved(3, replacement)
	empty := map[string]map[string]any{}
	if _, err = UpdateCurrentUserDramaProject(ctx, project.ID, DramaProjectInput{ExpectedRevision: 3, GenerationDefaults: &empty}); err != nil {
		t.Fatal(err)
	}
	assertSaved(4, empty)
	if _, err = CreateCurrentUserDramaProject(context.Background(), DramaProjectInput{Title: &title, GenerationDefaults: &defaults}); err == nil {
		t.Fatal("anonymous project creation")
	}
}
