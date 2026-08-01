package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPriceAIUserUUID_Stable(t *testing.T) {
	a := PriceAIUserUUID(1)
	b := PriceAIUserUUID(1)
	c := PriceAIUserUUID(2)
	require.Equal(t, a, b)
	require.NotEqual(t, a, c)
	require.Regexp(t, `^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, a)
}

func TestNormalizePriceAIReturnURL(t *testing.T) {
	origins := []string{"http://127.0.0.1:3000", "https://priceai.example.com"}
	got, err := NormalizePriceAIReturnURL("http://127.0.0.1:3000/auth/tokenbazaar/callback?x=1", origins)
	require.NoError(t, err)
	require.Equal(t, "http://127.0.0.1:3000/auth/tokenbazaar/callback", got)

	_, err = NormalizePriceAIReturnURL("https://evil.example/auth/tokenbazaar/callback", origins)
	require.Error(t, err)

	_, err = NormalizePriceAIReturnURL("http://127.0.0.1:3000/dashboard", origins)
	require.Error(t, err)
}
