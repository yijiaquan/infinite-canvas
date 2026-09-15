package handler

import (
	"encoding/json"
	"github.com/tigerowo/infinite-canvas/service"
	"net/http"
)

func UserDramaBinding(w http.ResponseWriter, r *http.Request, p, e, c, stage string) {
	value, err := service.CurrentDramaBinding(r.Context(), p, e, c, stage)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, value)
}
func UpdateUserDramaBinding(w http.ResponseWriter, r *http.Request, p, e, c, stage string) {
	var input service.DramaBindingInput
	if json.NewDecoder(r.Body).Decode(&input) != nil {
		Fail(w, "输入绑定无效")
		return
	}
	value, err := service.UpdateCurrentDramaBinding(r.Context(), p, e, c, stage, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, value)
}
