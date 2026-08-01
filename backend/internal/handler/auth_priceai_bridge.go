package handler

import (
	"crypto/subtle"
	"log/slog"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

type priceAIBridgeIssueRequest struct {
	State     string `json:"state"`
	ReturnURL string `json:"return_url"`
}

type priceAIBridgeIssueResponse struct {
	Code      string `json:"code"`
	ReturnURL string `json:"return_url"`
	ExpiresIn int    `json:"expires_in"`
}

type priceAIBridgeExchangeRequest struct {
	Code     string `json:"code" binding:"required"`
	ClientID string `json:"client_id"`
}

type priceAIBridgeExchangeResponse struct {
	UserID      string `json:"user_id"`
	TBUserID    int64  `json:"tb_user_id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url,omitempty"`
}

// IssuePriceAIBridgeCode issues a one-time code for an authenticated user.
// POST /api/v1/auth/priceai/bridge/issue
func (h *AuthHandler) IssuePriceAIBridgeCode(c *gin.Context) {
	if !h.priceAIBridgeEnabled() {
		response.NotFound(c, "PriceAI bridge is not enabled")
		return
	}
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return
	}
	var req priceAIBridgeIssueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}
	returnURL, err := service.NormalizePriceAIReturnURL(req.ReturnURL, h.cfg.PriceAIBridge.ReturnOrigins)
	if err != nil {
		response.BadRequest(c, "Invalid return_url: "+err.Error())
		return
	}

	user, err := h.userService.GetByID(c.Request.Context(), subject.UserID)
	if err != nil || user == nil {
		response.Unauthorized(c, "User not found")
		return
	}
	if err := ensureLoginUserActive(user); err != nil {
		response.ErrorFrom(c, err)
		return
	}

	code, err := service.GeneratePriceAIBridgeCode()
	if err != nil {
		response.InternalError(c, "Failed to issue bridge code")
		return
	}
	ttlSec := h.cfg.PriceAIBridge.CodeTTLSeconds
	if ttlSec <= 0 {
		ttlSec = 90
	}
	if ttlSec > 300 {
		ttlSec = 300
	}
	payload := service.BuildPriceAIBridgePayload(user, req.State)
	if err := h.priceAIBridgeCache.StoreCode(c.Request.Context(), service.HashPriceAIBridgeCode(code), payload, time.Duration(ttlSec)*time.Second); err != nil {
		slog.Error("priceai bridge store code failed", "error", err)
		response.InternalError(c, "Failed to store bridge code")
		return
	}

	response.Success(c, priceAIBridgeIssueResponse{
		Code:      code,
		ReturnURL: returnURL,
		ExpiresIn: ttlSec,
	})
}

// ExchangePriceAIBridgeCode consumes a one-time code (server-to-server).
// POST /api/v1/auth/priceai/bridge/exchange
func (h *AuthHandler) ExchangePriceAIBridgeCode(c *gin.Context) {
	if !h.priceAIBridgeEnabled() {
		response.NotFound(c, "PriceAI bridge is not enabled")
		return
	}
	secret := strings.TrimSpace(h.cfg.PriceAIBridge.Secret)
	provided := strings.TrimSpace(c.GetHeader("X-PriceAI-Bridge-Secret"))
	if provided == "" {
		provided = strings.TrimSpace(c.GetHeader("Authorization"))
		provided = strings.TrimPrefix(provided, "Bearer ")
		provided = strings.TrimSpace(provided)
	}
	if subtle.ConstantTimeCompare([]byte(provided), []byte(secret)) != 1 {
		response.Unauthorized(c, "Invalid bridge secret")
		return
	}

	var req priceAIBridgeExchangeRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Code) == "" {
		response.BadRequest(c, "Invalid request")
		return
	}
	payload, err := h.priceAIBridgeCache.ConsumeCode(c.Request.Context(), service.HashPriceAIBridgeCode(strings.TrimSpace(req.Code)))
	if err != nil {
		slog.Error("priceai bridge consume failed", "error", err)
		response.InternalError(c, "Failed to consume bridge code")
		return
	}
	if payload == nil {
		response.BadRequest(c, "Invalid or expired bridge code")
		return
	}

	response.Success(c, priceAIBridgeExchangeResponse{
		UserID:      payload.UserUUID,
		TBUserID:    payload.TBUserID,
		Email:       payload.Email,
		DisplayName: payload.DisplayName,
		AvatarURL:   payload.AvatarURL,
	})
}

// RevokePriceAIBridgeSessions revokes all TB sessions for the authenticated user (federated logout helper).
// POST /api/v1/auth/priceai/bridge/revoke
// Auth: either user JWT or bridge secret + user_id body for PriceAI server-initiated logout.
func (h *AuthHandler) RevokePriceAIBridgeSessions(c *gin.Context) {
	if !h.priceAIBridgeEnabled() {
		response.NotFound(c, "PriceAI bridge is not enabled")
		return
	}

	var userID int64
	if subject, ok := middleware2.GetAuthSubjectFromContext(c); ok {
		userID = subject.UserID
	} else {
		secret := strings.TrimSpace(h.cfg.PriceAIBridge.Secret)
		provided := strings.TrimSpace(c.GetHeader("X-PriceAI-Bridge-Secret"))
		if subtle.ConstantTimeCompare([]byte(provided), []byte(secret)) != 1 {
			response.Unauthorized(c, "Unauthorized")
			return
		}
		var body struct {
			TBUserID int64 `json:"tb_user_id"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.TBUserID <= 0 {
			response.BadRequest(c, "tb_user_id required")
			return
		}
		userID = body.TBUserID
	}

	if err := h.authService.RevokeAllUserTokens(c.Request.Context(), userID); err != nil {
		slog.Error("priceai bridge revoke failed", "user_id", userID, "error", err)
		response.InternalError(c, "Failed to revoke sessions")
		return
	}
	response.Success(c, gin.H{"message": "sessions revoked", "tb_user_id": userID})
}

func (h *AuthHandler) priceAIBridgeEnabled() bool {
	if h == nil || h.cfg == nil || h.priceAIBridgeCache == nil {
		return false
	}
	return strings.TrimSpace(h.cfg.PriceAIBridge.Secret) != "" && len(h.cfg.PriceAIBridge.ReturnOrigins) > 0
}
