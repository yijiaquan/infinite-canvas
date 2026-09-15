package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestComfyUIMissingHistoryChecksQueue(t *testing.T) {
	for _, test := range []struct {
		name, queue, status string
		queueCode           int
	}{
		{"running", `{"queue_running":[[1,"job",{},{}]]}`, "processing", 200},
		{"queued", `{"queue_pending":[[1,"job",{},{}]]}`, "queued", 200},
		{"missing", `{"queue_running":[],"queue_pending":[]}`, "unknown", 200},
		{"other job", `{"queue_running":[[1,"other",{},{}]]}`, "unknown", 200},
		{"unavailable", `{}`, "unknown", 503},
		{"malformed", `not-json`, "unknown", 200},
	} {
		t.Run(test.name, func(t *testing.T) {
			queueRead := false
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/history/job":
					w.Write([]byte(`{}`))
				case "/queue":
					queueRead = true
					w.WriteHeader(test.queueCode)
					w.Write([]byte(test.queue))
				default:
					t.Errorf("unexpected request %s", r.URL.Path)
					w.WriteHeader(404)
				}
			}))
			defer upstream.Close()
			recorder := httptest.NewRecorder()
			comfyUITask(recorder, httptest.NewRequest("GET", "/task", nil), "job", upstream.URL, "/view", url.Values{})
			var result map[string]any
			if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if !queueRead || result["status"] != test.status {
				t.Fatalf("queue read=%v, response=%s", queueRead, recorder.Body.String())
			}
		})
	}
}
