package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/tigerowo/infinite-canvas/model"
	"os"
	"os/exec"
	"strings"
	"time"
)

// Probe owned media bytes; never pass a user URL or user-controlled command to the process.
func DramaVideoHasAudio(ctx context.Context, data []byte) (bool, error) {
	executable := strings.TrimSpace(os.Getenv("DRAMA_FFPROBE_PATH"))
	if executable == "" {
		var err error
		executable, err = exec.LookPath("ffprobe")
		if err != nil {
			return false, errors.New("视频参考需要配置 DRAMA_FFPROBE_PATH 检查内嵌音轨后才能确认 H3 编号")
		}
	}
	file, err := os.CreateTemp("", "drama-video-probe-*")
	if err != nil {
		return false, err
	}
	defer os.Remove(file.Name())
	if _, err = file.Write(data); err != nil {
		file.Close()
		return false, err
	}
	if err = file.Close(); err != nil {
		return false, err
	}
	probeCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(probeCtx, executable, "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "json", file.Name())
	output, err := cmd.Output()
	if err != nil {
		return false, errors.New("无法检查视频音轨，请检查 ffprobe 和媒体完整性")
	}
	var probe struct{ Streams []struct{ Index int } }
	if json.Unmarshal(output, &probe) != nil {
		return false, errors.New("视频音轨检查响应无效")
	}
	return len(probe.Streams) > 0, nil
}

// H3 presents pictures first, then each video's optional soundtrack and frames, then voices.
func DramaH3InputMapping(refs []model.DramaRunReference, kinds []string, videoHasAudio map[int]bool) ([]model.DramaRunInputMapping, error) {
	return dramaH3InputMapping(refs, kinds, videoHasAudio, false)
}

// DramaH3InputMappingWithoutKeyframe leaves picture_1_keyframe empty while
// keeping every bound image, including the director board, as a normal reference.
func DramaH3InputMappingWithoutKeyframe(refs []model.DramaRunReference, kinds []string, videoHasAudio map[int]bool) ([]model.DramaRunInputMapping, error) {
	return dramaH3InputMapping(refs, kinds, videoHasAudio, true)
}

func dramaH3InputMapping(refs []model.DramaRunReference, kinds []string, videoHasAudio map[int]bool, withoutKeyframe bool) ([]model.DramaRunInputMapping, error) {
	if len(refs) != len(kinds) {
		return nil, errors.New("参考映射不完整")
	}
	result := []model.DramaRunInputMapping{}
	pictures, videos, audios, voices := 0, 0, 0, 0
	pictureSlot := 0
	if withoutKeyframe {
		pictureSlot = 1
	}
	add := func(index int, port, tag, kind string) {
		r := refs[index]
		result = append(result, model.DramaRunInputMapping{ReferenceOrder: r.Order, StorageID: r.StorageID, Port: port, Tag: tag, Kind: kind, PresentationOrder: len(result) + 1, Speaker: r.Speaker})
	}
	for index, kind := range kinds {
		if kind == "image" {
			pictures++
			pictureSlot++
			port := fmt.Sprintf("picture_%d", pictureSlot)
			if pictureSlot == 1 {
				port = "picture_1_keyframe"
			} else if pictureSlot == 2 {
				port = "picture_2_identity"
			} else if pictureSlot == 3 {
				port = "picture_3_scene"
			}
			add(index, port, fmt.Sprintf("<Picture %d>", pictures), "image")
		}
	}
	for index, kind := range kinds {
		if kind == "video" {
			videos++
			hasAudio, known := videoHasAudio[index]
			if !known {
				return nil, errors.New("视频音轨尚未检查，不能猜测 H3 音频编号")
			}
			if hasAudio {
				audios++
				add(index, fmt.Sprintf("video_%d_audio", videos), fmt.Sprintf("<Audio %d>", audios), "embedded_audio")
			}
			add(index, fmt.Sprintf("video_%d_frames", videos), fmt.Sprintf("<Video %d>", videos), "video")
		}
	}
	for index, kind := range kinds {
		if kind == "audio" {
			audios++
			voices++
			add(index, fmt.Sprintf("audio_%d", voices), fmt.Sprintf("<Audio %d>", audios), "audio")
		}
	}
	maxPictures := 9
	if withoutKeyframe {
		maxPictures = 8
	}
	if pictures > maxPictures || videos > 3 || voices > 3 {
		return nil, errors.New("H3 参考超过当前工作流的9图、3视频或3独立音频上限")
	}
	return result, nil
}
