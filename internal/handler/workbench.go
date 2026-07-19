package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/task-management/task/internal/application/service"
	"github.com/task-management/task/internal/types/interfaces"
)

// WorkbenchHandler handles task workbench requests
type WorkbenchHandler struct {
	workbenchService interfaces.WorkbenchService
}

// NewWorkbenchHandler creates a new workbench handler
func NewWorkbenchHandler(workbenchService interfaces.WorkbenchService) *WorkbenchHandler {
	return &WorkbenchHandler{
		workbenchService: workbenchService,
	}
}

// AddWorkbenchTaskRequest represents the request to add a task to the workbench
type AddWorkbenchTaskRequest struct {
	TaskID string `json:"task_id" binding:"required"`
}

// ListTasks returns all tasks in the current user's workbench (in add order)
// @Summary List workbench tasks
// @Tags workbench
// @Produce json
// @Security Bearer
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/workbench [get]
func (h *WorkbenchHandler) ListTasks(c *gin.Context) {
	tasks, err := h.workbenchService.ListWorkbenchTasks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to list workbench tasks: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    tasks,
		"total":   len(tasks),
	})
}

// AddTask adds a task to the current user's workbench (idempotent)
// @Summary Add a task to the workbench
// @Tags workbench
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body AddWorkbenchTaskRequest true "Task to add"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/workbench [post]
func (h *WorkbenchHandler) AddTask(c *gin.Context) {
	var req AddWorkbenchTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	task, err := h.workbenchService.AddTask(c.Request.Context(), req.TaskID)
	if err != nil {
		if errors.Is(err, service.ErrTaskNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Task not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to add task to workbench: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    task,
	})
}

// RemoveTask removes a task from the current user's workbench (idempotent)
// @Summary Remove a task from the workbench
// @Tags workbench
// @Produce json
// @Security Bearer
// @Param taskId path string true "Task ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/workbench/{taskId} [delete]
func (h *WorkbenchHandler) RemoveTask(c *gin.Context) {
	if err := h.workbenchService.RemoveTask(c.Request.Context(), c.Param("taskId")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to remove task from workbench: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
	})
}
