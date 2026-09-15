package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

type DramaComfyUIReference struct{ Kind, Filename string }

// Bind only the current workflow's exposed task ports, preserving its processing graph.
func PrepareDramaComfyUIWorkflow(ctx context.Context, baseURL, runID, promptText string, parameters map[string]any, references []DramaComfyUIReference) (map[string]any, error) {
	baseURL, err := ValidateComfyUIBaseURL(baseURL)
	if err != nil {
		return nil, err
	}
	profile, _ := comfyUIProfileForID("comfyui:minimax-h3-ref2v")
	var workflow comfyUIWorkflowDocument
	if err = comfyUIJSON(ctx, baseURL+"/userdata/"+url.PathEscape("workflows/"+profile.Filename), &workflow); err != nil {
		return nil, err
	}
	var raw map[string]json.RawMessage
	if err = comfyUIJSON(ctx, baseURL+"/object_info", &raw); err != nil {
		return nil, err
	}
	info := map[string]comfyUIObjectInfo{}
	for name, value := range raw {
		var entry comfyUIObjectInfo
		if json.Unmarshal(value, &entry) == nil {
			info[name] = entry
		}
	}
	return compileDramaComfyUIWorkflow(workflow, info, runID, promptText, parameters, references)
}

func FinalizeDramaComfyUIIdentity(payload map[string]any, runID string) error {
	graph, ok := payload["prompt"].(map[string]comfyUIAPINode)
	if !ok {
		return errors.New("无效工作流图")
	}
	for _, node := range graph {
		for key, value := range node.Inputs {
			lower := strings.ToLower(key)
			if (strings.Contains(lower, "api_key") || strings.Contains(lower, "apikey") || lower == "token" || strings.Contains(lower, "password") || lower == "authorization") && comfyUIFirstString(value) != "" {
				return errors.New("工作流包含凭据字段，不能将其写入生成快照")
			}
			if key == "filename_prefix" {
				node.Inputs[key] = "infinite-canvas/drama/" + runID + "/video"
			}
		}
	}
	payload["client_id"] = runID
	return nil
}

