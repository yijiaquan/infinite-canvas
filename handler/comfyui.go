package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/tigerowo/infinite-canvas/service"
)

const comfyUIRequestBodyLimit = 16 << 20

func ComfyUIWorkflows(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	var input struct {
		BaseURL string `json:"baseUrl"`
	}
	if json.NewDecoder(r.Body).Decode(&input) != nil {
		Fail(w, "ComfyUI 渠道参数格式错误")
		return
	}
	items, err := service.ComfyUIWorkflows(input.BaseURL)
	if err != nil {
		Fail(w, err.Error())
		return
	}
	OK(w, items)
}

func ComfyUIUpload(w http.ResponseWriter, r *http.Request) {
	comfyUIUpload(w, r, r.URL.Query().Get("baseUrl"))
}

func ConfiguredComfyUIUpload(w http.ResponseWriter, r *http.Request) {
	baseURL, ok := configuredComfyUIBaseURL(w, r)
	if !ok {
		return
	}
	comfyUIUpload(w, r, baseURL)
}

func comfyUIUpload(w http.ResponseWriter, r *http.Request, baseURL string) {
	r.Body = http.MaxBytesReader(w, r.Body, 256<<20)
	if err := r.ParseMultipartForm(256 << 20); err != nil {
		writeComfyUIError(w, http.StatusBadRequest, "ComfyUI 素材格式错误")
		return
	}
	file, header, err := r.FormFile("image")
	if err != nil {
		writeComfyUIError(w, http.StatusBadRequest, "缺少 ComfyUI 素材文件")
		return
	}
	defer file.Close()
	if header.Size > 256<<20 {
		writeComfyUIError(w, http.StatusRequestEntityTooLarge, "ComfyUI 素材不能超过 256MB")
		return
	}
	payload, err := service.ComfyUIUpload(r.Context(), baseURL, header.Filename, file)
	if err != nil {
		writeComfyUIError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, payload)
}

func ComfyUIPrompt(w http.ResponseWriter, r *http.Request) {
	comfyUIPrompt(w, r, r.URL.Query().Get("baseUrl"))
}

func ConfiguredComfyUIPrompt(w http.ResponseWriter, r *http.Request) {
	baseURL, ok := configuredComfyUIBaseURL(w, r)
	if !ok {
		return
	}
	comfyUIPrompt(w, r, baseURL)
}

func comfyUIPrompt(w http.ResponseWriter, r *http.Request, baseURL string) {
	r.Body = http.MaxBytesReader(w, r.Body, comfyUIRequestBodyLimit)
	response, err := service.ComfyUIProxyRequest(r.Context(), baseURL, http.MethodPost, "/prompt", r.Body, "application/json")
	if err != nil {
		writeComfyUIError(w, http.StatusBadGateway, "ComfyUI 任务提交失败："+err.Error())
		return
	}
	defer response.Body.Close()
	var payload map[string]any
	if json.NewDecoder(io.LimitReader(response.Body, 4<<20)).Decode(&payload) != nil {
		writeComfyUIError(w, http.StatusBadGateway, "ComfyUI 任务响应格式错误")
		return
	}
	if response.StatusCode >= http.StatusBadRequest {
		writeComfyUIError(w, http.StatusBadGateway, comfyUIErrorMessage(payload, "ComfyUI 拒绝了工作流"))
		return
	}
	promptID := strings.TrimSpace(fmt.Sprint(payload["prompt_id"]))
	if promptID == "" || promptID == "<nil>" {
		writeComfyUIError(w, http.StatusBadGateway, "ComfyUI 没有返回任务 ID")
		return
	}
	payload["task_id"] = promptID
	payload["status"] = "queued"
	writeJSON(w, payload)
}

func ComfyUITask(w http.ResponseWriter, r *http.Request, promptID string) {
	query := url.Values{"baseUrl": {r.URL.Query().Get("baseUrl")}}
	comfyUITask(w, r, promptID, r.URL.Query().Get("baseUrl"), "/api/ai/comfyui/view", query)
}

