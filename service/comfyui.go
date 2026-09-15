package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type ComfyUIWorkflow struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	Filename string `json:"filename"`
	Ready    bool   `json:"ready"`
}

type comfyUIProfile struct {
	ID       string
	Name     string
	Kind     string
	Filename string
}

var comfyUIProfiles = []comfyUIProfile{
	{"comfyui:minimax-h3-t2v", "MiniMax-H3 文生视频 3070Ti-8GB", "video", "MiniMax-H3_01_文生视频_3070Ti-8GB.json"},
	{"comfyui:minimax-h3-fl2v", "MiniMax-H3 首尾帧生视频 3070Ti-8GB", "video", "MiniMax-H3_02_首尾帧生视频_3070Ti-8GB.json"},
	{"comfyui:minimax-h3-ref2v", "MiniMax-H3 参考生视频 3070Ti-8GB", "video", "MiniMax-H3_03_参考生视频_3070Ti-8GB.json"},
	{"comfyui:minimax-music3", "MiniMax-Music3 INT8", "audio", "MiniMax-Music3_INT8、_v01.json"},
	{"comfyui:openai-image", "OpenAI兼容 图片生成与编辑", "image", "OpenAI兼容_图片生成与编辑_v01.json"},
	{"comfyui:seedvr2-image-upscale", "SeedVR2 7B FP16 图片超分", "image", "SeedVR2_7B_FP16_图片超分.json"},
	{"comfyui:vosr2-image-upscale", "VOSR 2.0 图片超分（文字与细节）", "image", "VOSR2_图片超分_文字与细节.json"},
	{"comfyui:seedvr2-upscale", "SeedVR2 7B FP16 视频超分", "video", "SeedVR2_7B_FP16_视频超分.json"},
}

var comfyUIHTTPClient = &http.Client{
	Timeout: 30 * time.Minute,
	Transport: &http.Transport{
		Proxy: nil,
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(address)
			if err != nil {
				return nil, err
			}
			addresses, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
			if err != nil || len(addresses) == 0 {
				return nil, errors.New("ComfyUI 本机地址无法解析")
			}
			for _, address := range addresses {
				if !address.IsLoopback() {
					return nil, errors.New("ComfyUI 渠道拒绝非本机地址")
				}
			}
			return (&net.Dialer{}).DialContext(ctx, network, net.JoinHostPort(addresses[0].String(), port))
		},
	},
	CheckRedirect: func(request *http.Request, _ []*http.Request) error {
		_, err := ValidateComfyUIBaseURL(request.URL.Scheme + "://" + request.URL.Host)
		return err
	},
}

type comfyUIWorkflowDocument struct {
	Nodes       []comfyUINode     `json:"nodes"`
	Links       []json.RawMessage `json:"links"`
	Definitions struct {
		Subgraphs []comfyUISubgraph `json:"subgraphs"`
	} `json:"definitions"`
}

type comfyUISubgraph struct {
	ID      string                `json:"id"`
	Nodes   []comfyUINode         `json:"nodes"`
	Links   []json.RawMessage     `json:"links"`
	Inputs  []comfyUISubgraphPort `json:"inputs"`
	Outputs json.RawMessage       `json:"outputs"`
}

type comfyUISubgraphPort struct {
	Name    string  `json:"name"`
	LinkIDs []int64 `json:"linkIds"`
}

type comfyUINode struct {
	ID                 any                `json:"id"`
	Type               string             `json:"type"`
	Title              string             `json:"title"`
	Mode               int                `json:"mode"`
	Inputs             []comfyUINodeInput `json:"inputs"`
	WidgetsValues      []any              `json:"widgets_values"`
	WidgetsValuesNamed map[string]any     `json:"widgets_values_named"`
}

type comfyUINodeInput struct {
	Name   string `json:"name"`
	Link   any    `json:"link"`
	Widget *struct {
		Name string `json:"name"`
	} `json:"widget"`
}

type comfyUILink struct {
	ID         int64
	OriginID   string
	OriginSlot int
	TargetID   string
	TargetSlot int
}

type comfyUIObjectInfo struct {
	Input struct {
		Required json.RawMessage `json:"required"`
		Optional json.RawMessage `json:"optional"`
	} `json:"input"`
	OutputNode bool `json:"output_node"`
}

