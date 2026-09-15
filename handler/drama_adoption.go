package handler

import (
	"encoding/json"
	"github.com/tigerowo/infinite-canvas/service"
	"net/http"
	"os"
)

func UserDramaAdoption(w http.ResponseWriter, r *http.Request, p, e, c string) {
	value, err := service.CurrentDramaAdoptions(r.Context(), p, e, c)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, value)
}
func AdoptUserDramaOutput(w http.ResponseWriter, r *http.Request, p, e, c string) {
	var input service.DramaAdoptionInput
	if json.NewDecoder(r.Body).Decode(&input) != nil {
		Fail(w, "采用参数无效")
		return
	}
	value, err := service.AdoptDramaOutput(r.Context(), p, e, c, input)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, value)
}
func ExportDramaEpisode(w http.ResponseWriter, r *http.Request, p, e string) {
	file, err := service.ExportDramaEpisode(r.Context(), p, e, r.URL.Query().Get("partial") == "true")
	if err != nil {
		FailError(w, err)
		return
	}
	defer func() { _ = file.Close(); _ = os.Remove(file.Name()) }()
	info, err := file.Stat()
	if err != nil {
		FailError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="episode.zip"`)
	http.ServeContent(w, r, "episode.zip", info.ModTime(), file)
}