func ConfiguredComfyUITask(w http.ResponseWriter, r *http.Request, promptID string) {
	baseURL, ok := configuredComfyUIBaseURL(w, r)
	if !ok {
		return
	}
	query := url.Values{"baseUrl": {baseURL}}
	comfyUITask(w, r, promptID, baseURL, "/api/ai/comfyui/view", query)
}

func comfyUITask(w http.ResponseWriter, r *http.Request, promptID, baseURL, viewPath string, viewQuery url.Values) {
	promptID = strings.TrimSpace(promptID)
	if promptID == "" {
		writeComfyUIError(w, http.StatusBadRequest, "缺少 ComfyUI 任务 ID")
		return
	}
	response, err := service.ComfyUIProxyRequest(r.Context(), baseURL, http.MethodGet, "/history/"+url.PathEscape(promptID), nil, "")
	if err != nil {
		writeComfyUIError(w, http.StatusBadGateway, "读取 ComfyUI 任务失败："+err.Error())
		return
	}
	defer response.Body.Close()
	var history map[string]any
	if json.NewDecoder(io.LimitReader(response.Body, 16<<20)).Decode(&history) != nil {
		writeComfyUIError(w, http.StatusBadGateway, "ComfyUI 历史响应格式错误")
		return
	}
	entry, found := history[promptID].(map[string]any)
	if !found {
		status := "unknown"
		queueResponse, queueErr := service.ComfyUIProxyRequest(r.Context(), baseURL, http.MethodGet, "/queue", nil, "")
		if queueErr == nil {
			defer queueResponse.Body.Close()
			var queue map[string]any
			if queueResponse.StatusCode == http.StatusOK && json.NewDecoder(io.LimitReader(queueResponse.Body, 16<<20)).Decode(&queue) == nil {
				status = comfyUIQueueStatus(queue, promptID)
			}
		}
		result := map[string]any{"task_id": promptID, "status": status, "progress": 0}
		if status == "unknown" {
			result["message"] = "ComfyUI 历史和队列未能确认任务状态，请核查输出，不要重复提交"
		}
		writeJSON(w, result)
		return
	}
	status := "completed"
	if detail, ok := entry["status"].(map[string]any); ok {
		value := strings.ToLower(strings.TrimSpace(fmt.Sprint(detail["status_str"])))
		if value == "error" || value == "failed" {
			status = "failed"
		}
	}
	files := []map[string]string{}
	collectComfyUIFiles(entry["outputs"], viewPath, viewQuery, &files)
	result := map[string]any{"task_id": promptID, "status": status, "progress": 100, "outputs": files}
	for _, file := range files {
		switch file["kind"] {
		case "image":
			result["image_urls"] = appendString(result["image_urls"], file["url"])
		case "video":
			if result["video_url"] == nil {
				result["video_url"] = file["url"]
			}
		case "audio":
			if result["audio_url"] == nil {
				result["audio_url"] = file["url"]
			}
		}
	}
	if status == "failed" {
		result["error"] = map[string]string{"message": comfyUIErrorMessage(entry, "ComfyUI 工作流执行失败")}
	}
	writeJSON(w, result)
}

func comfyUIQueueStatus(queue map[string]any, promptID string) string {
	for _, key := range []string{"queue_running", "queue_pending"} {
		entries, _ := queue[key].([]any)
		for _, entry := range entries {
			fields, ok := entry.([]any)
			if !ok || len(fields) < 2 || fields[1] != promptID {
				continue
			}
			if key == "queue_running" {
				return "processing"
			}
			return "queued"
		}
	}
	return "unknown"
}

func ComfyUIView(w http.ResponseWriter, r *http.Request) {
	comfyUIView(w, r, r.URL.Query().Get("baseUrl"))
}

func ConfiguredComfyUIView(w http.ResponseWriter, r *http.Request) {
	baseURL, ok := configuredComfyUIBaseURL(w, r)
	if !ok {
		return
	}
	comfyUIView(w, r, baseURL)
}

