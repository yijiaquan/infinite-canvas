package service

import (
	"bytes"
	"context"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/tigerowo/infinite-canvas/config"
	"github.com/tigerowo/infinite-canvas/model"
)

func TestDramaLocalMedia(t *testing.T) {
	if os.Getenv("DRAMA_MEDIA_TEST_DIR") == "" {
		cmd := exec.Command(os.Args[0], "-test.run=^TestDramaLocalMedia$")
		cmd.Env = append(os.Environ(), "DRAMA_MEDIA_TEST_DIR="+t.TempDir())
		if output, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v: %s", err, output)
		}
		return
	}
	dir := os.Getenv("DRAMA_MEDIA_TEST_DIR")
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	config.Cfg.StorageDriver = "sqlite"
	config.Cfg.DatabaseDSN = filepath.Join(dir, "test.db")
	ctx := WithUser(context.Background(), model.AuthUser{ID: "owner"})
	data := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 100)...)
	if _, err := UploadDramaMedia(context.Background(), bytes.NewReader(data), "image/png"); err == nil {
		t.Fatal("anonymous upload accepted")
	}
	for _, invalid := range [][]byte{nil, []byte("<html>bad</html>")} {
		if _, err := UploadDramaMedia(ctx, bytes.NewReader(invalid), "image/png"); err == nil {
			t.Fatal("invalid media accepted")
		}
	}
	saved, err := UploadDramaMedia(ctx, bytes.NewReader(data), "image/png")
	if err != nil {
		t.Fatal(err)
	}
	file, object, local, err := OpenDramaMedia(saved.ID)
	if err != nil || !local {
		t.Fatalf("missing media: %v", err)
	}
	got, err := io.ReadAll(file)
	_ = file.Close()
	if err != nil || !bytes.Equal(got, data) || object.CreatedBy != "owner" || object.SHA256 == "" {
		t.Fatal("media data or ownership lost")
	}
	if _, err := dramaMediaPath("../../outside"); err == nil {
		t.Fatal("invalid local path accepted")
	}
}
