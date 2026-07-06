package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/task-management/task/internal/application/service"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
)

// dueDateLayouts lists the date/time formats accepted from the client.
// The date picker may send a full ISO 8601 timestamp or a date-only string.
var dueDateLayouts = []string{
	time.RFC3339,
	"2006-01-02T15:04:05",
	"2006-01-02 15:04:05",
	"2006-01-02",
}

// parseDueDate parses a date string into *time.Time, trying each supported layout.
// Returns (nil, nil) for an empty string so callers can leave the field unchanged.
func parseDueDate(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}
	var lastErr error
	for _, layout := range dueDateLayouts {
		if t, err := time.Parse(layout, s); err == nil {
			return &t, nil
		} else {
			lastErr = err
		}
	}
	return nil, lastErr
}

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
	Status      string       `json:"status" binding:"omitempty,oneof=draft pending running completed"`
	Priority    string       `json:"priority" binding:"omitempty,oneof=low medium high"`
	TaskListID  string       `json:"task_list_id" binding:"omitempty,len=24,alpha"`
	DueDate     *string      `json:"due_date"` // ISO 8601 date string
	Links       []types.TaskLinkInput `json:"links" binding:"omitempty,dive"`
}

// UpdateTaskRequest represents the update task request body
type UpdateTaskRequest struct {
	Title       *string  `json:"title" binding:"omitempty,min=1,max=255"`
	Description *string  `json:"description" binding:"omitempty,max=5000"`
	Status      *string  `json:"status" binding:"omitempty,oneof=draft pending running completed"`
	Priority    *string  `json:"priority" binding:"omitempty,oneof=low medium high"`
	TaskListID  *string  `json:"task_list_id" binding:"omitempty,len=24,alpha"`
	DueDate     *string  `json:"due_date"`
	// Links 为 null 表示不修改；空数组表示清空；非空表示整体替换
	Links *[]types.TaskLinkInput `json:"links" binding:"omitempty,dive"`
}

// UpdateTaskStatusRequest represents the update task status request body
type UpdateTaskStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=draft pending running completed"`
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
		TaskListID:  req.TaskListID,
		Links:       req.Links,
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
	if req.DueDate != nil {
		dueDate, err := parseDueDate(*req.DueDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Invalid due_date: " + err.Error(),
			})
			return
		}
		createReq.DueDate = dueDate
	}

	resp, err := h.taskService.CreateTask(c.Request.Context(), createReq)
	if err != nil {
		if err == service.ErrTaskListNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "指定的任务清单不存在",
			})
			return
		}
		if err == service.ErrLinkTargetTaskNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "链接的目标任务不存在",
			})
			return
		}
		if err == service.ErrInvalidTaskLink {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "链接格式不正确",
			})
			return
		}
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
// @Param creator_id query string false "Filter by creator ID"
// @Param priority query string false "Filter by priority"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/tasks [get]
func (h *TaskHandler) ListTasks(c *gin.Context) {
	req := &types.ListTasksRequest{}

	// Parse query parameters
	if statuses := c.QueryArray("status"); len(statuses) > 0 {
		for _, s := range statuses {
			req.Status = append(req.Status, types.TaskStatus(s))
		}
	}
	if creatorID := c.Query("creator_id"); creatorID != "" {
		req.CreatorID = &creatorID
	}
	if taskListIDs := c.QueryArray("task_list_id"); len(taskListIDs) > 0 {
		req.TaskListID = taskListIDs
	}
	if priorities := c.QueryArray("priority"); len(priorities) > 0 {
		for _, p := range priorities {
			req.Priority = append(req.Priority, types.TaskPriority(p))
		}
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
		TaskListID:  req.TaskListID,
		Links:       req.Links,
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
		dueDate, err := parseDueDate(*req.DueDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Invalid due_date: " + err.Error(),
			})
			return
		}
		updateReq.DueDate = dueDate
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
		if err == service.ErrTaskListNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "指定的任务清单不存在",
			})
			return
		}
		if err == service.ErrLinkTargetTaskNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "链接的目标任务不存在",
			})
			return
		}
		if err == service.ErrInvalidTaskLink {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "链接格式不正确",
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
