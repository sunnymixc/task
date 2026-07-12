package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
)

// SettingsHandler handles system settings requests
type SettingsHandler struct {
	settingsService interfaces.SettingsService
}

// NewSettingsHandler creates a new settings handler
func NewSettingsHandler(settingsService interfaces.SettingsService) *SettingsHandler {
	return &SettingsHandler{
		settingsService: settingsService,
	}
}

// GetSettings returns the system settings
// @Summary Get system settings
// @Description Get the global system settings (any authenticated user)
// @Tags settings
// @Produce json
// @Security Bearer
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/settings [get]
func (h *SettingsHandler) GetSettings(c *gin.Context) {
	data, err := h.settingsService.GetSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to get settings: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

// UpdateSettings updates the system settings (admin only, enforced by middleware)
// @Summary Update system settings
// @Description Update the global system settings (administrators only)
// @Tags settings
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body types.UpdateSystemSettingsRequest true "Settings fields to update"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Router /api/v1/settings [put]
func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	var req types.UpdateSystemSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	data, err := h.settingsService.UpdateSettings(c.Request.Context(), c.GetString("user_id"), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to update settings: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}
