package service

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tigerowo/infinite-canvas/config"
	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

func TestManagedDefaultAgentSkillKeepsProfessionalSkillsAsAttachments(t *testing.T) {
	packages, err := readDefaultAgentSkillPackages()
	if err != nil {
		t.Fatal(err)
	}
	managedCount := 0
	foundArchitecture := false
	for _, item := range packages {
		if strings.HasPrefix(item.Root, "skills/ai-drama-production/references/") {
			t.Fatalf("nested professional Skill became a standalone package: %s", item.Root)
		}
		if item.ID != managedAIDramaProductionSkillID {
			continue
		}
		managedCount++
		for _, file := range item.Files {
			if file.Path == "references/ai-story-architecture/SKILL.md" && file.Kind == model.AgentSkillFileKindFile {
				foundArchitecture = true
			}
		}
	}
	if managedCount != 1 || !foundArchitecture {
		t.Fatalf("invalid managed package tree: packages=%d architecture=%v", managedCount, foundArchitecture)
	}
}

func TestManagedDefaultAgentSkillLifecycle(t *testing.T) {
	if os.Getenv("MANAGED_SKILL_TEST_DATABASE") == "" {
		cmd := exec.Command(os.Args[0], "-test.run=^TestManagedDefaultAgentSkillLifecycle$", "-test.v")
		cmd.Env = append(os.Environ(), "MANAGED_SKILL_TEST_DATABASE="+filepath.Join(t.TempDir(), "skills.db"))
		if output, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v\n%s", err, output)
		}
		return
	}
	config.Cfg.StorageDriver = "sqlite"
	config.Cfg.DatabaseDSN = os.Getenv("MANAGED_SKILL_TEST_DATABASE")
	if err := EnsureDefaultAgentSkills(); err != nil {
		t.Fatal(err)
	}
	item, found, err := repository.GetAgentSkill(managedAIDramaProductionSkillID)
	if err != nil || !found || item.Name != "AI 漫剧完整制作" || !item.Enabled {
		t.Fatalf("managed Skill missing: found=%v err=%v item=%+v", found, err, item)
	}
	files, err := repository.ListAgentSkillFiles(item.ID)
	if err != nil || len(files) < 2 {
		t.Fatalf("managed Skill files missing: %v %d", err, len(files))
	}

	item.Content = "administrator edit"
	item.Enabled = false
	item.Sort = 73
	item.CoverURL = "https://example.test/cover.png"
	item.CoverStorageKey = "cover-key"
	if _, err := repository.SaveAgentSkillPackage(item, files); err != nil {
		t.Fatal(err)
	}
	if err := EnsureDefaultAgentSkills(); err != nil {
		t.Fatal(err)
	}
	item, _, _ = repository.GetAgentSkill(item.ID)
	if item.Content != "administrator edit" {
		t.Fatal("same package version overwrote administrator content")
	}

	packages, err := readDefaultAgentSkillPackages()
	if err != nil {
		t.Fatal(err)
	}
	var upgraded defaultAgentSkillPackage
	for _, candidate := range packages {
		if candidate.ID == managedAIDramaProductionSkillID {
			upgraded = candidate
			break
		}
	}
	upgraded.Version++
	upgraded.Content = "managed v2"
	upgraded.Files = []model.AgentSkillFile{{Path: "references/version.txt", Kind: model.AgentSkillFileKindFile, Content: "v2"}}
	if err := reconcileManagedAgentSkillPackages([]defaultAgentSkillPackage{upgraded}, now()); err != nil {
		t.Fatal(err)
	}
	item, _, _ = repository.GetAgentSkill(item.ID)
	if item.Content != "managed v2" || item.Enabled || item.Sort != 73 || item.CoverURL != "https://example.test/cover.png" || item.CoverStorageKey != "cover-key" {
		t.Fatalf("managed upgrade did not preserve administrator fields: %+v", item)
	}
	files, _ = repository.ListAgentSkillFiles(item.ID)
	if len(files) != 1 || files[0].Path != "references/version.txt" {
		t.Fatalf("managed files were not atomically replaced: %+v", files)
	}

	if err := DeleteSystemAgentSkill(item.ID); err != nil {
		t.Fatal(err)
	}
	if _, found, _ := repository.GetAgentSkill(item.ID); found {
		t.Fatal("managed Skill still exists after administrator deletion")
	}
	state, found, err := repository.GetAgentSkillPackageState(model.SettingKeyAIDramaProductionSkill)
	if err != nil || !found || !state.Deleted || state.Version != upgraded.Version {
		t.Fatalf("invalid deletion marker: found=%v err=%v state=%+v", found, err, state)
	}
	upgraded.Version++
	if err := reconcileManagedAgentSkillPackages([]defaultAgentSkillPackage{upgraded}, now()); err != nil {
		t.Fatal(err)
	}
	if _, found, _ := repository.GetAgentSkill(item.ID); found {
		t.Fatal("deleted managed Skill was restored by a later version")
	}
}
