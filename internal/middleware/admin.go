package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/task-management/task/internal/types/interfaces"
)

// RequireAdmin ensures the authenticated user is a global administrator.
// 实时查库而非依赖 JWT claim，保证提升/撤销权限即刻生效
func RequireAdmin(userService interfaces.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Unauthorized",
			})
			c.Abort()
			return
		}

		user, err := userService.GetUserByID(c.Request.Context(), userID)
		if err != nil || user == nil || !user.IsAdmin {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "需要管理员权限",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
