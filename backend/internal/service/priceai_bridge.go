package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

// PriceAI bridge user UUID namespace (custom, stable across releases).
var priceAIBridgeNamespace = uuid.MustParse("a1b2c3d4-e5f6-7890-abcd-ef1234567890")

// PriceAIUserUUID maps TokenBazaar int64 user id to a stable UUID for PriceAI tables.
func PriceAIUserUUID(userID int64) string {
	return uuid.NewSHA1(priceAIBridgeNamespace, []byte(fmt.Sprintf("tokenbazaar:user:%d", userID))).String()
}

// PriceAIBridgeCodePayload stored against a one-time code.
type PriceAIBridgeCodePayload struct {
	TBUserID    int64  `json:"tb_user_id"`
	UserUUID    string `json:"user_uuid"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url,omitempty"`
	State       string `json:"state,omitempty"`
	CreatedAt   int64  `json:"created_at"`
}

// PriceAIBridgeCache stores one-time bridge codes.
type PriceAIBridgeCache interface {
	StoreCode(ctx context.Context, codeHash string, payload *PriceAIBridgeCodePayload, ttl time.Duration) error
	// ConsumeCode returns payload and deletes the code (one-time).
	ConsumeCode(ctx context.Context, codeHash string) (*PriceAIBridgeCodePayload, error)
}

// HashPriceAIBridgeCode hashes the raw code for storage.
func HashPriceAIBridgeCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

// GeneratePriceAIBridgeCode returns a url-safe random code.
func GeneratePriceAIBridgeCode() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// NormalizePriceAIReturnURL validates return_url against allowlist origins.
// Allowed form: https://priceai.example/auth/tokenbazaar/callback (path must be exact callback path).
func NormalizePriceAIReturnURL(raw string, allowedOrigins []string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("return_url required")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("invalid return_url")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", fmt.Errorf("invalid return_url scheme")
	}
	// Fixed callback path
	path := strings.TrimSuffix(u.Path, "/")
	if path != "/auth/tokenbazaar/callback" {
		return "", fmt.Errorf("return_url path must be /auth/tokenbazaar/callback")
	}
	if u.User != nil || u.Fragment != "" {
		return "", fmt.Errorf("invalid return_url")
	}
	origin := strings.ToLower(u.Scheme) + "://" + strings.ToLower(u.Host)
	ok := false
	for _, allowed := range allowedOrigins {
		a := strings.TrimSpace(strings.ToLower(allowed))
		a = strings.TrimRight(a, "/")
		if a == "" {
			continue
		}
		if a == origin {
			ok = true
			break
		}
	}
	if !ok {
		return "", fmt.Errorf("return_url origin not allowed")
	}
	// Drop query/fragment from stored base; caller adds code/state
	u.RawQuery = ""
	u.Fragment = ""
	return u.String(), nil
}

// BuildPriceAIBridgePayload builds payload from user.
func BuildPriceAIBridgePayload(user *User, state string) *PriceAIBridgeCodePayload {
	if user == nil {
		return nil
	}
	display := strings.TrimSpace(user.Username)
	if display == "" {
		display = strings.TrimSpace(user.Email)
	}
	return &PriceAIBridgeCodePayload{
		TBUserID:    user.ID,
		UserUUID:    PriceAIUserUUID(user.ID),
		Email:       strings.TrimSpace(user.Email),
		DisplayName: display,
		AvatarURL:   strings.TrimSpace(user.AvatarURL),
		State:       strings.TrimSpace(state),
		CreatedAt:   time.Now().Unix(),
	}
}
