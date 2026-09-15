package handler

import (
	"encoding/json"
	"github.com/tigerowo/infinite-canvas/service"
	"net/http"
)

func UserDramaClips(w http.ResponseWriter, r *http.Request, projectID, episodeID string) {
	data, err := service.CurrentUserDramaClips(r.Context(), projectID, episodeID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}

func ReorderUserDramaClips(w http.ResponseWriter, r *http.Request, projectID, episodeID string) {
	var input service.DramaClipReorderInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "Clip 排序参数无效")
		return
	}
	data, err := service.ReorderCurrentUserDramaClips(r.Context(), projectID, episodeID, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}

func CreateUserDramaClip(w http.ResponseWriter, r *http.Request, projectID, episodeID string) {
	var input service.DramaClipInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "Clip 参数无效")
		return
	}
	data, err := service.CreateCurrentUserDramaClip(r.Context(), projectID, episodeID, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}

func UpdateUserDramaClip(w http.ResponseWriter, r *http.Request, projectID, episodeID, id string) {
	var input service.DramaClipInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "Clip 参数无效")
		return
	}
	data, err := service.UpdateCurrentUserDramaClip(r.Context(), projectID, episodeID, id, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}