type comfyUIAPINode struct {
	Inputs    map[string]any    `json:"inputs"`
	ClassType string            `json:"class_type"`
	Meta      map[string]string `json:"_meta,omitempty"`
}

func IsComfyUIChannel(protocol string) bool {
	return strings.EqualFold(strings.TrimSpace(protocol), ModelChannelProtocolComfyUI)
}

func ValidateComfyUIBaseURL(value string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.Scheme != "http" || parsed.Host == "" {
		return "", errors.New("ComfyUI 地址必须是本机 HTTP 地址")
	}
	host := parsed.Hostname()
	if !strings.EqualFold(host, "localhost") {
		ip := net.ParseIP(host)
		if ip == nil || !ip.IsLoopback() {
			return "", errors.New("ComfyUI 渠道当前仅允许连接本机回环地址")
		}
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	return strings.TrimRight(parsed.String(), "/"), nil
}

func ComfyUIWorkflows(baseURL string) ([]ComfyUIWorkflow, error) {
	baseURL, err := ValidateComfyUIBaseURL(baseURL)
	if err != nil {
		return nil, err
	}
	var files []string
	if err := comfyUIJSON(context.Background(), baseURL+"/userdata?dir=workflows&recurse=true", &files); err != nil {
		return nil, fmt.Errorf("读取 ComfyUI 工作流失败：%w", err)
	}
	available := make(map[string]bool, len(files))
	for _, item := range files {
		available[strings.ReplaceAll(item, "\\", "/")] = true
	}
	result := make([]ComfyUIWorkflow, 0, len(comfyUIProfiles))
	for _, profile := range comfyUIProfiles {
		result = append(result, ComfyUIWorkflow{ID: profile.ID, Name: profile.Name, Kind: profile.Kind, Filename: profile.Filename, Ready: available[profile.Filename]})
	}
	return result, nil
}

func PrepareComfyUIWorkflow(baseURL, modelName, endpoint string, input map[string]any) (map[string]any, string, error) {
	baseURL, err := ValidateComfyUIBaseURL(baseURL)
	if err != nil {
		return nil, "", err
	}
	profile, ok := comfyUIProfileForID(modelName)
	if !ok {
		return nil, "", errors.New("当前 ComfyUI 工作流尚未适配")
	}
	if endpointKind(endpoint) != profile.Kind && !(profile.ID == "comfyui:seedvr2-upscale" && endpoint == "/videos") {
		return nil, "", errors.New("该 ComfyUI 工作流不支持当前生成入口")
	}
	var workflow comfyUIWorkflowDocument
	workflowURL := baseURL + "/userdata/" + url.PathEscape("workflows/"+profile.Filename)
	if err := comfyUIJSON(context.Background(), workflowURL, &workflow); err != nil {
		return nil, "", fmt.Errorf("读取 ComfyUI 工作流失败：%w", err)
	}
	var objectInfoRaw map[string]json.RawMessage
	if err := comfyUIJSON(context.Background(), baseURL+"/object_info", &objectInfoRaw); err != nil {
		return nil, "", fmt.Errorf("读取 ComfyUI 节点定义失败：%w", err)
	}
	objectInfo := make(map[string]comfyUIObjectInfo, len(objectInfoRaw))
	for name, raw := range objectInfoRaw {
		var info comfyUIObjectInfo
		if json.Unmarshal(raw, &info) == nil {
			objectInfo[name] = info
		}
	}
	prompt, err := convertComfyUIWorkflow(workflow, objectInfo)
	if err != nil {
		return nil, "", err
	}
	if err := patchComfyUIWorkflow(prompt, profile, input); err != nil {
		return nil, "", err
	}
	if err := validateComfyUIAPIPrompt(prompt, objectInfo); err != nil {
		return nil, "", err
	}
	return map[string]any{"prompt": prompt, "client_id": "infinite-canvas"}, profile.Kind, nil
}

func endpointKind(endpoint string) string {
	switch endpoint {
	case "/images/generations", "/images/edits":
		return "image"
	case "/videos":
		return "video"
	case "/audio/speech":
		return "audio"
	default:
		return ""
	}
}

func comfyUIProfileForID(id string) (comfyUIProfile, bool) {
	for _, profile := range comfyUIProfiles {
		if profile.ID == strings.TrimSpace(id) {
			return profile, true
		}
	}
	return comfyUIProfile{}, false
}

func comfyUIJSON(ctx context.Context, requestURL string, target any) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return err
	}
	res, err := comfyUIHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("HTTP %d", res.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(res.Body, 16<<20)).Decode(target)
}

