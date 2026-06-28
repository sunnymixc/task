package config

import (
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
)

// Config 应用程序配置
type Config struct {
	Server   *ServerConfig
	Database *DatabaseConfig
	Auth     *AuthConfig
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Driver          string
	Host            string
	Port            int
	User            string
	Password        string
	DBName          string
	SSLMode         string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// AuthConfig 认证配置
type AuthConfig struct {
	JWTSecret     string
	JWTExpiration int // minutes
}

// Load 从环境变量加载配置
func Load() (*Config, error) {
	// 加载 .env 文件（如果存在）
	_ = godotenv.Load()

	cfg := &Config{
		Server: &ServerConfig{
			Port:         getEnv("SERVER_PORT", "8080"),
			ReadTimeout:  60 * time.Second,
			WriteTimeout: 60 * time.Second,
		},
		Database: &DatabaseConfig{
			Driver:          getEnv("DB_DRIVER", "postgres"),
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getEnvAsInt("DB_PORT", 5432),
			User:            getEnv("DB_USER", "postgres"),
			Password:        getEnv("DB_PASSWORD", ""),
			DBName:          getEnv("DB_NAME", "taskdb"),
			SSLMode:         getEnv("DB_SSLMODE", "disable"),
			MaxOpenConns:    getEnvAsInt("DB_MAX_OPEN_CONNS", 100),
			MaxIdleConns:    getEnvAsInt("DB_MAX_IDLE_CONNS", 10),
			ConnMaxLifetime: 1 * time.Hour,
		},
		Auth: &AuthConfig{
			JWTSecret:     getEnv("JWT_SECRET", "your-secret-key-change-this"),
			JWTExpiration: getEnvAsInt("JWT_EXPIRATION", 15), // 15 minutes
		},
	}

	// 验证必需配置
	if cfg.Database.Password == "" {
		return nil, fmt.Errorf("DB_PASSWORD is required")
	}

	return cfg, nil
}

// getEnv 获取环境变量，如果不存在则返回默认值
func getEnv(key, defaultVal string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultVal
}

// getEnvAsInt 获取环境变量并转换为整数
func getEnvAsInt(key string, defaultVal int) int {
	if value := os.Getenv(key); value != "" {
		var intVal int
		if _, err := fmt.Sscanf(value, "%d", &intVal); err == nil {
			return intVal
		}
	}
	return defaultVal
}

// GetDSN 获取数据库连接字符串
func (c *DatabaseConfig) GetDSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode)
}
