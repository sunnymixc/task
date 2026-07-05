package util

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// letterCharset 大小写英文字母,用于生成随机英文编码
const letterCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// RandomLetters 生成 n 位随机英文字母编码(crypto/rand,无取模偏差)
func RandomLetters(n int) (string, error) {
	max := big.NewInt(int64(len(letterCharset)))
	b := make([]byte, n)
	for i := range b {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", fmt.Errorf("failed to generate random letters: %w", err)
		}
		b[i] = letterCharset[idx.Int64()]
	}
	return string(b), nil
}
