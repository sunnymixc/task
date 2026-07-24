package handler

import (
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
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

func TestShellArgsFor(t *testing.T) {
	tests := []struct {
		name  string
		goos  string
		shell string
		want  []string
	}{
		{"darwin zsh", "darwin", "zsh", []string{"-il"}},
		{"darwin bash", "darwin", "bash", []string{"-il"}},
		{"darwin zsh 绝对路径", "darwin", "/bin/zsh", []string{"-il"}},
		{"darwin bash 绝对路径", "darwin", "/opt/homebrew/bin/bash", []string{"-il"}},
		{"darwin 自定义 shell 不加参数", "darwin", "fish", nil},
		{"linux zsh 不加参数", "linux", "zsh", nil},
		{"linux bash 不加参数", "linux", "bash", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shellArgsFor(tt.goos, tt.shell); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("shellArgsFor(%q, %q) = %v, want %v", tt.goos, tt.shell, got, tt.want)
			}
		})
	}
}

func TestInitialCdInput(t *testing.T) {
	tests := []struct {
		name    string
		goos    string
		workDir string
		want    string
	}{
		{"darwin 普通路径", "darwin", "/Users/me/code/app", " cd '/Users/me/code/app'\r"},
		{"darwin 含空格路径", "darwin", "/Users/me/My Project", " cd '/Users/me/My Project'\r"},
		{"darwin 含单引号路径", "darwin", "/Users/me/it's", ` cd '/Users/me/it'\''s'` + "\r"},
		{"darwin 空目录不注入", "darwin", "", ""},
		{"linux 不注入", "linux", "/root/code/task", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := string(initialCdInput(tt.goos, tt.workDir)); got != tt.want {
				t.Errorf("initialCdInput(%q, %q) = %q, want %q", tt.goos, tt.workDir, got, tt.want)
			}
		})
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
