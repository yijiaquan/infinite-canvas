package handler

import (
	"encoding/json"
	"github.com/tigerowo/infinite-canvas/service"
	"net/http"
)

func ImportUserDramaOutput(w http.ResponseWriter, r *http.Request, p, e, c string) {
	var input service.DramaImportOutputInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		Fail(w, "导入参数无效")
		return
	}
	data, err := service.ImportDramaOutput(r.Context(), p, e, c, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, data)
}
