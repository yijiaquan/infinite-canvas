package handler

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
	"github.com/tigerowo/infinite-canvas/service"
	"gorm.io/gorm"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"path/filepath"
	"strings"
	"time"
)

type DramaRunInput struct {
	RequestID  string                    `json:"requestId"`
	NodeID     string                    `json:"nodeId"`
	Kind       string                    `json:"kind"`
	Model      string                    `json:"model"`
	ChannelID  string                    `json:"channelId"`
	Prompt     string                    `json:"prompt"`
	Parameters map[string]any            `json:"parameters"`
	References []model.DramaRunReference `json:"references"`
}

func DramaRuns(w http.ResponseWriter, r *http.Request, p, e, c string) {
	v, err := service.CurrentDramaRuns(r.Context(), p, e, c)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, v)
}
func DramaEpisodeRuns(w http.ResponseWriter, r *http.Request, p, e string) {
	v, err := service.CurrentDramaEpisodeRuns(r.Context(), p, e)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, v)
}
func CancelDramaRun(w http.ResponseWriter, r *http.Request, p, e, c, id string) {
	v, err := service.CancelCurrentDramaRun(r.Context(), p, e, c, id)
	if err != nil {
		Fail(w, err.Error())
		return
	}
	OK(w, v)
}
func RecheckDramaRun(w http.ResponseWriter, r *http.Request, p, e, c, id string) {
	v, err := service.RecheckCurrentDramaRun(r.Context(), p, e, c, id)
	if err != nil {
		Fail(w, err.Error())
		return
	}
	OK(w, v)
}
func CreateDramaRun(w http.ResponseWriter, r *http.Request, p, e, c string) {
	createOrPreviewDramaRun(w, r, p, e, c, false)
}
func PreviewDramaRun(w http.ResponseWriter, r *http.Request, p, e, c string) {
	createOrPreviewDramaRun(w, r, p, e, c, true)
}
func createOrPreviewDramaRun(w http.ResponseWriter, r *http.Request, p, e, c string, preview bool) {
	u, ok := service.UserFromContext(r.Context())
	if !ok {
		Fail(w, "请先登录")
		return
	}
	var input DramaRunInput
	decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&input) != nil {
		Fail(w, "生成参数无效")
		return
	}
	if err := repository.DramaRunScope(u.ID, p, e, c); err != nil {
		Fail(w, "Clip 不存在")
		return
	}
	if strings.TrimSpace(input.RequestID) == "" || len(input.RequestID) > 128 || input.NodeID == "" || strings.TrimSpace(input.Prompt) == "" || len(input.Prompt) > 400000 {
		Fail(w, "需要请求 ID、节点 ID 和完整提示词")
		return
	}
	if !preview {
		if previous, err := repository.FindDramaRunRequest(u.ID, input.RequestID); err == nil {
			if previous.ProjectID != p || previous.EpisodeID != e || previous.ClipID != c || previous.NodeID != input.NodeID || previous.Kind != input.Kind {
				Fail(w, "请求 ID 已用于其他任务")
				return
			}
			OK(w, previous)
			return
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			Fail(w, "无法查询请求状态，请稍后重试")
			return
		}
	}
	if input.Kind != "image" && input.Kind != "video" {
		Fail(w, "当前队列支持图片与视频")
		return
	}
	if err := repository.ValidateDramaRunNode(u.ID, p, e, c, input.NodeID, input.Kind); err != nil {
		Fail(w, "节点不属于当前正式集的 Clip，请先保存画布")
		return
	}
	channel, _, err := selectAIRequestChannel(u, input.Model, input.ChannelID, "")
	if err != nil {
		Fail(w, "模型渠道不可用")
		return
	}
	if err = service.ValidateDramaRunReferences(r.Context(), p, e, c, input.References); err != nil {
		Fail(w, err.Error())
		return
	}
	for _, reference := range input.References {
		if len(reference.Title) > 500 {
			Fail(w, "素材标题过长")
			return
		}
	}
	if input.Parameters == nil {
		input.Parameters = map[string]any{}
	}
	allowed := map[string]bool{"seed": true, "steps": true, "seconds": true, "duration": true, "size": true, "resolution_name": true, "quality": true, "apiMode": true, "output_format": true, "response_format": true}
	for key, value := range input.Parameters {
		if !allowed[key] {
			Fail(w, "不支持的参数："+key)
			return
		}
		switch value.(type) {
		case string, float64:
		default:
			Fail(w, "生成参数必须是文本或数值")
			return
		}
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	run := model.DramaRun{ID: "drama-run-" + uuid.NewString(), UserID: u.ID, RequestID: input.RequestID, ProjectID: p, EpisodeID: e, ClipID: c, NodeID: input.NodeID, Kind: input.Kind, Status: "queued", CreatedAt: now, UpdatedAt: now, Outputs: []model.DramaRunOutput{}, Snapshot: model.DramaRunSnapshot{Prompt: input.Prompt, Model: input.Model, ChannelID: channel.ID, Parameters: input.Parameters, References: input.References}}
	if run.Snapshot.References == nil {
		run.Snapshot.References = []model.DramaRunReference{}
	}
	run.ChannelFingerprint = dramaChannelFingerprint(channel)
	run.ConcurrencyLimit = 2
	run.ConcurrencyKey = "image:" + channel.ID
	if service.IsComfyUIChannel(channel.Protocol) {
		run.Provider = "comfyui"
		run.ConcurrencyLimit = 1
		run.ConcurrencyKey = "comfyui:" + dramaHash(strings.TrimRight(channel.BaseURL, "/"))
		if input.Kind != "video" {
			Fail(w, "漫剧图片请使用后台图片 API 渠道")
			return
		}
	} else {
		run.Provider = "image"
		if input.Kind != "image" {
			Fail(w, "当前持久视频队列支持 ComfyUI 渠道")
			return
		}
	}
	run.Credits, err = service.ModelCost(input.Model)
	if err != nil {
		Fail(w, "无法读取模型费用")
		return
	}
	if err = prepareDramaRun(r.Context(), &run, channel); err != nil {
		Fail(w, err.Error())
		return
	}
	if preview {
		OK(w, map[string]any{"snapshot": run.Snapshot, "credits": run.Credits, "kind": run.Kind})
		return
	}
	saved, err := repository.CreateDramaRun(run)
	if err != nil {
		Fail(w, "无法保存生成任务")
		return
	}
	OK(w, saved)
}
func dramaHash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}
func dramaChannelFingerprint(c model.ModelChannel) string {
	return dramaHash(c.Protocol + "\n" + strings.TrimRight(c.BaseURL, "/"))
}

