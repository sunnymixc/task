package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/task-management/task/internal/config"
)

const (
	terminalWriteWait  = 10 * time.Second
	terminalPongWait   = 60 * time.Second
	terminalPingPeriod = (terminalPongWait * 9) / 10
	terminalReadLimit  = 1 << 20 // 1MB/消息，容纳大段粘贴
)

// terminalControlMsg 是浏览器通过 TextMessage 发来的控制帧（resize / terminate）。
// 键盘输入走 BinaryMessage，与控制帧分离，避免歧义。
type terminalControlMsg struct {
	Type string `json:"type"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

// TerminalHandler 提供 PTY over WebSocket 的 AI 终端。
// 安全性依赖路由层的 RequireAdmin 网关 + 下方的同源校验：终端等于远程 root。
type TerminalHandler struct {
	cfg *config.Config
}

func NewTerminalHandler(cfg *config.Config) *TerminalHandler {
	return &TerminalHandler{cfg: cfg}
}

// defaultShellFor 按服务器操作系统选择默认 shell。
// macOS 默认 zsh —— oh-my-zsh 是 zsh 的配置框架,交互式 zsh 启动时经 ~/.zshrc 自动加载;
// 找不到 zsh 时回退 bash。其余系统默认 bash。
func defaultShellFor(goos string) string {
	if goos == "darwin" {
		if _, err := exec.LookPath("zsh"); err == nil {
			return "zsh"
		}
	}
	return "bash"
}

// resolveWorkDir 决定 PTY 的初始工作目录，返回 (目录, 是否因目录无效回退主目录)。
// cwdParam 为空（未传参）时沿用配置的 WorkDir（旧行为）；否则展开开头的 ~ 为主目录，
// 目录有效则使用，不存在/无效则回退主目录 —— 对应「清单项目路径为空时进入 ~」的产品语义
// （前端在路径为空时显式传 ~）。
func resolveWorkDir(cwdParam, cfgWorkDir string) (string, bool) {
	if cwdParam == "" {
		return cfgWorkDir, false
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return cfgWorkDir, false
	}
	dir := cwdParam
	if dir == "~" {
		dir = home
	} else if strings.HasPrefix(dir, "~/") {
		dir = filepath.Join(home, dir[2:])
	}
	if info, err := os.Stat(dir); err == nil && info.IsDir() {
		return dir, false
	}
	return home, true
}

// checkTerminalOrigin 收敛 WS 来源：同源、本地开发、以及可信生产域名。
// CORS 的 Allow-Origin:* 不作用于 WebSocket，必须在此显式判断。
func checkTerminalOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true // 非浏览器客户端（无 Origin）
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	if strings.EqualFold(u.Host, r.Host) {
		return true // 同源
	}
	switch u.Hostname() {
	case "localhost", "127.0.0.1", "::1":
		return true // 开发环境：vite 代理使 Origin(:5000) 与后端 Host(:5001) 不同源
	case "task.sunnymix.com", "task-dev.sunnymix.com":
		return true // 可信生产域名
	}
	return false
}

// HandleWS 升级连接、启动 PTY，并在 PTY↔WS 之间双向转发。
func (h *TerminalHandler) HandleWS(c *gin.Context) {
	if h.cfg.Terminal != nil && !h.cfg.Terminal.Enabled {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "终端功能已禁用"})
		return
	}

	// token 通过 Sec-WebSocket-Protocol 传入,这里回显客户端子协议以完成协商
	// (部分 WS 客户端在服务端不选择子协议时会判定握手失败)。
	upgrader := websocket.Upgrader{
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
		CheckOrigin:     checkTerminalOrigin,
		Subprotocols:    websocket.Subprotocols(c.Request),
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		// Upgrade 失败时已写入响应
		log.Printf("[terminal] upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	shell := defaultShellFor(runtime.GOOS)
	cfgWorkDir := ""
	if h.cfg.Terminal != nil {
		if h.cfg.Terminal.Shell != "" {
			shell = h.cfg.Terminal.Shell
		}
		cfgWorkDir = h.cfg.Terminal.WorkDir
	}
	// cwd 由前端传入（任务所属清单的项目路径，空则 ~）；优先于配置的 WorkDir
	cwdParam := c.Query("cwd")
	workDir, cwdFellBack := resolveWorkDir(cwdParam, cfgWorkDir)

	// pty.Start 会为子进程设置 Setsid+Setctty（成为会话/进程组首进程），
	// 因此后续可用 Kill(-pid) 回收整组。WorkDir 为空时继承服务器进程的 cwd（项目根目录）。
	cmd := exec.Command(shell)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	if workDir != "" {
		cmd.Dir = workDir
	}

	ptmx, err := pty.Start(cmd)
	if err != nil {
		log.Printf("[terminal] pty start failed: %v", err)
		_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\n无法启动终端: "+err.Error()+"\r\n"))
		return
	}

	userID := c.GetString("user_id")
	pid := cmd.Process.Pid
	log.Printf("[terminal] session started user=%s pid=%d shell=%s workdir=%q", userID, pid, shell, workDir)
	if cwdFellBack {
		_ = conn.WriteMessage(websocket.BinaryMessage, []byte("\x1b[33m[项目路径 "+cwdParam+" 不存在，已进入主目录]\x1b[0m\r\n"))
	}

	// 统一收尾：杀掉整个进程组、关闭 pty、关闭连接。任一方向出错都触发，且只执行一次。
	var closeOnce sync.Once
	cleanup := func() {
		closeOnce.Do(func() {
			_ = ptmx.Close() // 给子进程发 SIGHUP
			if cmd.Process != nil {
				_ = syscall.Kill(-pid, syscall.SIGKILL) // 补刀整个进程组，防止 root 进程泄漏
				_ = cmd.Process.Kill()
			}
			_ = conn.Close()
			_ = cmd.Wait()
			log.Printf("[terminal] session closed user=%s pid=%d", userID, pid)
		})
	}
	defer cleanup()

	// 保活：读超时 + pong 刷新（配合 ping goroutine），使 http.Server 的 60s 超时对长连不构成问题。
	conn.SetReadLimit(terminalReadLimit)
	_ = conn.SetReadDeadline(time.Now().Add(terminalPongWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(terminalPongWait))
	})

	// ping goroutine 与 PTY→WS goroutine 都会写 conn，需串行化并逐消息设置写超时。
	var writeMu sync.Mutex
	writeToConn := func(mt int, data []byte) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		_ = conn.SetWriteDeadline(time.Now().Add(terminalWriteWait))
		return conn.WriteMessage(mt, data)
	}

	// ping 心跳
	go func() {
		ticker := time.NewTicker(terminalPingPeriod)
		defer ticker.Stop()
		for range ticker.C {
			if err := writeToConn(websocket.PingMessage, nil); err != nil {
				cleanup()
				return
			}
		}
	}()

	// PTY → WS：shell 输出以二进制帧下发
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				if werr := writeToConn(websocket.BinaryMessage, buf[:n]); werr != nil {
					cleanup()
					return
				}
			}
			if err != nil {
				// shell 退出或 pty 关闭
				cleanup()
				return
			}
		}
	}()

	// WS → PTY：文本帧=控制消息(JSON)，二进制帧=键盘输入
	for {
		mt, data, err := conn.ReadMessage()
		if err != nil {
			cleanup()
			return
		}
		switch mt {
		case websocket.TextMessage:
			var ctrl terminalControlMsg
			if err := json.Unmarshal(data, &ctrl); err != nil {
				continue // 非法控制帧，忽略
			}
			switch ctrl.Type {
			case "resize":
				if ctrl.Cols > 0 && ctrl.Rows > 0 {
					_ = pty.Setsize(ptmx, &pty.Winsize{Cols: ctrl.Cols, Rows: ctrl.Rows})
				}
			case "terminate":
				cleanup()
				return
			}
		case websocket.BinaryMessage:
			if _, werr := ptmx.Write(data); werr != nil {
				cleanup()
				return
			}
		}
	}
}