func convertComfyUIWorkflow(workflow comfyUIWorkflowDocument, objectInfo map[string]comfyUIObjectInfo) (map[string]comfyUIAPINode, error) {
	topLinks, err := parseComfyUILinks(workflow.Links)
	if err != nil {
		return nil, err
	}
	subgraphs := make(map[string]comfyUISubgraph, len(workflow.Definitions.Subgraphs))
	for _, subgraph := range workflow.Definitions.Subgraphs {
		subgraphs[subgraph.ID] = subgraph
	}
	outerNodes := make(map[string]comfyUINode, len(workflow.Nodes))
	for _, node := range workflow.Nodes {
		outerNodes[nodeID(node.ID)] = node
	}
	result := map[string]comfyUIAPINode{}
	for _, node := range workflow.Nodes {
		if node.Mode == 2 || node.Mode == 4 || node.Type == "MarkdownNote" {
			continue
		}
		if subgraph, found := subgraphs[node.Type]; found {
			innerLinks, parseErr := parseComfyUILinks(subgraph.Links)
			if parseErr != nil {
				return nil, parseErr
			}
			for _, inner := range subgraph.Nodes {
				if inner.Mode == 2 || inner.Mode == 4 || inner.Type == "MarkdownNote" {
					continue
				}
				id := nodeID(node.ID) + ":" + nodeID(inner.ID)
				apiNode, buildErr := buildComfyUIAPINode(inner, objectInfo[inner.Type], func(linkID int64) (any, bool) {
					return resolveInnerComfyUILink(linkID, innerLinks, subgraph, node, topLinks, outerNodes, subgraphs)
				})
				if buildErr != nil {
					return nil, buildErr
				}
				result[id] = apiNode
			}
			continue
		}
		apiNode, buildErr := buildComfyUIAPINode(node, objectInfo[node.Type], func(linkID int64) (any, bool) {
			return resolveTopComfyUILink(linkID, topLinks, outerNodes, subgraphs)
		})
		if buildErr != nil {
			return nil, buildErr
		}
		result[nodeID(node.ID)] = apiNode
	}
	return result, nil
}

func buildComfyUIAPINode(node comfyUINode, info comfyUIObjectInfo, resolve func(int64) (any, bool)) (comfyUIAPINode, error) {
	inputs := map[string]any{}
	for name, value := range node.WidgetsValuesNamed {
		inputs[name] = value
	}
	if len(node.WidgetsValuesNamed) == 0 {
		widgetNames, controls := comfyUIWidgetNames(info)
		index := 0
		for _, name := range widgetNames {
			if index >= len(node.WidgetsValues) {
				break
			}
			inputs[name] = node.WidgetsValues[index]
			index++
			if controls[name] && index < len(node.WidgetsValues) {
				index++
			}
		}
	}
	for _, input := range node.Inputs {
		if input.Widget != nil && len(node.WidgetsValuesNamed) == 0 {
			// Older workflows may omit named widget values; object_info handled them above.
		}
		linkID, linked := numericID(input.Link)
		if !linked {
			continue
		}
		value, ok := resolve(linkID)
		if !ok {
			return comfyUIAPINode{}, fmt.Errorf("ComfyUI 工作流连接 %d 无法解析", linkID)
		}
		if value == nil {
			continue
		}
		inputs[input.Name] = value
	}
	meta := map[string]string{}
	if strings.TrimSpace(node.Title) != "" {
		meta["title"] = node.Title
	}
	return comfyUIAPINode{Inputs: inputs, ClassType: node.Type, Meta: meta}, nil
}

func comfyUIWidgetNames(info comfyUIObjectInfo) ([]string, map[string]bool) {
	names := []string{}
	controls := map[string]bool{}
	for _, raw := range []json.RawMessage{info.Input.Required, info.Input.Optional} {
		fields, _ := orderedJSONFields(raw)
		for _, field := range fields {
			if comfyUIWidgetDefinition(field.Value) {
				names = append(names, field.Name)
				if bytes.Contains(field.Value, []byte(`"control_after_generate"`)) {
					controls[field.Name] = true
				}
			}
		}
	}
	return names, controls
}

