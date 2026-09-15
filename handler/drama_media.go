package handler

import (
	"github.com/tigerowo/infinite-canvas/service"
	"net/http"
)

func UploadDramaMedia(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, service.DramaMediaLimit+(1<<20))
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		Fail(w, "媒体上传失败或文件过大")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		Fail(w, "请选择媒体文件")
		return
	}
	defer file.Close()
	result, err := service.UploadDramaMedia(r.Context(), file, header.Header.Get("Content-Type"))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}
