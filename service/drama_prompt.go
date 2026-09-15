package service

import (
	"fmt"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
)

// CompileDramaPromptWithMapping replaces Infinite Canvas reference labels only
// after media probing has established the exact provider tags.
func CompileDramaPromptWithMapping(prompt string, mapping []model.DramaRunInputMapping) string {
	result := prompt
	pictures, videos, audios := 0, 0, 0
	for _, item := range mapping {
		label := ""
		switch item.Kind {
		case "image":
			pictures++
			label = fmt.Sprintf("图片%d", pictures)
		case "video":
			videos++
			label = fmt.Sprintf("视频%d", videos)
		case "audio":
			audios++
			label = fmt.Sprintf("音频%d", audios)
		}
		if label != "" {
			result = strings.ReplaceAll(result, label, item.Tag)
		}
	}
	return result
}