func dramaReferenceBytes(ctx context.Context, id string) ([]byte, string, error) {
	u, ok := service.UserFromContext(ctx)
	obj, err := repository.GetStorageObject(id)
	if !ok || err != nil || obj.CreatedBy != u.ID {
		return nil, "", errors.New("素材不存在或无权读取")
	}
	download, err := service.DownloadStorageObject(id, "")
	if err != nil {
		return nil, "", err
	}
	defer download.Stream.Close()
	data, err := io.ReadAll(io.LimitReader(download.Stream, 64<<20+1))
	if len(data) > 64<<20 {
		return nil, "", errors.New("单项参考不能超过64MB")
	}
	return data, obj.MimeType, err
}
func prepareDramaRun(ctx context.Context, run *model.DramaRun, channel model.ModelChannel) error {
	input := map[string]any{"model": run.Snapshot.Model, "prompt": run.Snapshot.Prompt}
	for k, v := range run.Snapshot.Parameters {
		if k != "apiMode" {
			input[k] = v
		}
	}
	refs := []string{}
	files := [][]byte{}
	types := []string{}
	mediaRefs := []service.DramaComfyUIReference{}
	kinds := []string{}
	videoAudio := map[int]bool{}
	for _, ref := range run.Snapshot.References {
		data, mimeType, err := dramaReferenceBytes(ctx, ref.StorageID)
		if err != nil {
			return err
		}
		if !strings.HasPrefix(mimeType, "image/") && (run.Provider != "comfyui" || run.Snapshot.Model != "comfyui:minimax-h3-ref2v") {
			return errors.New("当前模式只接受图片参考，不能忽略已绑定的音视频")
		}
		files = append(files, data)
		types = append(types, mimeType)
		kind := strings.Split(mimeType, "/")[0]
		kinds = append(kinds, kind)
		if run.Provider == "comfyui" && run.Snapshot.Model == "comfyui:minimax-h3-ref2v" && kind == "video" {
			hasAudio, err := service.DramaVideoHasAudio(ctx, data)
			if err != nil {
				return err
			}
			videoAudio[len(kinds)-1] = hasAudio
		}
		if run.Provider == "comfyui" {
			ext := ".bin"
			if extensions, _ := mime.ExtensionsByType(mimeType); len(extensions) > 0 {
				ext = extensions[0]
			}
			upload, err := service.ComfyUIUpload(ctx, channel.BaseURL, run.ID+"-"+ref.StorageID+ext, bytes.NewReader(data))
			if err != nil {
				return err
			}
			name, _ := upload["name"].(string)
			folder, _ := upload["subfolder"].(string)
			if name == "" {
				return errors.New("ComfyUI 未返回上传文件名")
			}
			if folder != "" {
				name = folder + "/" + name
			}
			refs = append(refs, name)
			mediaRefs = append(mediaRefs, service.DramaComfyUIReference{Kind: strings.Split(mimeType, "/")[0], Filename: name})
		} else {
			refs = append(refs, "data:"+mimeType+";base64,"+base64.StdEncoding.EncodeToString(data))
		}
	}
	if run.Provider == "comfyui" {
		switch run.Snapshot.Model {
		case "comfyui:minimax-h3-ref2v":
			if len(run.Snapshot.References) == 0 || run.Snapshot.References[0].Role != "storyboard" {
				return errors.New("第一项必须绑定当前完整故事板")
			}
			mapping, err := service.DramaH3InputMapping(run.Snapshot.References, kinds, videoAudio)
			if err != nil {
				return err
			}
			run.Snapshot.InputMapping = mapping
			run.Snapshot.Prompt = service.CompileDramaPromptWithMapping(run.Snapshot.Prompt, mapping)
			run.Snapshot.OutputPrefix = "infinite-canvas/drama/" + run.ID + "/video"
			payload, err := service.PrepareDramaComfyUIWorkflow(ctx, channel.BaseURL, run.ID, run.Snapshot.Prompt, run.Snapshot.Parameters, mediaRefs)
			if err != nil {
				return err
			}
			run.Body, err = json.Marshal(payload)
			run.Endpoint = "/prompt"
			run.ContentType = "application/json"
			return err
		case "comfyui:minimax-h3-fl2v":
			if len(refs) < 1 || len(refs) > 2 {
				return errors.New("首尾帧模式需要1至2张图片")
			}
			input["first_frame_url"] = refs[0]
			if len(refs) == 2 {
				input["last_frame_url"] = refs[1]
			}
		case "comfyui:minimax-h3-t2v":
			if len(refs) > 0 {
				return errors.New("文生视频不能忽略已绑定参考，请选择参考生视频模式")
			}
		default:
			return errors.New("当前漫剧队列仅支持已适配的 H3 视频工作流")
		}
		payload, _, err := service.PrepareComfyUIWorkflow(channel.BaseURL, run.Snapshot.Model, "/videos", input)
		if err != nil {
			return err
		}
		payload["client_id"] = run.ID
		if err = service.FinalizeDramaComfyUIIdentity(payload, run.ID); err != nil {
			return err
		}
		run.Body, err = json.Marshal(payload)
		run.Endpoint = "/prompt"
		run.ContentType = "application/json"
		return err
	}
	mode, _ := run.Snapshot.Parameters["apiMode"].(string)
	endpoint := "/images/generations"
	contentType := "application/json"
	var body []byte
	var err error
	if mode == "responses" {
		content := []map[string]any{{"type": "input_text", "text": run.Snapshot.Prompt}}
		for _, ref := range refs {
			content = append(content, map[string]any{"type": "input_image", "image_url": ref})
		}
		tool := map[string]any{"type": "image_generation"}
		for _, k := range []string{"size", "quality", "output_format"} {
			if v, ok := input[k]; ok {
				tool[k] = v
			}
		}
		input = map[string]any{"model": run.Snapshot.Model, "input": []map[string]any{{"role": "user", "content": content}}, "tools": []map[string]any{tool}, "tool_choice": "required"}
		endpoint = "/responses"
		body, err = json.Marshal(input)
	} else if mode != "" && mode != "images" {
		return errors.New("持久图片队列支持 Images 或 Responses API")
	} else if len(files) > 0 {
		endpoint = "/images/edits"
		buffer := &bytes.Buffer{}
		writer := multipart.NewWriter(buffer)
		for k, v := range input {
			if err = writer.WriteField(k, fmt.Sprint(v)); err != nil {
				return err
			}
		}
		for i, data := range files {
			ext := ".png"
			if extensions, _ := mime.ExtensionsByType(types[i]); len(extensions) > 0 {
				ext = extensions[0]
			}
			filename := fmt.Sprintf("reference-%d%s", i, ext)
			part, err := createDramaImageFormPart(writer, filename, types[i])
			if err != nil {
				return err
			}
			if _, err = part.Write(data); err != nil {
				return err
			}
		}
		if err = writer.Close(); err != nil {
			return err
		}
		body = buffer.Bytes()
		contentType = writer.FormDataContentType()
	} else {
		body, err = json.Marshal(input)
	}
	if err != nil {
		return err
	}
	prepared, _, err := prepareAIProtocolRequest(aiProtocolRequest{mode: aiProtocolProxyRequest, body: body, contentType: contentType, modelName: run.Snapshot.Model, channel: channel, endpoint: endpoint, path: resolveAIProxyPath(channel, run.Snapshot.Model, endpoint)})
	if err != nil {
		return errors.New("图片渠道参数编译失败：" + err.Error())
	}
	run.Body = prepared.body
	run.ContentType = prepared.contentType
	run.Endpoint = prepared.path
	return nil
}

func createDramaImageFormPart(writer *multipart.Writer, filename, mimeType string) (io.Writer, error) {
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", mime.FormatMediaType("form-data", map[string]string{"name": "image", "filename": filepath.Base(filename)}))
	header.Set("Content-Type", mimeType)
	return writer.CreatePart(header)
}