func compileDramaComfyUIWorkflow(workflow comfyUIWorkflowDocument, info map[string]comfyUIObjectInfo, runID, promptText string, parameters map[string]any, references []DramaComfyUIReference) (map[string]any, error) {
	var outer comfyUINode
	var subgraph comfyUISubgraph
	found := false
	for _, sg := range workflow.Definitions.Subgraphs {
		hasPicture := false
		for _, port := range sg.Inputs {
			if port.Name == "picture_1_keyframe" {
				hasPicture = true
			}
		}
		if hasPicture {
			for _, node := range workflow.Nodes {
				if node.Type == sg.ID {
					outer = node
					subgraph = sg
					found = true
					break
				}
			}
		}
	}
	if !found {
		return nil, errors.New("当前 H3 工作流缺少公开多模态任务节点")
	}
	exposed := map[string]bool{}
	for _, port := range subgraph.Inputs {
		exposed[port.Name] = true
	}
	values := map[string]any{}
	for k, v := range outer.WidgetsValuesNamed {
		values[k] = v
	}
	for key := range values {
		if strings.HasPrefix(key, "picture_") || strings.HasPrefix(key, "video_") || strings.HasPrefix(key, "audio_") {
			delete(values, key)
		}
	}
	if len(values) == 0 {
		index := 0
		for _, port := range outer.Inputs {
			if port.Widget != nil && index < len(outer.WidgetsValues) {
				values[port.Name] = outer.WidgetsValues[index]
				index++
			}
		}
	}
	values["value"] = promptText
	values["filename_prefix"] = "infinite-canvas/drama/" + runID + "/video"
	if value := comfyUIFirstString(parameters["seconds"], parameters["duration"]); value != "" {
		seconds, err := strconv.ParseFloat(value, 64)
		if err != nil || !(seconds > 0 && seconds <= 30) {
			return nil, errors.New("H3 时长必须大于0且不超过30秒")
		}
		values["value_1"] = seconds
	}
	if value := comfyUIFirstString(parameters["seed"]); value != "" {
		seed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || seed < 0 || seed > 1<<53-1 {
			return nil, errors.New("H3 seed 无效")
		}
		values["noise_seed"] = seed
		values["second_pass_noise_seed"] = seed
	}
	if value := comfyUIFirstString(parameters["steps"]); value != "" {
		steps, err := strconv.Atoi(value)
		if err != nil || steps < 1 || steps > 1000 {
			return nil, errors.New("H3 步数必须为1到1000的整数")
		}
		values["steps"] = steps
	}
	resolution := map[string]comfyUIAPINode{"resolution": {Inputs: map[string]any{}}}
	patchComfyUIResolution(resolution, "resolution", parameters)
	for k, v := range resolution["resolution"].Inputs {
		values[k] = v
	}
	loaders := map[string]comfyUIAPINode{}
	pictures, videos, audios := 0, 0, 0
	for _, ref := range references {
		id := fmt.Sprintf("drama_input_%d", len(loaders))
		switch ref.Kind {
		case "image":
			pictures++
			if pictures > 9 {
				return nil, errors.New("当前 H3 工作流最多支持9张图片，不能丢弃超额图片")
			}
			name := fmt.Sprintf("picture_%d", pictures)
			if pictures == 1 {
				name = "picture_1_keyframe"
			} else if pictures == 2 {
				name = "picture_2_identity"
			} else if pictures == 3 {
				name = "picture_3_scene"
			}
			if !exposed[name] {
				return nil, fmt.Errorf("当前工作流未公开 %s 输入", name)
			}
			values[name] = []any{id, 0}
			loaders[id] = comfyUIAPINode{ClassType: "LoadImage", Inputs: map[string]any{"image": ref.Filename}}
		case "video":
			videos++
			if videos > 3 {
				return nil, errors.New("当前 H3 工作流最多支持3段视频")
			}
			frames, audio := fmt.Sprintf("video_%d_frames", videos), fmt.Sprintf("video_%d_audio", videos)
			if !exposed[frames] || !exposed[audio] {
				return nil, errors.New("当前工作流未公开视频多模态输入")
			}
			loaders[id] = comfyUIAPINode{ClassType: "LoadVideo", Inputs: map[string]any{"file": ref.Filename}}
			loaders[id+"_parts"] = comfyUIAPINode{ClassType: "GetVideoComponents", Inputs: map[string]any{"video": []any{id, 0}}}
			values[frames] = []any{id + "_parts", 0}
			values[audio] = []any{id + "_parts", 1}
		case "audio":
			audios++
			if audios > 3 {
				return nil, errors.New("当前 H3 工作流最多支持3段独立音频")
			}
			name := fmt.Sprintf("audio_%d", audios)
			if !exposed[name] {
				return nil, errors.New("当前工作流未公开独立音频输入")
			}
			values[name] = []any{id, 0}
			loaders[id] = comfyUIAPINode{ClassType: "LoadAudio", Inputs: map[string]any{"audio": ref.Filename}}
		default:
			return nil, errors.New("不支持的 H3 素材类型")
		}
	}
	if pictures == 0 {
		return nil, errors.New("H3 参考生视频需要完整故事板作为第一张图片")
	}
	for key := range values {
		if !exposed[key] {
			return nil, fmt.Errorf("工作流公开输入已变化：%s", key)
		}
	}
	for index := range outer.Inputs {
		name := outer.Inputs[index].Name
		outer.Inputs[index].Link = nil
		if (strings.HasPrefix(name, "picture_") || strings.HasPrefix(name, "video_") || strings.HasPrefix(name, "audio_")) && values[name] == nil {
			delete(values, name)
		}
	}
	outer.WidgetsValuesNamed = values
	workflow.Nodes = []comfyUINode{outer}
	workflow.Links = nil
	graph, err := convertComfyUIWorkflow(workflow, info)
	if err != nil {
		return nil, err
	}
	for id, node := range loaders {
		graph[id] = node
	}
	if err = validateComfyUIAPIPrompt(graph, info); err != nil {
		return nil, err
	}
	for _, node := range graph {
		for key, value := range node.Inputs {
			lower := strings.ToLower(key)
			if (strings.Contains(lower, "api_key") || strings.Contains(lower, "apikey") || lower == "token" || strings.Contains(lower, "password") || lower == "authorization") && comfyUIFirstString(value) != "" {
				return nil, errors.New("工作流包含凭据字段，不能将其写入生成快照")
			}
		}
	}
	return map[string]any{"prompt": graph, "client_id": runID}, nil
}
