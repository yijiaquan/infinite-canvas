package handler

import (
	"encoding/json"
	"github.com/tigerowo/infinite-canvas/service"
	"net/http"
)

func UserDramaProjects(w http.ResponseWriter, r *http.Request) {
	data, err := service.CurrentUserDramaProjects(r.Context())
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}

func UserDramaProject(w http.ResponseWriter, r *http.Request, id string) {
	data, err := service.CurrentUserDramaProject(r.Context(), id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}

func CreateUserDramaProject(w http.ResponseWriter, r *http.Request) {
	var input service.DramaProjectInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "项目参数无效")
		return
	}
	data, err := service.CreateCurrentUserDramaProject(r.Context(), input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}

func UpdateUserDramaProject(w http.ResponseWriter, r *http.Request, id string) {
	var input service.DramaProjectInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "项目参数无效")
		return
	}
	data, err := service.UpdateCurrentUserDramaProject(r.Context(), id, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}

func CreateUserDramaEpisode(w http.ResponseWriter, r *http.Request, projectID string) {
	var input service.DramaEpisodeInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "分集参数无效")
		return
	}
	data, err := service.CreateCurrentUserDramaEpisode(r.Context(), projectID, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}

func UpdateUserDramaEpisode(w http.ResponseWriter, r *http.Request, projectID, id string) {
	var input service.DramaEpisodeInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "分集参数无效")
		return
	}
	data, err := service.UpdateCurrentUserDramaEpisode(r.Context(), projectID, id, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}
