// Package migrations embeds versioned SQL migration files so the server
// can apply them at startup without any external database client.
package migrations

import "embed"

//go:embed *.up.sql
var FS embed.FS
