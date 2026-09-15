package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

const dramaLocalProvider = "local-drama"
const DramaMediaLimit = 512 << 20

func dramaMediaPath(id string) (string, error) {
	if _, err := uuid.Parse(id); err != nil {
		return "", errors.New("媒体标识无效")
	}
	return filepath.Abs(filepath.Join("data", "media", id))
}

// UploadDramaMedia keeps media in the existing storage index, with a local disk provider.
func UploadDramaMedia(ctx context.Context, input io.Reader, contentType string) (UploadedStorageObject, error) {
	user, err := dramaUser(ctx)
	if err != nil {
		return UploadedStorageObject{}, err
	}
	id := uuid.NewString()
	target, err := dramaMediaPath(id)
	if err != nil {
		return UploadedStorageObject{}, err
	}
	if err = os.MkdirAll(filepath.Dir(target), 0700); err != nil {
		return UploadedStorageObject{}, err
	}
	file, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return UploadedStorageObject{}, err
	}
	complete := false
	defer func() {
		_ = file.Close()
		if !complete {
			_ = os.Remove(target)
		}
	}()
	head := make([]byte, 512)
	n, err := io.ReadFull(input, head)
	if err != nil && err != io.ErrUnexpectedEOF && err != io.EOF {
		return UploadedStorageObject{}, err
	}
	if n == 0 {
		return UploadedStorageObject{}, errors.New("不能保存空媒体")
	}
	detected := http.DetectContentType(head[:n])
	if detected != "application/octet-stream" {
		contentType = detected
	}
	if !(strings.HasPrefix(contentType, "image/") || strings.HasPrefix(contentType, "video/") || strings.HasPrefix(contentType, "audio/")) || strings.Contains(contentType, "svg") {
		return UploadedStorageObject{}, errors.New("仅支持图片、视频或音频媒体")
	}
	hash := sha256.New()
	size, err := io.Copy(io.MultiWriter(file, hash), io.LimitReader(io.MultiReader(bytes.NewReader(head[:n]), input), DramaMediaLimit+1))
	if err != nil {
		return UploadedStorageObject{}, err
	}
	if size > DramaMediaLimit {
		return UploadedStorageObject{}, errors.New("媒体文件不能超过512MB")
	}
	if err = file.Sync(); err != nil {
		return UploadedStorageObject{}, err
	}
	if err = file.Close(); err != nil {
		return UploadedStorageObject{}, err
	}
	object := model.StorageObject{ID: id, ProviderID: dramaLocalProvider, ObjectKey: "drama/" + id, MimeType: contentType, Bytes: size, SHA256: hex.EncodeToString(hash.Sum(nil)), CreatedBy: user, CreatedAt: now()}
	if _, err = repository.SaveStorageObject(object); err != nil {
		return UploadedStorageObject{}, err
	}
	complete = true
	return UploadedStorageObject{ID: id, URL: "/api/files/" + id + "/content", StorageKey: "server:" + id, Bytes: size, MimeType: contentType}, nil
}

func OpenDramaMedia(id string) (*os.File, model.StorageObject, bool, error) {
	object, err := repository.GetStorageObject(id)
	if err != nil {
		return nil, object, false, err
	}
	if object.ProviderID != dramaLocalProvider {
		return nil, object, false, nil
	}
	if object.DeletedAt != "" {
		return nil, object, true, os.ErrNotExist
	}
	target, err := dramaMediaPath(object.ID)
	if err != nil {
		return nil, object, true, err
	}
	file, err := os.Open(target)
	return file, object, true, err
}

func deleteDramaLocalMedia(id string) error {
	target, err := dramaMediaPath(id)
	if err != nil {
		return err
	}
	if err = os.Remove(target); err != nil && !os.IsNotExist(err) {
		return err
	}
	return repository.DeleteStorageObjectRecord(id)
}
