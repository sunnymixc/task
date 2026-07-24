package util

import (
	"strings"
	"testing"
	"time"
)

func TestGenerateAndParseToken(t *testing.T) {
	secret := "test-secret"
	token, err := GenerateToken(secret, time.Hour, "user-1", "a@b.com", 42)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}

	claims, err := ParseToken(token, secret)
	if err != nil {
		t.Fatalf("ParseToken failed: %v", err)
	}
	if claims.UserID != "user-1" || claims.Email != "a@b.com" || claims.TenantID != 42 {
		t.Errorf("claims mismatch: %+v", claims)
	}
	if claims.ExpiresAt == nil || claims.IssuedAt == nil {
		t.Fatal("missing ExpiresAt/IssuedAt")
	}
	gotLifetime := claims.ExpiresAt.Sub(claims.IssuedAt.Time)
	if gotLifetime < 59*time.Minute || gotLifetime > 61*time.Minute {
		t.Errorf("unexpected lifetime: %v", gotLifetime)
	}
}

func TestParseTokenWrongSecret(t *testing.T) {
	token, err := GenerateToken("secret-a", time.Hour, "user-1", "a@b.com", 1)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	if _, err := ParseToken(token, "secret-b"); err == nil {
		t.Error("expected error for wrong secret, got nil")
	}
}

func TestParseTokenExpired(t *testing.T) {
	token, err := GenerateToken("secret", -time.Minute, "user-1", "a@b.com", 1)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	_, err = ParseToken(token, "secret")
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
	if !strings.Contains(err.Error(), "expired") {
		t.Errorf("expected expiration error, got: %v", err)
	}
}

func TestParseTokenGarbage(t *testing.T) {
	if _, err := ParseToken("not-a-jwt", "secret"); err == nil {
		t.Error("expected error for malformed token, got nil")
	}
}