type orderedJSONField struct {
	Name  string
	Value json.RawMessage
}

func orderedJSONFields(raw json.RawMessage) ([]orderedJSONField, error) {
	if len(raw) == 0 || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return nil, nil
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	token, err := decoder.Token()
	if err != nil || token != json.Delim('{') {
		return nil, err
	}
	result := []orderedJSONField{}
	for decoder.More() {
		key, _ := decoder.Token()
		var value json.RawMessage
		if err := decoder.Decode(&value); err != nil {
			return nil, err
		}
		result = append(result, orderedJSONField{Name: key.(string), Value: value})
	}
	_, err = decoder.Token()
	return result, err
}

func comfyUIWidgetDefinition(raw json.RawMessage) bool {
	var definition []json.RawMessage
	if json.Unmarshal(raw, &definition) != nil || len(definition) == 0 {
		return false
	}
	if len(definition) > 1 && bytes.Contains(definition[1], []byte(`"forceInput":true`)) {
		return false
	}
	var kind string
	if json.Unmarshal(definition[0], &kind) == nil {
		switch kind {
		case "STRING", "INT", "FLOAT", "BOOLEAN", "COMBO", "COMFY_DYNAMICCOMBO_V3":
			return true
		default:
			return false
		}
	}
	var choices []any
	return json.Unmarshal(definition[0], &choices) == nil
}

func validateComfyUIAPIPrompt(prompt map[string]comfyUIAPINode, objectInfo map[string]comfyUIObjectInfo) error {
	for id, node := range prompt {
		info, found := objectInfo[node.ClassType]
		if !found {
			return fmt.Errorf("ComfyUI 缺少节点：%s", node.ClassType)
		}
		fields, err := orderedJSONFields(info.Input.Required)
		if err != nil {
			return errors.New("ComfyUI 节点定义格式错误")
		}
		for _, field := range fields {
			if _, exists := node.Inputs[field.Name]; exists {
				continue
			}
			dynamic := false
			for inputName := range node.Inputs {
				if strings.HasPrefix(inputName, field.Name+".") {
					dynamic = true
					break
				}
			}
			if !dynamic {
				return fmt.Errorf("ComfyUI 节点 %s（%s）缺少必填输入：%s", id, node.ClassType, field.Name)
			}
		}
		for inputName, value := range node.Inputs {
			connection, ok := value.([]any)
			if !ok || len(connection) != 2 {
				continue
			}
			sourceID := nodeID(connection[0])
			if _, exists := prompt[sourceID]; !exists {
				return fmt.Errorf("ComfyUI 节点 %s 的输入 %s 引用了不存在的节点 %s", id, inputName, sourceID)
			}
		}
	}
	return nil
}

func parseComfyUILinks(rawLinks []json.RawMessage) (map[int64]comfyUILink, error) {
	result := make(map[int64]comfyUILink, len(rawLinks))
	for _, raw := range rawLinks {
		var list []any
		if json.Unmarshal(raw, &list) == nil && len(list) >= 5 {
			id, _ := numericID(list[0])
			originSlot, _ := numericID(list[2])
			targetSlot, _ := numericID(list[4])
			result[id] = comfyUILink{ID: id, OriginID: nodeID(list[1]), OriginSlot: int(originSlot), TargetID: nodeID(list[3]), TargetSlot: int(targetSlot)}
			continue
		}
		var object struct {
			ID         int64 `json:"id"`
			OriginID   any   `json:"origin_id"`
			OriginSlot int   `json:"origin_slot"`
			TargetID   any   `json:"target_id"`
			TargetSlot int   `json:"target_slot"`
		}
		if err := json.Unmarshal(raw, &object); err != nil {
			return nil, errors.New("ComfyUI 工作流连接格式错误")
		}
		result[object.ID] = comfyUILink{ID: object.ID, OriginID: nodeID(object.OriginID), OriginSlot: object.OriginSlot, TargetID: nodeID(object.TargetID), TargetSlot: object.TargetSlot}
	}
	return result, nil
}

