package handler

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestImageCandidateBytesReadsComfyUIProxyURL(t *testing.T) {
	var encoded bytes.Buffer
	source := image.NewRGBA(image.Rect(0, 0, 135, 240))
	source.Set(0, 0, color.White)
	if err := png.Encode(&encoded, source); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/view" || r.URL.Query().Get("filename") != "result.png" {
			t.Fatalf("unexpected ComfyUI view request: %s", r.URL.String())
		}
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(encoded.Bytes())
	}))
	defer server.Close()

	value := "/api/ai/comfyui/view?baseUrl=" + url.QueryEscape(server.URL) + "&filename=result.png&type=output"
	data, mimeType, err := imageCandidateBytes(value)
	if err != nil {
		t.Fatal(err)
	}
	width, height := imageSize(data)
	if width != 135 || height != 240 || int64(len(data)) != int64(encoded.Len()) || mimeType != "image/png" {
		t.Fatalf("metadata = %dx%d, %d bytes, %q", width, height, len(data), mimeType)
	}
}
