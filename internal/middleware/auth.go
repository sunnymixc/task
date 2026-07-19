package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/task-management/task/internal/application/service"
	"github.com/task-management/task/internal/config"
)

// JWTClaims represents JWT claims
type JWTClaims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	TenantID uint64 `json:"tenant_id"`
	jwt.RegisteredClaims
}

// noAuthAPI is a list of API endpoints that don't require authentication
var noAuthAPI = map[string][]string{
	"/health":                 {"GET"},
	"/api/v1/auth/register":   {"POST"},
	"/api/v1/auth/login":      {"POST"},
	"/api/v1/auth/refresh":    {"POST"},
}

// isNoAuthAPI checks if the request is for a no-auth API
func isNoAuthAPI(path string, method string) bool {
	for api, methods := range noAuthAPI {
		if strings.HasPrefix(path, api) && contains(methods, method) {
			return true
		}
	}
	return false
}

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// Auth creates a JWT authentication middleware
func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip OPTIONS requests
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		// 非 API 路径(静态资源、SPA 路由)不需要鉴权
		if !strings.HasPrefix(c.Request.URL.Path, "/api") {
			c.Next()
			return
		}

		// Check if this is a no-auth API
		if isNoAuthAPI(c.Request.URL.Path, c.Request.Method) {
			c.Next()
			return
		}

		// Extract the JWT. Normal requests carry it in the Authorization header;
		// WebSocket handshakes can't set headers from the browser, so fall back to
		// the Sec-WebSocket-Protocol subprotocol / ?token= query for upgrade requests.
		tokenString := extractBearerToken(c.GetHeader("Authorization"))
		if tokenString == "" && isWebSocketUpgrade(c.Request) {
			tokenString = extractWSToken(c)
		}
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Authorization header is required",
			})
			c.Abort()
			return
		}

		// Parse and validate token
		claims, err := parseToken(tokenString, cfg.Auth.JWTSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// Set user info in context
		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("tenant_id", claims.TenantID)

		// Update context with user ID for service layer
		c.Request = c.Request.WithContext(service.SetContextUserID(c.Request.Context(), claims.UserID))

		c.Next()
	}
}

// extractBearerToken returns the token from an "Authorization: Bearer <token>" header, or "".
func extractBearerToken(authHeader string) string {
	if authHeader == "" {
		return ""
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		return ""
	}
	return parts[1]
}

// isWebSocketUpgrade reports whether the request is a WebSocket handshake.
func isWebSocketUpgrade(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("Upgrade"), "websocket")
}

// extractWSToken reads the JWT for a WebSocket handshake. The browser WebSocket API
// can't set an Authorization header, so the token arrives via the Sec-WebSocket-Protocol
// subprotocol (preferred — kept out of access logs) or the ?token= query (fallback).
func extractWSToken(c *gin.Context) string {
	if proto := c.GetHeader("Sec-WebSocket-Protocol"); proto != "" {
		if first := strings.TrimSpace(strings.Split(proto, ",")[0]); first != "" {
			return first
		}
	}
	return c.Query("token")
}

// parseToken parses and validates a JWT token
func parseToken(tokenString, secret string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token claims")
}

// RequireTenant checks if tenant_id is set in context
func RequireTenant() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, exists := c.Get("tenant_id")
		if !exists || tenantID == nil {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "Tenant context required",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// CORS creates a CORS middleware
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
		c.Header("Access-Control-Expose-Headers", "Content-Length")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
