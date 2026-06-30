package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/task-management/task/internal/application/service"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
)

// TaskHandler handles task requests
type TaskHandler struct {
	taskService interfaces.TaskService
}

// NewTaskHandler creates a new task handler
func NewTaskHandler(taskService interfaces.TaskService) *TaskHandler {
	return &TaskHandler{
		taskService: taskService,
	}
}

// CreateTaskRequest represents the create task request body
type CreateTaskRequest struct {
	Title       string       `json:"title" binding:"required,min=1,max=255"`
	Description string       `json:"description" binding:"max=5000"`
	Status      string       `json:"status" binding:"omitempty,oneof=draft published in_progress completed ended"`
	Priority    string       `json:"priority" binding:"omitempty,oneof=low medium high"`
	AssigneeID  *string      `json:"assignee_id" binding:"omitempty,uuid"`
	DueDate     *string      `json:"due_date"` // ISO 8601 date string
}

// UpdateTaskRequest represents the update task request body
type UpdateTaskRequest struct {
	Title       *string  `json:"title" binding:"omitempty,min=1,max=255"`
	Description *string  `json:"description" binding:"omitempty,max=5000"`
	Status      *string  `json:"status" binding:"omitempty,oneof=draft published in_progress completed ended"`
	Priority    *string  `json:"priority" binding:"omitempty,oneof=low medium high"`
	AssigneeID  *string  `json:"assignee_id" binding:"omitempty,uuid"`
	DueDate     *string  `json:"due_date"`
}

// UpdateTaskStatusRequest represents the update task status request body
type UpdateTaskStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=draft published in_progress completed ended"`
}

// CreateTask creates a new task
// @Summary Create a task
// @Description Create a new task for the current user's tenant
// @Tags tasks
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body CreateTaskRequest true "Task details"
// @Success 201 {object} types.TaskResponse
// @Failure 400 {object} map[string]string
// @Router /api/v1/tasks [post]
func (h *TaskHandler) CreateTask(c *gin.Context) {
	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	createReq := &types.CreateTaskRequest{
		Title:       req.Title,
		Description: req.Description,
		AssigneeID:  req.AssigneeID,
	}

	// Parse priority
	if req.Priority != "" {
		createReq.Priority = types.TaskPriority(req.Priority)
	}

	// Parse status
	if req.Status != "" {
		createReq.Status = types.TaskStatus(req.Status)
	}

	// Parse due date if provided
	if req.DueDate != nil && *req.DueDate != "" {
		// TODO: Parse ISO 8601 date string
		// For simplicity, we're skipping this for now
	}

	resp, err := h.taskService.CreateTask(c.Request.Context(), createReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create task: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// GetTask retrieves a task by ID
// @Summary Get a task
// @Description Get a task by ID
// @Tags tasks
// @Produce json
// @Security Bearer
// @Param id path string true "Task ID"
// @Success 200 {object} types.TaskResponse
// @Failure 404 {object} map[string]string
// @Router /api/v1/tasks/{id} [get]
func (h *TaskHandler) GetTask(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Task ID is required",
		})
		return
	}

	resp, err := h.taskService.GetTaskByID(c.Request.Context(), id)
	if err != nil {
		if err == service.ErrTaskNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Task not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to get task: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ListTasks lists tasks with pagination and filters
// @Summary List tasks
// @Description List tasks for the current user's tenant
// @Tags tasks
// @Produce json
// @Security Bearer
// @Param status query string false "Filter by status"
// @Param assignee_id query string false "Filter by assignee ID"
// @Param creator_id query string false "Filter by creator ID"
// @Param priority query string false "Filter by priority"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/tasks [get]
func (h *TaskHandler) ListTasks(c *gin.Context) {
	req := &types.ListTasksRequest{}

	// Parse query parameters
	if status := c.Query("status"); status != "" {
		s := types.TaskStatus(status)
		req.Status = &s
	}
	if assigneeID := c.Query("assignee_id"); assigneeID != "" {
		req.AssigneeID = &assigneeID
	}
	if creatorID := c.Query("creator_id"); creatorID != "" {
		req.CreatorID = &creatorID
	}
	if priority := c.Query("priority"); priority != "" {
		p := types.TaskPriority(priority)
		req.Priority = &p
	}

	// Parse pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	req.Page = page
	req.PageSize = pageSize

	tasks, total, err := h.taskService.ListTasks(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to list tasks: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    tasks,
		"total":   total,
		"page":    page,
		"page_size": pageSize,
	})
}

