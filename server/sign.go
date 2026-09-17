package main

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
)

// Signer holds the code-signing key the manifest and directive bodies are signed with.
type Signer struct {
	key   *rsa.PrivateKey
	keyID string
}

// NewSigner parses a PEM private key, accepting either PKCS#1 or PKCS#8.
//
// The key arrives through the environment, and `-e KEY="$(cat key.pem)"` drops
// the newline the END line needs, which PEM will not decode without. Re-adding
// it here is cheaper than asking every operator to remember.
func NewSigner(contents, keyID string) (*Signer, error) {
	block, _ := pem.Decode([]byte(strings.TrimSpace(contents) + "\n"))
	if block == nil {
		return nil, errors.New("the code signing key is not PEM")
	}

	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return &Signer{key: key, keyID: keyID}, nil
	}

	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse code signing key: %w", err)
	}

	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("the code signing key is not RSA")
	}

	return &Signer{key: key, keyID: keyID}, nil
}

// Header signs one body and renders the expo-signature structured-field value.
func (s *Signer) Header(body []byte) (string, error) {
	digest := sha256.Sum256(body)

	signature, err := rsa.SignPKCS1v15(rand.Reader, s.key, crypto.SHA256, digest[:])
	if err != nil {
		return "", fmt.Errorf("sign: %w", err)
	}

	return fmt.Sprintf(
		`sig="%s", keyid="%s", alg="rsa-v1_5-sha256"`,
		base64.StdEncoding.EncodeToString(signature),
		s.keyID,
	), nil
}
