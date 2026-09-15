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
		if err := patchComfyUIWorkflow(prompt, comfyUIProfile{ID: test.profileID}, map[string]any{"images": []string{"source.png"}}); err != nil {
			t.Fatal(err)
		}
		if prompt["1"].Inputs["image"] != "source.png" || prompt[test.outputID].Inputs["filename_prefix"] == "old" {
			t.Fatalf("%s bindings were not patched: %#v", test.profileID, prompt)
		}
	}
}
