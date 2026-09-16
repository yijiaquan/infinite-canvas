package model

import (
	"regexp"
	"strings"
)

var dramaDialogueSpeakerPrefix = regexp.MustCompile(`^[\t ]*([^\t \r\n:：]{1,64})[\t ]*[:：]`)

// DramaShotDialogueSpeakers returns the actual speakers of a Shot. Explicit
// role labels in dialogue take precedence over the legacy single Speaker field.
func DramaShotDialogueSpeakers(shot DramaShot) []string {
	if strings.TrimSpace(shot.Dialogue) == "" {
		return nil
	}
	seen := map[string]bool{}
	result := []string{}
	for _, line := range strings.Split(strings.ReplaceAll(shot.Dialogue, "\r\n", "\n"), "\n") {
		match := dramaDialogueSpeakerPrefix.FindStringSubmatch(line)
		if len(match) != 2 || strings.TrimSpace(strings.TrimPrefix(line, match[0])) == "" {
			continue
		}
		speaker := strings.Trim(strings.TrimSpace(match[1]), "【】[]")
		if speaker != "" && !seen[speaker] {
			seen[speaker] = true
			result = append(result, speaker)
		}
	}
	if len(result) > 0 {
		return result
	}
	if speaker := strings.TrimSpace(shot.Speaker); speaker != "" {
		return []string{speaker}
	}
	return nil
}

func DramaClipDialogueSpeakers(shots []DramaShot) map[string]bool {
	result := map[string]bool{}
	for _, shot := range shots {
		for _, speaker := range DramaShotDialogueSpeakers(shot) {
			result[speaker] = true
		}
	}
	return result
}
