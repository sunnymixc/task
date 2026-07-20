package util

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// TokenTypeRefresh marks a long-lived refresh token; access tokens carry no type claim.
const TokenTypeRefresh = "refresh"

// JWTClaims represents JWT claims
type JWTClaims struct {
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	TenantID  uint64 `json:"tenant_id"`
	TokenType string `json:"typ,omitempty"`
	jwt.RegisteredClaims
}

// GenerateToken signs a new HS256 access JWT for the given user, valid for lifetime from now.
func GenerateToken(secret string, lifetime time.Duration, userID, email string, tenantID uint64) (string, error) {
	return generateToken(secret, lifetime, userID, email, tenantID, "")
}

// GenerateRefreshToken signs a long-lived refresh JWT. It is only accepted by
// ParseRefreshToken (the /auth/refresh endpoint), never as an API access token.
func GenerateRefreshToken(secret string, lifetime time.Duration, userID, email string, tenantID uint64) (string, error) {
	return generateToken(secret, lifetime, userID, email, tenantID, TokenTypeRefresh)
}

func generateToken(secret string, lifetime time.Duration, userID, email string, tenantID uint64, tokenType string) (string, error) {
	claims := &JWTClaims{
		UserID:    userID,
		Email:     email,
		TenantID:  tenantID,
		TokenType: tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(lifetime)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseToken parses and validates an access JWT. Refresh tokens are rejected —
// they are only valid at the /auth/refresh endpoint.
func ParseToken(tokenString, secret string) (*JWTClaims, error) {
	claims, err := parseToken(tokenString, secret)
	if err != nil {
		return nil, err
	}
	if claims.TokenType == TokenTypeRefresh {
		return nil, errors.New("refresh token cannot be used as access token")
	}
	return claims, nil
}

// ParseRefreshToken parses and validates a refresh JWT.
func ParseRefreshToken(tokenString, secret string) (*JWTClaims, error) {
	claims, err := parseToken(tokenString, secret)
	if err != nil {
		return nil, err
	}
	if claims.TokenType != TokenTypeRefresh {
		return nil, errors.New("not a refresh token")
	}
	return claims, nil
}

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
