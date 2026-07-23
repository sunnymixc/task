package handler

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestDefaultShellFor(t *testing.T) {
	if got := defaultShellFor("linux"); got != "bash" {
		t.Errorf("defaultShellFor(linux) = %q, want bash", got)
	}
	if got := defaultShellFor("windows"); got != "bash" {
		t.Errorf("defaultShellFor(windows) = %q, want bash", got)
	}

	// darwin 分支依赖本机是否有 zsh:有则选 zsh,没有则回退 bash
	want := "bash"
	if _, err := exec.LookPath("zsh"); err == nil {
		want = "zsh"
	}
	if got := defaultShellFor("darwin"); got != want {
		t.Errorf("defaultShellFor(darwin) = %q, want %q", got, want)
	}
}

func TestResolveWorkDir(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skipf("no home dir: %v", err)
	}
	tmp := t.TempDir()

	tests := []struct {
		name         string
		cwdParam     string
		cfgWorkDir   string
		wantDir      string
		wantFellBack bool
	}{
		{"未传参沿用配置", "", "/some/cfg", "/some/cfg", false},
		{"未传参且无配置", "", "", "", false},
		{"波浪号展开为主目录", "~", "/some/cfg", home, false},
		{"波浪号前缀展开", "~/", "/some/cfg", home, false},
		{"有效目录直接使用", tmp, "/some/cfg", tmp, false},
		{"不存在的目录回退主目录", filepath.Join(tmp, "no-such-dir"), "/some/cfg", home, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, fellBack := resolveWorkDir(tt.cwdParam, tt.cfgWorkDir)
			if got != tt.wantDir || fellBack != tt.wantFellBack {
				t.Errorf("resolveWorkDir(%q, %q) = (%q, %v), want (%q, %v)",
					tt.cwdParam, tt.cfgWorkDir, got, fellBack, tt.wantDir, tt.wantFellBack)
			}
		})
	}
}
