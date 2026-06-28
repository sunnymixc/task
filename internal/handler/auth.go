package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/task-management/task/internal/application/service"
	"github.com/task-management/task/internal/types"
)

// AuthHandler handles authentication requests
type AuthHandler struct {
	userService types.UserService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(userService types.UserService) *AuthHandler {
	return &AuthHandler{
		userService: userService,
	}
}

// RegisterRequest represents the registration request body
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=100"`
	Email    string `json:"email" binding:"required,email,max=255"`
	Password string `json:"password" binding:"required,min=6,max=100"`
}

// LoginRequest represents the login request body
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// RefreshTokenRequest represents the refresh token request body
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// Register handles user registration
// @Summary Register a new user
// @Description Create a new user account with a home tenant
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "Registration details"
// @Success 200 {object} types.LoginResponse
// @Failure 400 {object} map[string]string
// @Router /api/v1/auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	registerReq := &types.RegisterRequest{
		Username: req.Username,
		Email:    req.Email,
		Password: req.Password,
	}

	resp, err := h.userService.Register(c.Request.Context(), registerReq)
	if err != nil {
		if err == service.ErrUserExists {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"message": "User already exists",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to register: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Login handles user login
// @Summary Login a user
// @Description Authenticate a user and return a JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "Login credentials"
// @Success 200 {object} types.LoginResponse
// @Failure 401 {object} map[string]string
// @Router /api/v1/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	loginReq := &types.LoginRequest{
		Email:    req.Email,
		Password: req.Password,
	}

	resp, err := h.userService.Login(c.Request.Context(), loginReq)
	if err != nil {
		if err == service.ErrInvalidCredentials {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Invalid credentials",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to login: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// RefreshToken handles token refresh
// @Summary Refresh JWT token
// @Description Refresh an expired JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RefreshTokenRequest true "Refresh token"
// @Success 200 {object} types.LoginResponse
// @Failure 401 {object} map[string]string
// @Router /api/v1/auth/refresh [post]
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	resp, err := h.userService.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Invalid token: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetMe returns the current user info
// @Summary Get current user
// @Description Get the currently authenticated user's information
// @Tags auth
// @Produce json
// @Security Bearer
// @Success 200 {object} types.User
// @Failure 401 {object} map[string]string
// @Router /api/v1/auth/me [get]
func (h *AuthHandler) GetMe(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Unauthorized",
		})
		return
	}

	user, err := h.userService.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		if err == service.ErrUserNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "User not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to get user: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, user)
}
