package service

import (
	"github.com/tigerowo/infinite-canvas/model"
	"testing"
)

func TestDramaH3MappingAccountsForVideoAudio(t *testing.T) {
	refs := []model.DramaRunReference{{Order: 0, StorageID: "board"}, {Order: 1, StorageID: "voice", Speaker: "A"}, {Order: 2, StorageID: "video-silent"}, {Order: 3, StorageID: "video-audio"}, {Order: 4, StorageID: "identity"}}
	kinds := []string{"image", "audio", "video", "video", "image"}
	mapping, err := DramaH3InputMapping(refs, kinds, map[int]bool{2: false, 3: true})
	if err != nil {
		t.Fatal(err)
	}
	expected := []struct{ storage, tag, port string }{{"board", "<Picture 1>", "picture_1_keyframe"}, {"identity", "<Picture 2>", "picture_2_identity"}, {"video-silent", "<Video 1>", "video_1_frames"}, {"video-audio", "<Audio 1>", "video_2_audio"}, {"video-audio", "<Video 2>", "video_2_frames"}, {"voice", "<Audio 2>", "audio_1"}}
	if len(mapping) != len(expected) {
		t.Fatal("mapping size")
	}
	for i, item := range mapping {
		want := expected[i]
		if item.StorageID != want.storage || item.Tag != want.tag || item.Port != want.port || item.PresentationOrder != i+1 {
			t.Fatalf("mapping %d: %#v", i, item)
		}
	}
	if mapping[5].Speaker != "A" {
		t.Fatal("speaker lost")
	}
	if _, err = DramaH3InputMapping(refs, kinds, map[int]bool{3: true}); err == nil {
		t.Fatal("unknown soundtrack guessed")
	}
}

func TestDramaH3MappingWithoutKeyframeStartsAtPictureTwo(t *testing.T) {
	refs := []model.DramaRunReference{{Order: 0, StorageID: "board", Role: "storyboard"}, {Order: 1, StorageID: "identity"}, {Order: 2, StorageID: "scene"}}
	mapping, err := DramaH3InputMappingWithoutKeyframe(refs, []string{"image", "image", "image"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := mapping[0].Port, "picture_2_identity"; got != want {
		t.Fatalf("first visual port = %q, want %q", got, want)
	}
	if got, want := mapping[1].Port, "picture_3_scene"; got != want {
		t.Fatalf("second visual port = %q, want %q", got, want)
	}
	if got, want := mapping[0].Tag, "<Picture 1>"; got != want {
		t.Fatalf("first visual tag = %q, want %q", got, want)
	}
	if got, want := mapping[0].StorageID, "board"; got != want {
		t.Fatalf("first visual storage = %q, want %q", got, want)
	}
	if got, want := mapping[2].Port, "picture_4"; got != want {
		t.Fatalf("scene port = %q, want %q", got, want)
	}
}
