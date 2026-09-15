package service

import "testing"

func TestComfyUIOptionalGenerationDefaults(t *testing.T) {
	makePrompt := func() map[string]comfyUIAPINode {
		return map[string]comfyUIAPINode{
			"132": {Inputs: map[string]any{"value": 12.0}},
			"129": {Inputs: map[string]any{"noise_seed": int64(42), "steps": 12}},
			"115": {Inputs: map[string]any{"aspect_ratio": "1:1 (Square)", "megapixels": 1.2}},
		}
	}
	prompt := makePrompt()
	profile := comfyUIProfile{ID: "comfyui:minimax-h3-t2v"}
	if err := patchComfyUIWorkflow(prompt, profile, map[string]any{"prompt": "test"}); err != nil {
		t.Fatal(err)
	}
	if prompt["132"].Inputs["value"] != 12.0 || prompt["129"].Inputs["noise_seed"] != int64(42) || prompt["129"].Inputs["steps"] != 12 {
		t.Fatalf("workflow duration, seed or steps changed: %#v", prompt)
	}
	if prompt["115"].Inputs["aspect_ratio"] != "1:1 (Square)" || prompt["115"].Inputs["megapixels"] != 1.2 {
		t.Fatal("unspecified resolution changed")
	}
	if err := patchComfyUIWorkflow(prompt, profile, map[string]any{"seconds": "7.5", "seed": "0"}); err != nil {
		t.Fatal(err)
	}
	if prompt["132"].Inputs["value"] != 7.5 || prompt["129"].Inputs["noise_seed"] != int64(0) {
		t.Fatal("explicit duration or zero seed ignored")
	}
	for _, input := range []map[string]any{{"seconds": "NaN"}, {"seconds": 31}, {"seed": -1}, {"seed": 0.5}} {
		if err := patchComfyUIWorkflow(makePrompt(), profile, input); err == nil {
			t.Fatalf("invalid explicit input accepted: %#v", input)
		}
	}
}

func TestComfyUIRejectsExtraReferences(t *testing.T) {
	for _, count := range []int{2, 4} {
		refs := make([]string, count)
		for i := range refs {
			refs[i] = "reference.png"
		}
		if err := patchComfyUIWorkflow(map[string]comfyUIAPINode{}, comfyUIProfile{ID: "comfyui:minimax-h3-ref2v"}, map[string]any{"images": refs}); err == nil {
			t.Fatalf("accepted %d references", count)
		}
	}
	if err := patchComfyUIWorkflow(map[string]comfyUIAPINode{}, comfyUIProfile{ID: "comfyui:seedvr2-upscale"}, map[string]any{"videos": []string{"a.mp4", "b.mp4"}}); err == nil {
		t.Fatal("silently discarded extra video")
	}
	for _, profileID := range []string{"comfyui:seedvr2-image-upscale", "comfyui:vosr2-image-upscale"} {
		if err := patchComfyUIWorkflow(map[string]comfyUIAPINode{}, comfyUIProfile{ID: profileID}, map[string]any{"images": []string{"a.png", "b.png"}}); err == nil {
			t.Fatalf("%s silently discarded extra image", profileID)
		}
	}
}

func TestComfyUIImageUpscaleBindings(t *testing.T) {
	tests := []struct {
		profileID, outputID string
	}{
		{"comfyui:seedvr2-image-upscale", "11"},
		{"comfyui:vosr2-image-upscale", "4"},
	}
	for _, test := range tests {
		prompt := map[string]comfyUIAPINode{
			"1":           {Inputs: map[string]any{"image": "old.png"}},
			test.outputID: {Inputs: map[string]any{"filename_prefix": "old"}},
		}
		if test.profileID == "comfyui:seedvr2-image-upscale" {
			prompt["2"] = comfyUIAPINode{Inputs: map[string]any{"resize_type": "scale by multiplier", "multiplier": 2.0, "scale_method": "lanczos"}}
		}
		if err := patchComfyUIWorkflow(prompt, comfyUIProfile{ID: test.profileID}, map[string]any{"images": []string{"source.png"}, "quality": "high"}); err != nil {
			t.Fatal(err)
		}
		if prompt["1"].Inputs["image"] != "source.png" || prompt[test.outputID].Inputs["filename_prefix"] == "old" {
			t.Fatalf("%s bindings were not patched: %#v", test.profileID, prompt)
		}
		if test.profileID == "comfyui:seedvr2-image-upscale" {
			if prompt["2"].Inputs["resize_type"] != "scale longer dimension" || prompt["2"].Inputs["longer_size"] != 3840 {
				t.Fatalf("SeedVR2 4K resolution was not patched: %#v", prompt["2"].Inputs)
			}
		} else {
			if prompt["99001"].Inputs["longer_size"] != 3840 || prompt["4"].Inputs["images"].([]any)[0] != "99001" {
				t.Fatalf("VOSR2 4K output resize was not patched: %#v", prompt)
			}
		}
	}
}

func TestComfyUIImageUpscaleDefaultsTo2K(t *testing.T) {
	if got := comfyUIImageUpscaleLongEdge(map[string]any{"quality": "medium"}); got != 2048 {
		t.Fatalf("2K long edge = %d, want 2048", got)
	}
}

func TestComfyUIVideoUpscaleBindings(t *testing.T) {
	for _, test := range []struct {
		resolution string
		longEdge   int
	}{
		{"720p", 1280},
		{"1080p", 1920},
		{"2K", 2048},
	} {
		prompt := map[string]comfyUIAPINode{
			"66:57": {Inputs: map[string]any{"resize_type": "scale by multiplier", "multiplier": 1.2, "scale_method": "nearest-exact"}},
			"73":    {Inputs: map[string]any{"file": "old.mp4"}},
			"76":    {Inputs: map[string]any{"filename_prefix": "old"}},
		}
		input := map[string]any{"videos": []string{"source.mp4"}, "resolution_name": test.resolution}
		if err := patchComfyUIWorkflow(prompt, comfyUIProfile{ID: "comfyui:seedvr2-upscale"}, input); err != nil {
			t.Fatal(err)
		}
		resize := prompt["66:57"].Inputs
		if resize["resize_type"] != "scale longer dimension" || resize["longer_size"] != test.longEdge || resize["scale_method"] != "lanczos" {
			t.Fatalf("%s resolution was not patched: %#v", test.resolution, resize)
		}
		if _, ok := resize["multiplier"]; ok {
			t.Fatalf("%s retained multiplier: %#v", test.resolution, resize)
		}
	}
}

func TestComfyUIVideoUpscaleDefaultsTo720P(t *testing.T) {
	if got := comfyUIVideoUpscaleLongEdge(map[string]any{}); got != 1280 {
		t.Fatalf("default video long edge = %d, want 1280", got)
	}
}
