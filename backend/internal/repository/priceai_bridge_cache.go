package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

const priceAIBridgeCodePrefix = "priceai_bridge:code:"

type PriceAIBridgeCache struct {
	rdb *redis.Client
}

func NewPriceAIBridgeCache(rdb *redis.Client) service.PriceAIBridgeCache {
	return &PriceAIBridgeCache{rdb: rdb}
}

func (c *PriceAIBridgeCache) StoreCode(ctx context.Context, codeHash string, payload *service.PriceAIBridgeCodePayload, ttl time.Duration) error {
	if c == nil || c.rdb == nil {
		return fmt.Errorf("priceai bridge cache unavailable")
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	key := priceAIBridgeCodePrefix + codeHash
	return c.rdb.Set(ctx, key, data, ttl).Err()
}

func (c *PriceAIBridgeCache) ConsumeCode(ctx context.Context, codeHash string) (*service.PriceAIBridgeCodePayload, error) {
	if c == nil || c.rdb == nil {
		return nil, fmt.Errorf("priceai bridge cache unavailable")
	}
	key := priceAIBridgeCodePrefix + codeHash
	// GETDEL when available (Redis 6.2+); fallback Get+Del
	data, err := c.rdb.GetDel(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		// Fallback for older redis
		data, err = c.rdb.Get(ctx, key).Bytes()
		if err == redis.Nil {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		_ = c.rdb.Del(ctx, key).Err()
	}
	var payload service.PriceAIBridgeCodePayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}
	return &payload, nil
}
