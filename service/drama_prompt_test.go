package service

import (
	"testing"

	"github.com/tigerowo/infinite-canvas/model"
)

func TestCompileDramaPromptPreservesProviderPrompt(t *testing.T) {
	prompt := "<Picture 1> 是完整故事板"
	if got := CompileDramaPromptWithMapping(prompt, nil); got != prompt {
		t.Fatal("modern prompt changed")
	}
}

func TestCompileDramaPromptCompilesNativeCanvasLabels(t *testing.T) {
	mapping := []model.DramaRunInputMapping{
		{StorageID: "board", Tag: "<Picture 1>", Kind: "image"},
		{StorageID: "identity", Tag: "<Picture 2>", Kind: "image"},
		{StorageID: "motion", Tag: "<Audio 1>", Kind: "embedded_audio"},
		{StorageID: "motion", Tag: "<Video 1>", Kind: "video"},
		{StorageID: "voice", Tag: "<Audio 2>", Kind: "audio"},
	}
	prompt := "图片1 是故事板，图片2 固定身份，视频1 提供动作，音频1 提供音色。"
	want := "<Picture 1> 是故事板，<Picture 2> 固定身份，<Video 1> 提供动作，<Audio 2> 提供音色。"
	if got := CompileDramaPromptWithMapping(prompt, mapping); got != want {
		t.Fatalf("unexpected prompt:\n%s", got)
	}
}
