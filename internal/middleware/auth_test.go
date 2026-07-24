package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/task-management/task/internal/config"
	"github.com/task-management/task/internal/util"
)

const testSecret = "test-secret"

func newTestRouter(t *testing.T) (*gin.Engine, *config.Config) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Auth: &config.AuthConfig{
		JWTSecret:     testSecret,
		JWTExpiration: 60, // minutes
	}}

	r := gin.New()
	r.Use(Auth(cfg))
	r.GET("/api/v1/tasks", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})
	return r, cfg
}

// signToken 直接用指定 iat/exp 签 token,用于构造不同消耗程度的 token
func signToken(t *testing.T, issuedAt, expiresAt time.Time) string {
	t.Helper()
	claims := &util.JWTClaims{
		UserID:   "user-1",
		Email:    "a@b.com",
		TenantID: 7,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(issuedAt),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return token
}

func doRequest(r *gin.Engine, token string, extraHeaders map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/tasks", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestAuthMissingToken(t *testing.T) {
	r, _ := newTestRouter(t)
	w := doRequest(r, "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthFreshTokenNotRenewed(t *testing.T) {
	r, _ := newTestRouter(t)
	// 刚签发的 60 分钟 token,剩余 > 50%,不应续签
	token := signToken(t, time.Now(), time.Now().Add(60*time.Minute))
	w := doRequest(r, token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("X-New-Token"); got != "" {
		t.Errorf("fresh token should not be renewed, got X-New-Token: %s", got)
	}
}

func TestAuthHalfConsumedTokenRenewed(t *testing.T) {
	r, _ := newTestRouter(t)
	// 已消耗 40/60 分钟,剩余 20 分钟 < 30 分钟阈值,应续签
	token := signToken(t, time.Now().Add(-40*time.Minute), time.Now().Add(20*time.Minute))
	w := doRequest(r, token, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	newToken := w.Header().Get("X-New-Token")
	if newToken == "" {
		t.Fatal("expected X-New-Token header, got none")
	}

	claims, err := util.ParseToken(newToken, testSecret)
	if err != nil {
		t.Fatalf("renewed token invalid: %v", err)
	}
	if claims.UserID != "user-1" || claims.Email != "a@b.com" || claims.TenantID != 7 {
		t.Errorf("renewed token claims mismatch: %+v", claims)
	}
	remaining := time.Until(claims.ExpiresAt.Time)
	if remaining < 59*time.Minute || remaining > 61*time.Minute {
		t.Errorf("renewed token should have full lifetime, got remaining %v", remaining)
	}
}

func TestAuthWebSocketUpgradeSkipsRenewal(t *testing.T) {
	r, _ := newTestRouter(t)
	token := signToken(t, time.Now().Add(-40*time.Minute), time.Now().Add(20*time.Minute))
	w := doRequest(r, token, map[string]string{
		"Upgrade":    "websocket",
		"Connection": "Upgrade",
	})
	if got := w.Header().Get("X-New-Token"); got != "" {
		t.Errorf("websocket upgrade should not get renewal header, got: %s", got)
	}
}

func TestAuthExpiredTokenRejected(t *testing.T) {
	r, _ := newTestRouter(t)
	token := signToken(t, time.Now().Add(-2*time.Hour), time.Now().Add(-time.Hour))
	w := doRequest(r, token, nil)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for expired token, got %d", w.Code)
	}
}

func TestAuthNoAuthAPIBypass(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Auth: &config.AuthConfig{
		JWTSecret:     testSecret,
		JWTExpiration: 60,
	}}

	r := gin.New()
	r.Use(Auth(cfg))
	r.POST("/api/v1/auth/login", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("no-auth API should bypass auth, got %d", w.Code)
	}
}
