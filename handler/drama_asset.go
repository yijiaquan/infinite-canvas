package handler

import (
	"encoding/json"
	"github.com/tigerowo/infinite-canvas/service"
	"net/http"
)

func UserDramaAssets(w http.ResponseWriter, r *http.Request, projectID string) {
	data, err := service.CurrentUserDramaAssets(r.Context(), projectID)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}

func CreateUserDramaAsset(w http.ResponseWriter, r *http.Request, projectID string) {
	var input service.DramaAssetInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "资产参数无效")
		return
	}
	data, err := service.CreateCurrentUserDramaAsset(r.Context(), projectID, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}

func UpdateUserDramaAsset(w http.ResponseWriter, r *http.Request, projectID, assetID string) {
	var input service.DramaAssetInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "资产参数无效")
		return
	}
	data, err := service.UpdateCurrentUserDramaAsset(r.Context(), projectID, assetID, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}

func CreateUserDramaAssetVersion(w http.ResponseWriter, r *http.Request, projectID, assetID string) {
	var input service.DramaAssetVersionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "资产版本参数无效")
		return
	}
	data, err := service.CreateCurrentUserDramaAssetVersion(r.Context(), projectID, assetID, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}
