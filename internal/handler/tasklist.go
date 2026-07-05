package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/task-management/task/internal/application/service"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
)

// TaskListHandler handles task list requests
type TaskListHandler struct {
	taskListService interfaces.TaskListService
}

// NewTaskListHandler creates a new task list handler
func NewTaskListHandler(taskListService interfaces.TaskListService) *TaskListHandler {
	return &TaskListHandler{
		taskListService: taskListService,
	}
}

// CreateTaskListRequest represents the create task list request body
type CreateTaskListRequest struct {
	Title       string `json:"title" binding:"required,min=1,max=255"`
	Description string `json:"description" binding:"max=5000"`
}

// UpdateTaskListRequest represents the update task list request body
type UpdateTaskListRequest struct {
	Title       *string `json:"title" binding:"omitempty,min=1,max=255"`
	Description *string `json:"description" binding:"omitempty,max=5000"`
}

// CreateTaskList creates a new task list
// @Summary Create a task list
// @Description Create a new task list for the current user's tenant
// @Tags task-lists
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body CreateTaskListRequest true "Task list details"
// @Success 201 {object} types.TaskListDetailResponse
// @Failure 400 {object} map[string]string
// @Router /api/v1/task-lists [post]
func (h *TaskListHandler) CreateTaskList(c *gin.Context) {
	var req CreateTaskListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	createReq := &types.CreateTaskListRequest{
		Title:       req.Title,
		Description: req.Description,
	}

	resp, err := h.taskListService.CreateTaskList(c.Request.Context(), createReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create task list: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// GetTaskList retrieves a task list by ID
// @Summary Get a task list
// @Description Get a task list by ID
// @Tags task-lists
// @Produce json
// @Security Bearer
// @Param id path string true "Task list ID"
// @Success 200 {object} types.TaskListDetailResponse
// @Failure 404 {object} map[string]string
// @Router /api/v1/task-lists/{id} [get]
func (h *TaskListHandler) GetTaskList(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Task list ID is required",
		})
		return
	}

	resp, err := h.taskListService.GetTaskListByID(c.Request.Context(), id)
	if err != nil {
		if err == service.ErrTaskListNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Task list not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to get task list: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ListTaskLists lists task lists with pagination
// @Summary List task lists
// @Description List task lists for the current user's tenant
// @Tags task-lists
// @Produce json
// @Security Bearer
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/task-lists [get]
func (h *TaskListHandler) ListTaskLists(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	req := &types.ListTaskListsRequest{
		Page:     page,
		PageSize: pageSize,
	}

	lists, total, err := h.taskListService.ListTaskLists(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to list task lists: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"data":      lists,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// UpdateTaskList updates a task list
// @Summary Update a task list
// @Description Update a task list by ID
// @Tags task-lists
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path string true "Task list ID"
// @Param request body UpdateTaskListRequest true "Task list updates"
// @Success 200 {object} types.TaskListDetailResponse
// @Failure 400 {object} map[string]string
// @Router /api/v1/task-lists/{id} [put]
func (h *TaskListHandler) UpdateTaskList(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Task list ID is required",
		})
		return
	}

	var req UpdateTaskListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	updateReq := &types.UpdateTaskListRequest{
		Title:       req.Title,
		Description: req.Description,
	}

	resp, err := h.taskListService.UpdateTaskList(c.Request.Context(), id, updateReq)
	if err != nil {
		if err == service.ErrTaskListNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Task list not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to update task list: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// DeleteTaskList deletes a task list
// @Summary Delete a task list
// @Description Delete a task list by ID; its tasks are moved to the default list
// @Tags task-lists
// @Produce json
// @Security Bearer
// @Param id path string true "Task list ID"
// @Success 204
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/task-lists/{id} [delete]
func (h *TaskListHandler) DeleteTaskList(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Task list ID is required",
		})
		return
	}

	err := h.taskListService.DeleteTaskList(c.Request.Context(), id)
	if err != nil {
		if err == service.ErrTaskListNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Task list not found",
			})
			return
		}
		if err == service.ErrCannotDeleteDefaultList {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "默认清单不能删除",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to delete task list: " + err.Error(),
		})
		return
	}

	c.Status(http.StatusNoContent)
}
