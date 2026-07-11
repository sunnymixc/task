package router

import (
	"io/fs"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/task-management/task/internal/application/service"
	"github.com/task-management/task/internal/config"
	"github.com/task-management/task/internal/handler"
	"github.com/task-management/task/internal/middleware"
	"github.com/task-management/task/internal/web"
)

// Setup configures and returns the Gin router
func Setup(cfg *config.Config) *gin.Engine {
	// Create services
	userService := service.NewUserService(cfg)
	taskService := service.NewTaskService()
	taskListService := service.NewTaskListService()

	// Create handlers
	authHandler := handler.NewAuthHandler(userService)
	taskHandler := handler.NewTaskHandler(taskService)
	taskListHandler := handler.NewTaskListHandler(taskListService)

	// Create router
	r := gin.Default()

	// Apply middleware
	r.Use(middleware.CORS())
	r.Use(middleware.Auth(cfg))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	// API v1 routes
	v1 := r.Group("/api/v1")
	{
		// Auth routes
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.GET("/me", authHandler.GetMe)
		}

		// Task routes
		tasks := v1.Group("/tasks")
		{
			tasks.GET("", taskHandler.ListTasks)
			tasks.POST("", taskHandler.CreateTask)
			tasks.GET("/search", taskHandler.SearchTasks)
			tasks.GET("/:id", taskHandler.GetTask)
			tasks.GET("/:id/logs", taskHandler.ListTaskLogs)
			tasks.PUT("/:id", taskHandler.UpdateTask)
			tasks.DELETE("/:id", taskHandler.DeleteTask)
			tasks.PATCH("/:id/status", taskHandler.UpdateTaskStatus)
		}

		// Task list routes
		taskLists := v1.Group("/task-lists")
		{
			taskLists.GET("", taskListHandler.ListTaskLists)
			taskLists.POST("", taskListHandler.CreateTaskList)
			taskLists.GET("/:id", taskListHandler.GetTaskList)
			taskLists.PUT("/:id", taskListHandler.UpdateTaskList)
			taskLists.DELETE("/:id", taskListHandler.DeleteTaskList)
		}
	}

	setupFrontend(r)

	return r
}

// setupFrontend 提供内嵌的前端静态资源(deploy.sh 构建时同步进 internal/web/dist),
// 未内嵌前端时(dev 构建)非 API 路由保持 404
func setupFrontend(r *gin.Engine) {
	dist, ok := web.Dist()
	if !ok {
		log.Println("[WARN] no embedded frontend (dev build); non-API routes return 404")
		return
	}

	indexHTML, err := fs.ReadFile(dist, "index.html")
	if err != nil {
		log.Printf("[WARN] failed to read embedded index.html: %v", err)
		return
	}
	fileServer := http.FileServer(http.FS(dist))

	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api") {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "not found"})
			return
		}
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.Status(http.StatusNotFound)
			return
		}

		// 真实静态文件由 FileServer 提供(MIME 按扩展名);
		// "/" 和 "/index.html" 不能走 FileServer,否则会 301 重定向循环
		file := strings.TrimPrefix(path, "/")
		if file != "" && file != "index.html" {
			if info, err := fs.Stat(dist, file); err == nil && !info.IsDir() {
				if strings.HasPrefix(path, "/assets/") {
					// Vite 产物带内容 hash,可长期缓存
					c.Header("Cache-Control", "public, max-age=31536000, immutable")
				}
				fileServer.ServeHTTP(c.Writer, c.Request)
				return
			}
		}

		// SPA 回退:客户端路由(/login、/tasks 等)统一返回 index.html
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexHTML)
	})
}
