package service

import "testing"

func TestDramaExportMediaExtensions(t *testing.T) {
	for mime, want := range map[string]string{"video/mp4": ".mp4", "video/mp4; codecs=avc1": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov", "audio/mpeg": ".mp3", "audio/wav": ".wav", "image/png": ".png"} {
		if got := extensionForContentType(mime); got != want {
			t.Fatalf("%s: got %s want %s", mime, got, want)
		}
	}
}