func comfyUIView(w http.ResponseWriter, r *http.Request, baseURL string) {
	query := url.Values{}
	for _, key := range []string{"filename", "subfolder", "type"} {
		if value := r.URL.Query().Get(key); value != "" {
			query.Set(key, value)
		}
	}
	response, err := service.ComfyUIProxyRequest(r.Context(), baseURL, http.MethodGet, "/view?"+query.Encode(), nil, "")
	if err != nil {
		writeComfyUIError(w, http.StatusBadGateway, "读取 ComfyUI 输出失败："+err.Error())
		return
	}
	defer response.Body.Close()
	if response.StatusCode >= http.StatusBadRequest {
		writeComfyUIError(w, http.StatusBadGateway, fmt.Sprintf("读取 ComfyUI 输出失败：HTTP %d", response.StatusCode))
		return
	}
	if contentType := response.Header.Get("Content-Type"); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = io.Copy(w, response.Body)
}

func collectComfyUIFiles(value any, viewPath string, baseQuery url.Values, result *[]map[string]string) {
	switch typed := value.(type) {
	case map[string]any:
		filename := strings.TrimSpace(fmt.Sprint(typed["filename"]))
		if filename != "" && filename != "<nil>" {
			subfolder := strings.TrimSpace(fmt.Sprint(typed["subfolder"]))
			if subfolder == "<nil>" {
				subfolder = ""
			}
			fileType := strings.TrimSpace(fmt.Sprint(typed["type"]))
			if fileType == "" || fileType == "<nil>" {
				fileType = "output"
			}
			query := url.Values{}
			for key, values := range baseQuery {
				for _, value := range values {
					query.Add(key, value)
				}
			}
			query.Set("filename", filename)
			query.Set("type", fileType)
			if subfolder != "" {
				query.Set("subfolder", subfolder)
			}
			*result = append(*result, map[string]string{"filename": filename, "kind": comfyUIFileKind(filename), "url": viewPath + "?" + query.Encode()})
			return
		}
		for _, item := range typed {
			collectComfyUIFiles(item, viewPath, baseQuery, result)
		}
	case []any:
		for _, item := range typed {
			collectComfyUIFiles(item, viewPath, baseQuery, result)
		}
	}
}

func configuredComfyUIBaseURL(w http.ResponseWriter, r *http.Request) (string, bool) {
	user, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "未登录或权限不足")
		return "", false
	}
	modelName := strings.TrimSpace(r.URL.Query().Get("model"))
	channelID := strings.TrimSpace(r.URL.Query().Get("channelId"))
	channel, _, err := selectAIRequestChannel(user, modelName, channelID, "")
	if err != nil {
		failAIChannelSelect(w, err, "ComfyUI 渠道不可用")
		return "", false
	}
	if !service.IsComfyUIChannel(channel.Protocol) {
		Fail(w, "指定渠道不是 ComfyUI")
		return "", false
	}
	return channel.BaseURL, true
}

func configuredComfyUIQuery(r *http.Request) url.Values {
	return url.Values{
		"channelId": {strings.TrimSpace(r.URL.Query().Get("channelId"))},
		"model":     {strings.TrimSpace(r.URL.Query().Get("model"))},
	}
}

func comfyUIFileKind(filename string) string {
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif":
		return "image"
	case ".mp4", ".webm", ".mkv", ".mov":
		return "video"
	case ".mp3", ".wav", ".flac", ".ogg", ".opus":
		return "audio"
	default:
		return "file"
	}
}

func appendString(value any, item string) []string {
	if existing, ok := value.([]string); ok {
		return append(existing, item)
	}
	return []string{item}
}

func comfyUIErrorMessage(payload any, fallback string) string {
	if object, ok := payload.(map[string]any); ok {
		for _, key := range []string{"error", "message", "exception_message"} {
			switch value := object[key].(type) {
			case string:
				if strings.TrimSpace(value) != "" {
					return value
				}
			case map[string]any:
				if message := comfyUIErrorMessage(value, ""); message != "" {
					return message
				}
			}
		}
	}
	return fallback
}

func writeComfyUIError(w http.ResponseWriter, status int, message string) {
	writeJSONWithStatus(w, status, map[string]any{"error": map[string]string{"message": message}, "message": message})
}
