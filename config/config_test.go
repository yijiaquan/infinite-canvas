package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNormalizeDockerSQLiteDSNUsesMountedDataDir(t *testing.T) {
	root := t.TempDir()
	appDataDir := filepath.Join(root, "data")
	if err := os.MkdirAll(appDataDir, 0755); err != nil {
		t.Fatal(err)
	}
	Cfg = Config{StorageDriver: "sqlite", DatabaseDSN: "data/infinite-canvas.db?_pragma=busy_timeout(5000)"}

	normalizeDockerSQLiteDSN(appDataDir, "linux")

	want := filepath.Join(root, "data", "infinite-canvas.db") + "?_pragma=busy_timeout(5000)"
	if Cfg.DatabaseDSN != want {
		t.Fatalf("DatabaseDSN = %q, want %q", Cfg.DatabaseDSN, want)
	}
}

func TestNormalizeDockerSQLiteDSNLeavesLocalPathWithoutMountedDataDir(t *testing.T) {
	Cfg = Config{StorageDriver: "sqlite", DatabaseDSN: "data/infinite-canvas.db"}

	normalizeDockerSQLiteDSN(filepath.Join(t.TempDir(), "missing-data"), "linux")

	if Cfg.DatabaseDSN != "data/infinite-canvas.db" {
		t.Fatalf("DatabaseDSN = %q, want relative local path", Cfg.DatabaseDSN)
	}
}

func TestNormalizeDockerSQLiteDSNLeavesWindowsDatabaseInProject(t *testing.T) {
	appDataDir := t.TempDir()
	Cfg = Config{StorageDriver: "sqlite", DatabaseDSN: "data/infinite-canvas.db"}
	normalizeDockerSQLiteDSN(appDataDir, "windows")
	if Cfg.DatabaseDSN != "data/infinite-canvas.db" {
		t.Fatalf("Windows database was redirected outside project: %q", Cfg.DatabaseDSN)
	}
}
