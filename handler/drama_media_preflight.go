package handler

import (
	"github.com/tigerowo/infinite-canvas/service"
	"net/http"
)

func PreflightDeleteFile(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.PreflightDeleteStorageObject(r.Context(), id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}
