package handler

import (
	"os/exec"
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
