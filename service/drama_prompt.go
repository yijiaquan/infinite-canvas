package service

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
)

var dramaImageLabel = regexp.MustCompile(`图片([1-9][0-9]*)`)

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

// CompileDramaPromptWithoutStoryboard keeps legacy source prompts usable when
// a planning-only director board is omitted from the H3 media inputs.
func CompileDramaPromptWithoutStoryboard(prompt string, mapping []model.DramaRunInputMapping) string {
	const board = "the approved director storyboard"
	prompt = dramaImageLabel.ReplaceAllStringFunc(prompt, func(label string) string {
		index, _ := strconv.Atoi(strings.TrimPrefix(label, "图片"))
		if index == 1 {
			return board
		}
		return fmt.Sprintf("图片%d", index-1)
	})
	return CompileDramaPromptWithMapping(prompt, mapping)
}
