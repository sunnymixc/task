package router

import (
	"github.com/gin-gonic/gin"
	"github.com/task-management/task/internal/config"
	"github.com/task-management/task/internal/handler"
	"github.com/task-management/task/internal/middleware"
	"github.com/task-management/task/internal/application/service"
)

// Setup configures and returns the Gin router
func Setup(cfg *config.Config) *gin.Engine {
	// Create services
	userService := service.NewUserService(cfg)
	taskService := service.NewTaskService()

	// Create handlers
	authHandler := handler.NewAuthHandler(userService)
	taskHandler := handler.NewTaskHandler(taskService)

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
			tasks.PUT("/:id", taskHandler.UpdateTask)
			tasks.DELETE("/:id", taskHandler.DeleteTask)
			tasks.PATCH("/:id/status", taskHandler.UpdateTaskStatus)
		}
	}

	return r
}
