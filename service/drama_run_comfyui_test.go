package service

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestDramaComfyUILiveCompileOnly(t *testing.T) {
	base := os.Getenv("COMFYUI_LIVE_TEST_URL")
	if base == "" {
		t.Skip("set COMFYUI_LIVE_TEST_URL for read-only workflow compilation")
	}
	refs := []DramaComfyUIReference{{Kind: "image", Filename: "mock-board.png"}, {Kind: "image", Filename: "mock-character.png"}, {Kind: "image", Filename: "mock-scene.png"}, {Kind: "image", Filename: "mock-prop.png"}, {Kind: "audio", Filename: "mock-voice.wav"}, {Kind: "video", Filename: "mock-video.mp4"}}
	graph, err := PrepareDramaComfyUIWorkflow(context.Background(), base, "compile-only-test", "frozen prompt", map[string]any{}, refs)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(graph)
	for _, ref := range refs {
		if !strings.Contains(string(raw), ref.Filename) {
			t.Fatalf("reference lost: %s", ref.Filename)
		}
	}
	if !strings.Contains(string(raw), "infinite-canvas/drama/compile-only-test/video") {
		t.Fatal("missing isolated output prefix")
	}
	api := graph["prompt"].(map[string]comfyUIAPINode)
	if _, ok := api["137"]; ok {
		t.Fatal("unbound top-level loader leaked into execution")
	}
	explicit, err := PrepareDramaComfyUIWorkflow(context.Background(), base, "compile-only-test", "prompt", map[string]any{"steps": 13, "seed": 0, "seconds": 7.5}, refs[:1])
	if err != nil {
		t.Fatal(err)
	}
	foundSteps := false
	for _, node := range explicit["prompt"].(map[string]comfyUIAPINode) {
		if node.Inputs["steps"] == 13 {
			foundSteps = true
		}
	}
	if !foundSteps {
		t.Fatal("explicit exposed steps missing")
	}
}