func resolveTopComfyUILink(linkID int64, links map[int64]comfyUILink, nodes map[string]comfyUINode, subgraphs map[string]comfyUISubgraph) (any, bool) {
	link, ok := links[linkID]
	if !ok {
		return nil, false
	}
	origin := nodes[link.OriginID]
	if subgraph, found := subgraphs[origin.Type]; found {
		innerLinks, err := parseComfyUILinks(subgraph.Links)
		if err != nil {
			return nil, false
		}
		for _, innerLink := range innerLinks {
			if innerLink.TargetID == "-20" && innerLink.TargetSlot == link.OriginSlot {
				return []any{link.OriginID + ":" + innerLink.OriginID, innerLink.OriginSlot}, true
			}
		}
		return nil, false
	}
	return []any{link.OriginID, link.OriginSlot}, true
}

func resolveInnerComfyUILink(linkID int64, links map[int64]comfyUILink, subgraph comfyUISubgraph, outer comfyUINode, topLinks map[int64]comfyUILink, topNodes map[string]comfyUINode, subgraphs map[string]comfyUISubgraph) (any, bool) {
	link, ok := links[linkID]
	if !ok {
		return nil, false
	}
	if link.OriginID != "-10" {
		return []any{nodeID(outer.ID) + ":" + link.OriginID, link.OriginSlot}, true
	}
	if link.OriginSlot < 0 || link.OriginSlot >= len(subgraph.Inputs) {
		return nil, false
	}
	name := subgraph.Inputs[link.OriginSlot].Name
	for _, input := range outer.Inputs {
		if input.Name != name {
			continue
		}
		if outerLinkID, linked := numericID(input.Link); linked {
			return resolveTopComfyUILink(outerLinkID, topLinks, topNodes, subgraphs)
		}
		if value, found := outer.WidgetsValuesNamed[name]; found {
			return value, true
		}
		for index, candidate := range outer.Inputs {
			if candidate.Widget != nil && candidate.Name == name && index < len(outer.WidgetsValues) {
				return outer.WidgetsValues[index], true
			}
		}
	}
	// Unconnected optional subgraph ports are represented by links to -10 and
	// should simply be omitted from the API graph.
	return nil, true
}

func nodeID(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	case int:
		return strconv.Itoa(typed)
	case int64:
		return strconv.FormatInt(typed, 10)
	case json.Number:
		return typed.String()
	default:
		return strings.TrimSpace(fmt.Sprint(value))
	}
}

func numericID(value any) (int64, bool) {
	if value == nil {
		return 0, false
	}
	switch typed := value.(type) {
	case float64:
		return int64(typed), true
	case int64:
		return typed, true
	case int:
		return int64(typed), true
	case json.Number:
		number, err := typed.Int64()
		return number, err == nil
	case string:
		number, err := strconv.ParseInt(typed, 10, 64)
		return number, err == nil
	default:
		return 0, false
	}
}

