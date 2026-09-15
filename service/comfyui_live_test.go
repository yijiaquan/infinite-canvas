package service

import (
	"os"
	"testing"
)

func TestValidateComfyUIBaseURL(t *testing.T) {
	for _, value := range []string{"https://127.0.0.1:8188", "http://192.168.1.8:8188", "http://example.com:8188", "http://user@127.0.0.1:8188"} {
		if _, err := ValidateComfyUIBaseURL(value); err == nil {
			t.Fatalf("expected local URL validation to reject %q", value)
		}
	}
	if value, err := ValidateComfyUIBaseURL("http://127.0.0.1:8188/"); err != nil || value != "http://127.0.0.1:8188" {
		t.Fatalf("unexpected local URL result: %q, %v", value, err)
	}
}

func TestComfyUILiveWorkflowConversion(t *testing.T) {
	baseURL := os.Getenv("COMFYUI_LIVE_TEST_URL")
	if baseURL == "" {
		t.Skip("set COMFYUI_LIVE_TEST_URL to validate installed workflows")
	}
	workflows, err := ComfyUIWorkflows(baseURL)
	if err != nil {
		t.Fatal(err)
	}
	if len(workflows) != len(comfyUIProfiles) {
		t.Fatalf("expected %d workflow profiles, got %d", len(comfyUIProfiles), len(workflows))
	}
	for _, workflow := range workflows {
		if !workflow.Ready {
			t.Fatalf("workflow is not ready: %s", workflow.Filename)
		}
	}
	marker := func(kind string, index int) string {
		return "https://direct-reference.invalid/live-test/" + kind + "/" + string(rune('0'+index))
	}
	cases := []struct {
		model    string
		endpoint string
		input    map[string]any
	}{
		{"comfyui:minimax-h3-t2v", "/videos", map[string]any{"prompt": "test", "seconds": 5, "size": "16:9", "resolution_name": "480p"}},
		{"comfyui:minimax-h3-fl2v", "/videos", map[string]any{"prompt": "test", "first_frame_url": marker("image", 0), "last_frame_url": marker("image", 1)}},
		{"comfyui:minimax-h3-ref2v", "/videos", map[string]any{"prompt": "test", "input_reference[]": []any{marker("image", 0), marker("image", 1), marker("image", 2)}}},
		{"comfyui:minimax-music3", "/audio/speech", map[string]any{"input": "instrumental test"}},
		{"comfyui:openai-image", "/images/edits", map[string]any{"prompt": "test", "image": []any{marker("image", 0), marker("image", 1)}}},
		{"comfyui:seedvr2-image-upscale", "/images/edits", map[string]any{"image": []any{marker("image", 0)}}},
		{"comfyui:vosr2-image-upscale", "/images/edits", map[string]any{"image": []any{marker("image", 0)}}},
		{"comfyui:seedvr2-upscale", "/videos", map[string]any{"video_reference[]": []any{marker("video", 0)}, "resolution_name": "2k"}},
	}
	for _, test := range cases {
		t.Run(test.model, func(t *testing.T) {
			payload, kind, err := PrepareComfyUIWorkflow(baseURL, test.model, test.endpoint, test.input)
			if err != nil {
				t.Fatal(err)
			}
			if kind == "" || payload["prompt"] == nil {
				t.Fatalf("invalid prepared payload: %#v", payload)
			}
			if test.model == "comfyui:seedvr2-upscale" {
				prompt, ok := payload["prompt"].(map[string]comfyUIAPINode)
				if !ok {
					t.Fatalf("unexpected prompt type: %T", payload["prompt"])
				}
				resize := prompt["66:57"].Inputs
				if resize["resize_type"] != "scale longer dimension" || resize["longer_size"] != 2048 {
					t.Fatalf("installed SeedVR2 video resolution mapping is invalid: %#v", resize)
				}
			}
		})
	}
}
