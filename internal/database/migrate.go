package database

import (
	"fmt"
	"io/fs"
	"log"
	"sort"
	"strings"

	"github.com/task-management/task/migrations"
	"gorm.io/gorm"
)

// migrationLockKey 迁移专用的 Postgres advisory lock key，防止多个实例并发执行迁移
const migrationLockKey int64 = 823467001

// Migrate 按序应用尚未执行的嵌入式迁移脚本（migrations/*.up.sql），
// 已应用的版本记录在 schema_migrations 表中。
func Migrate() error {
	if DB == nil {
		return fmt.Errorf("database not initialized")
	}

	// 固定单条连接：advisory lock 是会话级的，加锁/解锁必须发生在同一连接上
	return DB.Connection(func(conn *gorm.DB) error {
		if err := conn.Exec("SELECT pg_advisory_lock(?)", migrationLockKey).Error; err != nil {
			return fmt.Errorf("failed to acquire migration lock: %w", err)
		}
		defer conn.Exec("SELECT pg_advisory_unlock(?)", migrationLockKey)

		if err := conn.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
			version    VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`).Error; err != nil {
			return fmt.Errorf("failed to create schema_migrations table: %w", err)
		}

		var appliedVersions []string
		if err := conn.Raw("SELECT version FROM schema_migrations").Scan(&appliedVersions).Error; err != nil {
			return fmt.Errorf("failed to read schema_migrations: %w", err)
		}
		applied := make(map[string]bool, len(appliedVersions))
		for _, v := range appliedVersions {
			applied[v] = true
		}

		files, err := fs.Glob(migrations.FS, "*.up.sql")
		if err != nil {
			return fmt.Errorf("failed to list embedded migrations: %w", err)
		}
		sort.Strings(files) // 零填充的数字前缀保证字典序即版本序

		appliedCount := 0
		for _, name := range files {
			version := strings.SplitN(name, "_", 2)[0] // "000007_xxx.up.sql" -> "000007"
			if applied[version] {
				continue
			}

			sqlBytes, err := migrations.FS.ReadFile(name)
			if err != nil {
				return fmt.Errorf("failed to read migration %s: %w", name, err)
			}

			// 单文件一个事务：SQL 与版本记录要么同时生效，要么整体回滚
			err = conn.Transaction(func(tx *gorm.DB) error {
				if err := tx.Exec(string(sqlBytes)).Error; err != nil {
					return err
				}
				return tx.Exec("INSERT INTO schema_migrations (version) VALUES (?)", version).Error
			})
			if err != nil {
				return fmt.Errorf("migration %s failed: %w", name, err)
			}

			log.Printf("Applied migration %s", name)
			appliedCount++
		}

		if appliedCount == 0 {
			log.Println("Database schema is up to date")
		} else {
			log.Printf("Applied %d migration(s)", appliedCount)
		}
		return nil
	})
}