func patchComfyUIWorkflow(prompt map[string]comfyUIAPINode, profile comfyUIProfile, input map[string]any) error {
	text := comfyUIFirstString(input["prompt"], input["input"])
	prefix := "infinite-canvas/" + strings.TrimPrefix(profile.ID, "comfyui:") + "_" + time.Now().Format("20060102_150405")
	if err := patchComfyUIOptionalGenerationInputs(prompt, profile.ID, input); err != nil {
		return err
	}
	switch profile.ID {
	case "comfyui:minimax-h3-t2v":
		setComfyUIInput(prompt, "138", "value", text)
		setComfyUIInput(prompt, "143", "filename_prefix", prefix)
		patchComfyUIResolution(prompt, "115", input)
	case "comfyui:minimax-h3-fl2v":
		first := comfyUIFirstString(input["first_frame_url"])
		last := comfyUIFirstString(input["last_frame_url"])
		if first == "" {
			return errors.New("MiniMax-H3 首尾帧工作流需要首帧")
		}
		if last == "" {
			last = first
		}
		setComfyUIInput(prompt, "137", "image", first)
		setComfyUIInput(prompt, "139", "image", last)
		setComfyUIInput(prompt, "138", "value", text)
		setComfyUIInput(prompt, "143", "filename_prefix", prefix)
		patchComfyUIResolution(prompt, "115", input)
	case "comfyui:minimax-h3-ref2v":
		images := firstStrings(input["input_reference[]"], input["images"])
		if len(images) != 3 {
			return errors.New("MiniMax-H3 参考生视频工作流仅支持按顺序连接 3 张参考图，不能省略或丢弃额外参考图")
		}
		for index, id := range []string{"137", "139", "148"} {
			setComfyUIInput(prompt, id, "image", images[index])
		}
		setComfyUIInput(prompt, "176:138", "value", text)
		setComfyUIInput(prompt, "176:144", "filename_prefix", prefix)
		patchComfyUIResolution(prompt, "176:115", input)
	case "comfyui:minimax-music3":
		if text == "" {
			return errors.New("MiniMax-Music3 需要音乐描述")
		}
		setComfyUIInput(prompt, "37:13", "caption", text)
		setComfyUIInput(prompt, "37:13", "lyrics", "[Intro]\n[Instrumental]\n\n[Outro]\n[Instrumental]")
		setComfyUIInput(prompt, "35", "filename_prefix", prefix)
	case "comfyui:openai-image":
		setComfyUIInput(prompt, "1", "prompt", text)
		setComfyUIInput(prompt, "1", "size", comfyUIImageSize(comfyUIFirstString(input["size"])))
		setComfyUIInput(prompt, "1", "quality", comfyUIFirstStringDefault(input["quality"], "auto"))
		setComfyUIInput(prompt, "1", "number_images", comfyUIInt(input["n"], 1, 1, 5))
		setComfyUIInput(prompt, "1", "filename_prefix", prefix)
		images := firstStrings(input["image"], input["images"])
		patchComfyUIImageReferences(prompt, images)
	case "comfyui:seedvr2-image-upscale":
		images := firstStrings(input["image"], input["images"])
		if len(images) != 1 {
			return errors.New("SeedVR2 图片超分工作流仅支持连接一张原图")
		}
		setComfyUIInput(prompt, "1", "image", images[0])
		patchComfyUIImageUpscaleResolution(prompt, "2", input)
		setComfyUIInput(prompt, "11", "filename_prefix", prefix)
	case "comfyui:vosr2-image-upscale":
		images := firstStrings(input["image"], input["images"])
		if len(images) != 1 {
			return errors.New("VOSR 2.0 图片超分工作流仅支持连接一张原图")
		}
		setComfyUIInput(prompt, "1", "image", images[0])
		setComfyUIInput(prompt, "3", "upscale", 4)
		prompt["99001"] = comfyUIAPINode{
			ClassType: "ResizeImageMaskNode",
			Inputs: map[string]any{
				"input":        []any{"3", 0},
				"resize_type":  "scale longer dimension",
				"longer_size":  comfyUIImageUpscaleLongEdge(input),
				"scale_method": "lanczos",
			},
			Meta: map[string]string{"title": "无限画布原比例输出尺寸"},
		}
		setComfyUIInput(prompt, "4", "images", []any{"99001", 0})
		setComfyUIInput(prompt, "4", "filename_prefix", prefix)
	case "comfyui:seedvr2-upscale":
		videos := firstStrings(input["video_reference[]"], input["videos"])
		if len(videos) != 1 {
			return errors.New("SeedVR2 视频超分工作流仅支持连接一个参考视频")
		}
		setComfyUIInput(prompt, "73", "file", videos[0])
		patchComfyUIVideoUpscaleResolution(prompt, "66:57", input)
		setComfyUIInput(prompt, "76", "filename_prefix", prefix)
	}
	return nil
}

func patchComfyUIVideoUpscaleResolution(prompt map[string]comfyUIAPINode, id string, input map[string]any) {
	setComfyUIInput(prompt, id, "resize_type", "scale longer dimension")
	setComfyUIInput(prompt, id, "longer_size", comfyUIVideoUpscaleLongEdge(input))
	setComfyUIInput(prompt, id, "scale_method", "lanczos")
	node := prompt[id]
	delete(node.Inputs, "multiplier")
	prompt[id] = node
}

func comfyUIVideoUpscaleLongEdge(input map[string]any) int {
	value := strings.ToLower(comfyUIFirstString(input["resolution_name"], input["quality"], input["size"]))
	if strings.Contains(value, "2k") {
		return 2048
	}
	if strings.Contains(value, "1080") {
		return 1920
	}
	return 1280
}