// UpdateTask updates a task
// @Summary Update a task
// @Description Update a task by ID
// @Tags tasks
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path string true "Task ID"
// @Param request body UpdateTaskRequest true "Task updates"
// @Success 200 {object} types.TaskResponse
// @Failure 400 {object} map[string]string
// @Router /api/v1/tasks/{id} [put]
func (h *TaskHandler) UpdateTask(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Task ID is required",
		})
		return
	}

	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	updateReq := &types.UpdateTaskRequest{
		Title:       req.Title,
		Description: req.Description,
		AssigneeID:  req.AssigneeID,
	}

	// Parse status if provided
	if req.Status != nil {
		s := types.TaskStatus(*req.Status)
		updateReq.Status = &s
	}

	// Parse priority if provided
	if req.Priority != nil {
		p := types.TaskPriority(*req.Priority)
		updateReq.Priority = &p
	}

	// Parse due date if provided
	if req.DueDate != nil {
		// TODO: Parse ISO 8601 date string
		// For simplicity, we're skipping this for now
	}

	resp, err := h.taskService.UpdateTask(c.Request.Context(), id, updateReq)
	if err != nil {
		if err == service.ErrTaskNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Task not found",
			})
			return
		}
		if err == service.ErrInvalidStatusTransition {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to update task: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// DeleteTask deletes a task
// @Summary Delete a task
// @Description Delete a task by ID
// @Tags tasks
// @Produce json
// @Security Bearer
// @Param id path string true "Task ID"
// @Success 204
// @Failure 404 {object} map[string]string
// @Router /api/v1/tasks/{id} [delete]
func (h *TaskHandler) DeleteTask(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Task ID is required",
		})
		return
	}

	err := h.taskService.DeleteTask(c.Request.Context(), id)
	if err != nil {
		if err == service.ErrTaskNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Task not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to delete task: " + err.Error(),
		})
		return
	}

	c.Status(http.StatusNoContent)
}

// UpdateTaskStatus updates a task's status
// @Summary Update task status
// @Description Update a task's status with validation
// @Tags tasks
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path string true "Task ID"
// @Param request body UpdateTaskStatusRequest true "New status"
// @Success 200 {object} types.TaskResponse
// @Failure 400 {object} map[string]string
// @Router /api/v1/tasks/{id}/status [patch]
func (h *TaskHandler) UpdateTaskStatus(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Task ID is required",
		})
		return
	}

	var req UpdateTaskStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	resp, err := h.taskService.UpdateTaskStatus(c.Request.Context(), id, types.TaskStatus(req.Status))
	if err != nil {
		if err == service.ErrTaskNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Task not found",
			})
			return
		}
		if err == service.ErrInvalidStatusTransition {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to update task status: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// SearchTasks searches tasks by query
// @Summary Search tasks
// @Description Search tasks by title or description
// @Tags tasks
// @Produce json
// @Security Bearer
// @Param q query string true "Search query"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/tasks/search [get]
func (h *TaskHandler) SearchTasks(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Search query is required",
		})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	req := &types.SearchTasksRequest{
		Query:    query,
		Page:     page,
		PageSize: pageSize,
	}

	tasks, total, err := h.taskService.SearchTasks(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to search tasks: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    tasks,
		"total":   total,
		"page":    page,
		"page_size": pageSize,
		"query":   query,
	})
}
