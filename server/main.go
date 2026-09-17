package main

import (
	"bytes"
	"encoding/json"
	"log"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"strings"
)

const (
	protocolVersion = "1"
	sfvVersion      = "0"
)

// Manifest is the body the client is asked to launch, per Expo Updates protocol v1.
type Manifest struct {
	ID             string            `json:"id"`
	CreatedAt      string            `json:"createdAt"`
	RuntimeVersion string            `json:"runtimeVersion"`
	LaunchAsset    Asset             `json:"launchAsset"`
	Assets         []Asset           `json:"assets"`
	Metadata       map[string]string `json:"metadata"`
	Extra          map[string]any    `json:"extra"`
}

type server struct {
	catalog *Catalog
	signer  *Signer
	base    string
}

func main() {
	root := env("UPDATES_ROOT", "/srv/updates")

	catalog, err := LoadCatalog(root)
	if err != nil {
		log.Fatalf("updates: %v", err)
	}

	key := os.Getenv("CODE_SIGNING_KEY")
	if key == "" {
		log.Fatal("updates: CODE_SIGNING_KEY is not set")
	}

	signer, err := NewSigner(key, env("CODE_SIGNING_KEY_ID", "main"))
	if err != nil {
		log.Fatalf("updates: %v", err)
	}

	app := &server{catalog: catalog, signer: signer, base: strings.TrimSuffix(os.Getenv("PUBLIC_URL"), "/")}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /manifest", app.manifest)
	mux.HandleFunc("GET /assets/", app.asset)
	mux.HandleFunc("GET /minimum", app.minimum)
	mux.HandleFunc("GET /up", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	addr := ":" + env("PORT", "8000")
	log.Printf("updates: listening on %s", addr)

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("updates: %v", err)
	}
}

func (s *server) manifest(w http.ResponseWriter, r *http.Request) {
	platform := r.Header.Get("expo-platform")
	runtimeVersion := r.Header.Get("expo-runtime-version")

	if platform != "ios" && platform != "android" {
		http.Error(w, "expo-platform must be ios or android", http.StatusBadRequest)

		return
	}

	if runtimeVersion == "" {
		http.Error(w, "expo-runtime-version is required", http.StatusBadRequest)

		return
	}

	w.Header().Set("expo-protocol-version", protocolVersion)
	w.Header().Set("expo-sfv-version", sfvVersion)
	w.Header().Set("cache-control", "private, max-age=0")

	sign := r.Header.Get("expo-expect-signature") != ""

	entry, found := s.catalog.Lookup(platform, runtimeVersion)

	// An unknown runtime version and an up-to-date client are the same answer:
	// there is nothing this install is allowed to launch instead.
	if !found || entry.release.ID == r.Header.Get("expo-current-update-id") {
		s.directive(w, map[string]string{"type": "noUpdateAvailable"}, sign)

		return
	}

	if entry.release.RollBackToEmbedded {
		s.directive(w, map[string]any{
			"type":       "rollBackToEmbedded",
			"parameters": map[string]string{"commitTime": entry.release.CreatedAt},
		}, sign)

		return
	}

	body, err := json.Marshal(s.build(r, entry))
	if err != nil {
		http.Error(w, "could not render the manifest", http.StatusInternalServerError)

		return
	}

	s.multipart(w, "manifest", body, sign)
}

func (s *server) build(r *http.Request, entry resolved) Manifest {
	base := s.origin(r)

	assets := make([]Asset, 0, len(entry.assets))
	for _, asset := range entry.assets {
		asset.URL = base + asset.URL
		assets = append(assets, asset)
	}

	launch := entry.launchAsset
	launch.URL = base + launch.URL

	return Manifest{
		ID:             entry.release.ID,
		CreatedAt:      entry.release.CreatedAt,
		RuntimeVersion: entry.release.RuntimeVersion,
		LaunchAsset:    launch,
		Assets:         assets,
		Metadata:       map[string]string{},
		Extra:          map[string]any{},
	}
}

func (s *server) directive(w http.ResponseWriter, body any, sign bool) {
	encoded, err := json.Marshal(body)
	if err != nil {
		http.Error(w, "could not render the directive", http.StatusInternalServerError)

		return
	}

	s.multipart(w, "directive", encoded, sign)
}

// multipart writes the one-part multipart/mixed body the protocol expects.
func (s *server) multipart(w http.ResponseWriter, name string, body []byte, sign bool) {
	buffer := &bytes.Buffer{}
	writer := multipart.NewWriter(buffer)

	headers := textproto.MIMEHeader{}
	headers.Set("content-disposition", `form-data; name="`+name+`"`)
	headers.Set("content-type", "application/json")

	if sign {
		signature, err := s.signer.Header(body)
		if err != nil {
			http.Error(w, "could not sign the response", http.StatusInternalServerError)

			return
		}

		headers.Set("expo-signature", signature)
	}

	part, err := writer.CreatePart(headers)
	if err == nil {
		_, err = part.Write(body)
	}

	if err == nil {
		err = writer.Close()
	}

	if err != nil {
		http.Error(w, "could not render the response", http.StatusInternalServerError)

		return
	}

	w.Header().Set("content-type", "multipart/mixed; boundary="+writer.Boundary())
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(buffer.Bytes())
}

func (s *server) asset(w http.ResponseWriter, r *http.Request) {
	full, err := s.catalog.Path(strings.TrimPrefix(r.URL.Path, "/assets/"))
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)

		return
	}

	w.Header().Set("cache-control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, full)
}

func (s *server) minimum(w http.ResponseWriter, r *http.Request) {
	floor, ok := s.catalog.Floor(r.URL.Query().Get("platform"))
	if !ok {
		http.Error(w, "unknown platform", http.StatusNotFound)

		return
	}

	w.Header().Set("content-type", "application/json")
	w.Header().Set("cache-control", "public, max-age=300")
	_ = json.NewEncoder(w).Encode(floor)
}

// origin is what asset URLs are prefixed with, honouring the proxy that terminates TLS.
func (s *server) origin(r *http.Request) string {
	if s.base != "" {
		return s.base
	}

	scheme := "https"
	if forwarded := r.Header.Get("X-Forwarded-Proto"); forwarded != "" {
		scheme = forwarded
	} else if r.TLS == nil {
		scheme = "http"
	}

	host := r.Host
	if forwarded := r.Header.Get("X-Forwarded-Host"); forwarded != "" {
		host = forwarded
	}

	return scheme + "://" + host
}

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}

	return fallback
}