func patchComfyUIImageUpscaleResolution(prompt map[string]comfyUIAPINode, id string, input map[string]any) {
	setComfyUIInput(prompt, id, "resize_type", "scale longer dimension")
	setComfyUIInput(prompt, id, "longer_size", comfyUIImageUpscaleLongEdge(input))
	setComfyUIInput(prompt, id, "scale_method", "lanczos")
	node := prompt[id]
	delete(node.Inputs, "multiplier")
	prompt[id] = node
}

func comfyUIImageUpscaleLongEdge(input map[string]any) int {
	value := strings.ToLower(comfyUIFirstString(input["quality"], input["resolution_name"], input["size"]))
	if strings.Contains(value, "4k") || value == "high" {
		return 3840
	}
	return 2048
}

func patchComfyUIOptionalGenerationInputs(prompt map[string]comfyUIAPINode, profileID string, input map[string]any) error {
	durationID, seedID, seedKey := "", "", "noise_seed"
	switch profileID {
	case "comfyui:minimax-h3-t2v", "comfyui:minimax-h3-fl2v":
		durationID, seedID = "132", "129"
	case "comfyui:minimax-h3-ref2v":
		durationID, seedID = "176:132", "176:129"
	case "comfyui:minimax-music3":
		seedID, seedKey = "37:38", "seed"
	case "comfyui:seedvr2-upscale":
		seedID, seedKey = "66:54", "seed"
	case "comfyui:seedvr2-image-upscale":
		seedID, seedKey = "8", "seed"
	case "comfyui:vosr2-image-upscale":
		seedID, seedKey = "3", "seed"
	}
	if value := comfyUIFirstString(input["seconds"], input["duration"]); value != "" && durationID != "" {
		duration, err := strconv.ParseFloat(value, 64)
		if err != nil || !(duration > 0 && duration <= 30) {
			return errors.New("ComfyUI 视频时长必须大于 0 且不超过 30 秒")
		}
		setComfyUIInput(prompt, durationID, "value", duration)
	}
	if value := comfyUIFirstString(input["seed"]); value != "" && seedID != "" {
		seed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || seed < 0 || seed > 1<<53-1 {
			return errors.New("ComfyUI seed 必须是 0 到 9007199254740991 的整数")
		}
		setComfyUIInput(prompt, seedID, seedKey, seed)
	}
	return nil
}

func setComfyUIInput(prompt map[string]comfyUIAPINode, id, name string, value any) {
	node, ok := prompt[id]
	if !ok {
		return
	}
	if node.Inputs == nil {
		node.Inputs = map[string]any{}
	}
	node.Inputs[name] = value
	prompt[id] = node
}

func patchComfyUIImageReferences(prompt map[string]comfyUIAPINode, images []string) {
	delete(prompt, "4")
	delete(prompt, "5")
	if len(images) == 0 {
		delete(prompt, "3")
		node := prompt["1"]
		delete(node.Inputs, "reference_image")
		prompt["1"] = node
		return
	}
	batch := prompt["3"]
	batch.Inputs = map[string]any{}
	for index, image := range images {
		id := "900" + strconv.Itoa(index+1)
		prompt[id] = comfyUIAPINode{ClassType: "LoadImage", Inputs: map[string]any{"image": image}, Meta: map[string]string{"title": "无限画布参考图"}}
		batch.Inputs["images.image"+strconv.Itoa(index)] = []any{id, 0}
	}
	prompt["3"] = batch
	setComfyUIInput(prompt, "1", "reference_image", []any{"3", 0})
}

