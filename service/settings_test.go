package service

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/tigerowo/infinite-canvas/model"
)

func TestFetchAdminChannelModelsParsesOpenAIModels(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"z-model"},{"id":"a-model"},{"id":""}]}`))
	}))
	defer server.Close()

	models, err := fetchAdminChannelModels(model.ModelChannel{
		BaseURL: server.URL,
		APIKey:  "test-key",
	})
	if err != nil {
		t.Fatalf("fetchAdminChannelModels returned error: %v", err)
	}
	if want := []string{"a-model", "z-model"}; !reflect.DeepEqual(models, want) {
		t.Fatalf("models = %#v, want %#v", models, want)
	}
}

func TestFetchAdminChannelModelsReportsArkPlanModelsUnsupported(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/plan/v3/models" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	_, err := fetchAdminChannelModels(model.ModelChannel{
		Protocol: "ark",
		BaseURL:  server.URL + "/api/plan/v3/contents/generations/tasks",
		APIKey:   "test-key",
	})
	if err == nil {
		t.Fatal("expected unsupported /models error")
	}
	if !strings.Contains(err.Error(), "Agent Plan 未提供 OpenAI /models") {
		t.Fatalf("error = %q", err.Error())
	}
}

func TestBuildModelChannelURLNormalizesArkPlanTaskPath(t *testing.T) {
	got := BuildModelChannelURL(model.ModelChannel{BaseURL: "https://ark.cn-beijing.volces.com/api/plan/v3/contents/generations/tasks?debug=1"}, "/models")
	want := "https://ark.cn-beijing.volces.com/api/plan/v3/models"
	if got != want {
		t.Fatalf("BuildModelChannelURL = %q, want %q", got, want)
	}
}

func TestBuildModelChannelURLZhipuV4(t *testing.T) {
	tests := []struct {
		baseURL string
		path    string
		want    string
	}{
		{"https://open.bigmodel.cn/api/paas/v4", "/chat/completions", "https://open.bigmodel.cn/api/paas/v4/chat/completions"},
		{"https://open.bigmodel.cn/api/paas/v4/", "/models", "https://open.bigmodel.cn/api/paas/v4/models"},
		{"https://open.bigmodel.cn/api/paas/v4", "/images/generations", "https://open.bigmodel.cn/api/paas/v4/images/generations"},
		{"https://ark.cn-beijing.volces.com/api/plan/v3", "/chat/completions", "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions"},
		{"https://api.openai.com", "/chat/completions", "https://api.openai.com/v1/chat/completions"},
	}
	for _, tt := range tests {
		got := BuildModelChannelURL(model.ModelChannel{BaseURL: tt.baseURL}, tt.path)
		if got != tt.want {
			t.Fatalf("BuildModelChannelURL(%q, %q) = %q, want %q", tt.baseURL, tt.path, got, tt.want)
		}
	}
}

func TestAdminComfyUIChannelDoesNotRequireAPIKey(t *testing.T) {
	channel, err := resolveAdminChannel(nil, model.ModelChannel{
		Protocol: ModelChannelProtocolComfyUI,
		BaseURL:  "http://127.0.0.1:8188",
	})
	if err != nil {
		t.Fatalf("resolveAdminChannel returned error: %v", err)
	}
	if channel.BaseURL != "http://127.0.0.1:8188" || channel.APIKey != "" {
		t.Fatalf("unexpected channel: %#v", channel)
	}
}

func TestModelChannelsForModelAllowsComfyUIWithoutAPIKey(t *testing.T) {
	channels := modelChannelsForModel([]model.ModelChannel{{
		ID: "comfy", Protocol: ModelChannelProtocolComfyUI, BaseURL: "http://127.0.0.1:8188",
		Models: []string{"comfyui:minimax-h3-t2v"}, Weight: 1, Enabled: true,
	}}, "comfyui:minimax-h3-t2v")
	if len(channels) != 1 || channels[0].ID != "comfy" {
		t.Fatalf("unexpected channels: %#v", channels)
	}
}

func TestComfyUIModelsAreNotClassifiedAsText(t *testing.T) {
	if !isVideoModelName("comfyui:minimax-h3-t2v") || !isVideoModelName("comfyui:seedvr2-upscale") {
		t.Fatal("ComfyUI video workflow was not classified as video")
	}
	if isTextModelName("comfyui:minimax-music3") {
		t.Fatal("ComfyUI audio workflow was classified as text")
	}
}
