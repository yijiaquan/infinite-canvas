package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"github.com/tigerowo/infinite-canvas/service"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

var dramaWorkerOnce sync.Once
var dramaRunActive sync.Map

func StartDramaRunWorker() {
	dramaWorkerOnce.Do(func() {
		go func() {
			if err := repository.RecoverDramaRuns(); err != nil {
				log.Printf("drama queue recovery failed: %v", err)
				return
			}
			ticker := time.NewTicker(2 * time.Second)
			defer ticker.Stop()
			for range ticker.C {
				dramaRunTick()
			}
		}()
	})
}
func dramaRunTick() {
	runs, err := repository.PendingDramaRuns()
	if err != nil {
		log.Printf("drama queue read failed: %v", err)
		return
	}
	for _, run := range runs {
		if _, loaded := dramaRunActive.LoadOrStore(run.ID, true); loaded {
			continue
		}
		if run.Status == "submitting" {
			dramaRunState(run, "unknown", "提交后状态保存未完成，请核查；不会自动重新提交", nil)
			dramaRunActive.Delete(run.ID)
			continue
		}
		if run.Status == "preparing" {
			dramaRunState(run, "queued", "", nil)
			dramaRunActive.Delete(run.ID)
			continue
		}
		if run.Status == "queued" {
			claimed, err := repository.ClaimDramaRun(run.ID)
			if err != nil || !claimed {
				dramaRunActive.Delete(run.ID)
				continue
			}
			run.Status = "preparing"
		}
		go func(run model.DramaRun) { defer dramaRunActive.Delete(run.ID); executeDramaRun(run) }(run)
	}
}
func dramaRunState(run model.DramaRun, status, message string, extra map[string]any) {
	if extra == nil {
		extra = map[string]any{}
	}
	extra["status"] = status
	extra["error"] = message
	if _, err := repository.ChangeDramaRun(run.ID, []string{run.Status}, extra); err != nil {
		log.Printf("drama run state write failed id=%s: %v", run.ID, err)
	}
}
func executeDramaRun(run model.DramaRun) {
	u, found, err := repository.GetUserByID(run.UserID)
	if err != nil || !found || u.Status != model.UserStatusActive {
		dramaRunState(run, "failed", "任务账号不可用", nil)
		return
	}
	ctx, cancel := context.WithTimeout(service.WithUser(context.Background(), model.PublicUser(u)), 30*time.Minute)
	defer cancel()
	channel, _, err := selectAIRequestChannel(model.PublicUser(u), run.Snapshot.Model, run.Snapshot.ChannelID, "")
	if run.Status == "saving" && run.Provider == "image" {
		saveDramaRunResponse(ctx, run, channel)
		return
	}
	if err != nil || dramaChannelFingerprint(channel) != run.ChannelFingerprint {
		status := "failed"
		if run.Status != "preparing" {
			status = "unknown"
		}
		dramaRunState(run, status, "渠道已变更或不可用，需恢复原渠道后重新核查", nil)
		return
	}
	if run.Status == "saving" {
		saveDramaRunResponse(ctx, run, channel)
		return
	}
	if run.Status == "running" {
		pollDramaRun(ctx, run, channel)
		return
	}
	if err := repository.StartDramaRunSubmission(run); err != nil {
		dramaRunState(run, "failed", err.Error(), nil)
		return
	}
	run.Status = "submitting"
	var response *http.Response
	if run.Provider == "comfyui" {
		response, err = service.ComfyUIProxyRequest(ctx, channel.BaseURL, http.MethodPost, run.Endpoint, bytes.NewReader(run.Body), run.ContentType)
	} else {
		var request *http.Request
		request, err = http.NewRequestWithContext(ctx, http.MethodPost, service.BuildModelChannelURL(channel, run.Endpoint), bytes.NewReader(run.Body))
		if err == nil {
			request.Header.Set("Content-Type", run.ContentType)
			service.SetModelChannelAuthHeader(request, channel)
			response, err = service.HTTPClientForChannel(channel).Do(request)
		}
	}
	if err != nil {
		dramaRunState(run, "unknown", "提交响应未确认，请核查；不会自动重复提交", nil)
		return
	}
	defer response.Body.Close()
	payload, readErr := io.ReadAll(io.LimitReader(response.Body, 128<<20+1))
	if readErr != nil || len(payload) > 128<<20 {
		dramaRunState(run, "unknown", "提交响应不完整，请核查，不要重复提交", nil)
		return
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		dramaRunState(run, "failed", "上游明确拒绝请求："+http.StatusText(response.StatusCode), map[string]any{"response": payload})
		return
	}
	if run.Provider == "comfyui" {
		var result map[string]any
		if json.Unmarshal(payload, &result) != nil {
			dramaRunState(run, "unknown", "ComfyUI 响应无法解析，不要重复提交", map[string]any{"response": payload})
			return
		}
		id, _ := result["prompt_id"].(string)
		if id == "" {
			dramaRunState(run, "unknown", "ComfyUI 没有返回任务 ID，请核查", map[string]any{"response": payload})
			return
		}
		dramaRunState(run, "running", "", map[string]any{"upstream_id": id})
		return
	}
	dramaRunState(run, "saving", "", map[string]any{"response": payload, "response_type": response.Header.Get("Content-Type")})
}
func pollDramaRun(ctx context.Context, run model.DramaRun, channel model.ModelChannel) {
	if run.UpstreamID == "" {
		dramaRunState(run, "unknown", "缺少上游任务 ID，无法安全重试", nil)
		return
	}
	response, err := service.ComfyUIProxyRequest(ctx, channel.BaseURL, http.MethodGet, "/history/"+url.PathEscape(run.UpstreamID), nil, "")
	if err != nil {
		dramaRunState(run, "unknown", "无法连接 ComfyUI 核查任务，请恢复连接后重新查询", nil)
		return
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		dramaRunState(run, "unknown", "ComfyUI 历史查询失败，请重新核查", nil)
		return
	}
	var history map[string]any
	if json.NewDecoder(io.LimitReader(response.Body, 16<<20)).Decode(&history) != nil {
		dramaRunState(run, "unknown", "ComfyUI 历史响应无法解析，请重新核查", nil)
		return
	}
	entry, ok := history[run.UpstreamID].(map[string]any)
	if !ok {
		queueResponse, err := service.ComfyUIProxyRequest(ctx, channel.BaseURL, http.MethodGet, "/queue", nil, "")
		if err != nil {
			dramaRunState(run, "unknown", "无法读取 ComfyUI 队列，请重新核查", nil)
			return
		}
		defer queueResponse.Body.Close()
		var queue map[string]any
		if queueResponse.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(queueResponse.Body, 16<<20)).Decode(&queue) != nil {
			dramaRunState(run, "unknown", "ComfyUI 队列响应无法确认任务，请重新核查", nil)
			return
		}
		if comfyUIQueueStatus(queue, run.UpstreamID) == "unknown" {
			dramaRunState(run, "unknown", "历史与队列均无此任务，请核查专属输出；不会自动重新提交", nil)
		}
		return
	}
	if status, ok := entry["status"].(map[string]any); ok {
		if value, _ := status["status_str"].(string); value == "error" || value == "failed" {
			dramaRunState(run, "failed", "ComfyUI 工作流执行失败", nil)
			return
		}
	}
	payload, err := json.Marshal(entry)
	if err != nil {
		return
	}
	dramaRunState(run, "saving", "", map[string]any{"response": payload, "response_type": "application/json"})
}
func saveDramaRunResponse(ctx context.Context, run model.DramaRun, channel model.ModelChannel) {
	outputs := append([]model.DramaRunOutput{}, run.Outputs...)
	var candidates []string
	if run.Provider == "comfyui" {
		var entry map[string]any
		if json.Unmarshal(run.Response, &entry) != nil {
			dramaRunState(run, "save_failed", "历史响应无法解析", nil)
			return
		}
		files := []map[string]string{}
		collectComfyUIFiles(entry["outputs"], "/view", url.Values{}, &files)
		for _, file := range files {
			if file["kind"] == run.Kind {
				candidates = append(candidates, file["url"])
			}
		}
	} else {
		var err error
		candidates, err = imageCandidatesFromAIResponse(run.Response, run.ResponseType, false)
		if err != nil {
			dramaRunState(run, "save_failed", "未能解析图片结果，保留响应供重试保存", nil)
			return
		}
	}
	if len(candidates) == 0 {
		dramaRunState(run, "save_failed", "任务没有返回匹配的媒体输出", nil)
		return
	}
	for i, candidate := range candidates {
		if i < len(outputs) {
			continue
		}
		var input io.ReadCloser
		var mime string
		var err error
		if run.Provider == "comfyui" {
			var response *http.Response
			response, err = service.ComfyUIProxyRequest(ctx, channel.BaseURL, http.MethodGet, candidate, nil, "")
			if err == nil {
				if response.StatusCode < 200 || response.StatusCode >= 300 {
					response.Body.Close()
					err = errors.New("ComfyUI 输出暂不可读取")
				} else {
					input = response.Body
					mime = response.Header.Get("Content-Type")
				}
			}
		} else if strings.HasPrefix(candidate, "http://") || strings.HasPrefix(candidate, "https://") {
			var request *http.Request
			request, err = http.NewRequestWithContext(ctx, http.MethodGet, candidate, nil)
			if err == nil {
				var response *http.Response
				response, err = http.DefaultClient.Do(request)
				if err == nil {
					if response.StatusCode < 200 || response.StatusCode >= 300 {
						response.Body.Close()
						err = errors.New("输出下载失败")
					} else {
						input = response.Body
						mime = response.Header.Get("Content-Type")
					}
				}
			}
		} else {
			var data []byte
			data, mime, err = imageCandidateBytes(candidate)
			if err == nil {
				input = io.NopCloser(bytes.NewReader(data))
			}
		}
		if err != nil {
			dramaRunState(run, "save_failed", "媒体保存失败，可重试保存，不要重新生成", nil)
			return
		}
		saved, err := service.UploadDramaMedia(ctx, input, mime)
		input.Close()
		if err != nil {
			dramaRunState(run, "save_failed", "媒体保存失败，可重试保存，不要重新生成", nil)
			return
		}
		outputs = append(outputs, model.DramaRunOutput{StorageID: saved.ID, URL: saved.URL, MimeType: saved.MimeType})
		if _, err = repository.ChangeDramaRun(run.ID, []string{"saving"}, map[string]any{"outputs": service.EncodeDramaRunOutputs(outputs)}); err != nil {
			return
		}
	}
	dramaRunState(run, "completed", "", map[string]any{"outputs": service.EncodeDramaRunOutputs(outputs)})
}