func patchComfyUIResolution(prompt map[string]comfyUIAPINode, id string, input map[string]any) {
	size := strings.ToLower(comfyUIFirstString(input["size"]))
	ratio := "16:9 (Widescreen)"
	if strings.Contains(size, "9:16") {
		ratio = "9:16 (Portrait Widescreen)"
	} else if strings.Contains(size, "1:1") {
		ratio = "1:1 (Square)"
	} else if strings.Contains(size, "3:4") {
		ratio = "3:4 (Portrait Standard)"
	} else if strings.Contains(size, "4:3") {
		ratio = "4:3 (Standard)"
	} else if strings.Contains(size, "21:9") {
		ratio = "21:9 (Ultrawide)"
	} else if strings.Contains(size, "x") {
		parts := strings.Split(size, "x")
		if len(parts) == 2 {
			w, _ := strconv.ParseFloat(parts[0], 64)
			h, _ := strconv.ParseFloat(parts[1], 64)
			if h > w {
				ratio = "9:16 (Portrait Widescreen)"
			}
		}
	}
	quality := strings.ToLower(comfyUIFirstString(input["resolution_name"]))
	megapixels := 0.4
	if strings.Contains(quality, "720") {
		megapixels = 0.9
	} else if strings.Contains(quality, "1080") || strings.Contains(quality, "2k") || strings.Contains(quality, "4k") {
		megapixels = 2.0
	}
	if size != "" && size != "auto" {
		setComfyUIInput(prompt, id, "aspect_ratio", ratio)
	}
	if quality != "" && quality != "auto" {
		setComfyUIInput(prompt, id, "megapixels", megapixels)
	}
}

func comfyUIDuration(input map[string]any, fallback float64) float64 {
	value := comfyUIFirstString(input["seconds"], input["duration"])
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || parsed <= 0 {
		return fallback
	}
	if parsed > 30 {
		return 30
	}
	return parsed
}
func comfyUIImageSize(value string) string {
	switch value {
	case "1:1", "1024x1024":
		return "1024x1024"
	case "9:16", "3:4", "1024x1536":
		return "1024x1536"
	case "16:9", "4:3", "1536x1024":
		return "1536x1024"
	default:
		return "auto"
	}
}
func comfyUIInt(value any, fallback, minValue, maxValue int) int {
	parsed, err := strconv.Atoi(comfyUIFirstString(value))
	if err != nil {
		return fallback
	}
	if parsed < minValue {
		return minValue
	}
	if parsed > maxValue {
		return maxValue
	}
	return parsed
}
func randomComfyUISeed() int64 {
	max := big.NewInt(1<<53 - 1)
	value, err := rand.Int(rand.Reader, max)
	if err != nil {
		return time.Now().UnixNano() & ((1 << 53) - 1)
	}
	return value.Int64()
}
func comfyUIFirstString(values ...any) string {
	for _, value := range values {
		if text := strings.TrimSpace(fmt.Sprint(value)); value != nil && text != "" && text != "<nil>" {
			return text
		}
	}
	return ""
}
func comfyUIFirstStringDefault(value any, fallback string) string {
	if text := comfyUIFirstString(value); text != "" {
		return text
	}
	return fallback
}
func firstStrings(values ...any) []string {
	for _, value := range values {
		result := []string{}
		switch typed := value.(type) {
		case []any:
			for _, item := range typed {
				if text := comfyUIFirstString(item); text != "" {
					result = append(result, text)
				}
			}
		case []string:
			for _, item := range typed {
				if text := strings.TrimSpace(item); text != "" {
					result = append(result, text)
				}
			}
		default:
			if text := comfyUIFirstString(value); text != "" {
				result = append(result, text)
			}
		}
		if len(result) > 0 {
			return result
		}
	}
	return nil
}

func ComfyUIProxyRequest(ctx context.Context, baseURL, method, path string, body io.Reader, contentType string) (*http.Response, error) {
	baseURL, err := ValidateComfyUIBaseURL(baseURL)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, method, baseURL+path, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return comfyUIHTTPClient.Do(req)
}

func ComfyUIUpload(ctx context.Context, baseURL, filename string, file io.Reader) (map[string]any, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("image", filepath.Base(filename))
	if err != nil {
		return nil, err
	}
	if _, err = io.Copy(part, io.LimitReader(file, 256<<20)); err != nil {
		return nil, err
	}
	_ = writer.WriteField("type", "input")
	if err = writer.Close(); err != nil {
		return nil, err
	}
	res, err := ComfyUIProxyRequest(ctx, baseURL, http.MethodPost, "/upload/image", &body, writer.FormDataContentType())
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	var payload map[string]any
	if json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&payload) != nil || res.StatusCode >= 400 {
		return nil, fmt.Errorf("ComfyUI 素材上传失败：HTTP %d", res.StatusCode)
	}
	return payload, nil
}
