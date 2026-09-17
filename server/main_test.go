package main

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const metadata = `{
  "version": 0,
  "bundler": "metro",
  "fileMetadata": {
    "android": {
      "bundle": "_expo/static/js/android/entry-abc.hbc",
      "assets": [{ "path": "assets/9f8e7d", "ext": "ttf" }]
    },
    "ios": {
      "bundle": "_expo/static/js/ios/entry-def.hbc",
      "assets": []
    }
  }
}`

func fixture(t *testing.T) (*server, *rsa.PrivateKey) {
	t.Helper()

	root := t.TempDir()
	export := filepath.Join(root, "exports", "e1")

	write := func(rel, contents string) {
		full := filepath.Join(export, filepath.FromSlash(rel))

		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}

		if err := os.WriteFile(full, []byte(contents), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	write("metadata.json", metadata)
	write("_expo/static/js/android/entry-abc.hbc", "// android bundle")
	write("_expo/static/js/ios/entry-def.hbc", "// ios bundle")
	write("assets/9f8e7d", "font-bytes")

	index := `{
	  "minimum": { "android": { "version": "0.2.0", "url": "https://play.google.com/x" } },
	  "releases": [
	    { "id": "11111111-1111-1111-1111-111111111111", "createdAt": "2026-09-18T00:00:00.000Z",
	      "platform": "android", "runtimeVersion": "fp-android", "export": "e1" },
	    { "id": "22222222-2222-2222-2222-222222222222", "createdAt": "2026-09-18T00:00:00.000Z",
	      "platform": "ios", "runtimeVersion": "fp-ios", "export": "e1" }
	  ]
	}`

	if err := os.WriteFile(filepath.Join(root, "index.json"), []byte(index), 0o644); err != nil {
		t.Fatal(err)
	}

	catalog, err := LoadCatalog(root)
	if err != nil {
		t.Fatalf("load catalog: %v", err)
	}

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}

	encoded := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})

	signer, err := NewSigner(string(encoded), "main")
	if err != nil {
		t.Fatalf("new signer: %v", err)
	}

	return &server{catalog: catalog, signer: signer, base: "https://updates.paayo.ph"}, key
}

func ask(t *testing.T, app *server, headers map[string]string) *http.Response {
	t.Helper()

	request := httptest.NewRequest(http.MethodGet, "/manifest", nil)
	for name, value := range headers {
		request.Header.Set(name, value)
	}

	recorder := httptest.NewRecorder()
	app.manifest(recorder, request)

	return recorder.Result()
}

// part reads the single body part back out, with its own headers.
func part(t *testing.T, response *http.Response) (*multipart.Part, []byte) {
	t.Helper()

	kind, params, err := mime.ParseMediaType(response.Header.Get("content-type"))
	if err != nil {
		t.Fatalf("parse content type: %v", err)
	}

	if kind != "multipart/mixed" {
		t.Fatalf("content type was %q", kind)
	}

	reader := multipart.NewReader(response.Body, params["boundary"])

	next, err := reader.NextPart()
	if err != nil {
		t.Fatalf("read part: %v", err)
	}

	body := make([]byte, 0, 4096)
	buffer := make([]byte, 1024)

	for {
		read, err := next.Read(buffer)
		body = append(body, buffer[:read]...)

		if err != nil {
			break
		}
	}

	return next, body
}

func TestManifestIsServedForAKnownRuntimeVersion(t *testing.T) {
	app, _ := fixture(t)

	response := ask(t, app, map[string]string{
		"expo-platform":         "android",
		"expo-runtime-version":  "fp-android",
		"expo-protocol-version": "1",
		"accept":                "multipart/mixed",
	})

	if response.StatusCode != http.StatusOK {
		t.Fatalf("status was %d", response.StatusCode)
	}

	for header, want := range map[string]string{
		"expo-protocol-version": "1",
		"expo-sfv-version":      "0",
		"cache-control":         "private, max-age=0",
	} {
		if got := response.Header.Get(header); got != want {
			t.Errorf("%s was %q, wanted %q", header, got, want)
		}
	}

	found, body := part(t, response)

	if disposition := found.Header.Get("content-disposition"); !strings.Contains(disposition, `name="manifest"`) {
		t.Fatalf("disposition was %q", disposition)
	}

	var manifest Manifest
	if err := json.Unmarshal(body, &manifest); err != nil {
		t.Fatalf("parse manifest: %v", err)
	}

	if manifest.RuntimeVersion != "fp-android" {
		t.Errorf("runtimeVersion was %q", manifest.RuntimeVersion)
	}

	if manifest.ID != "11111111-1111-1111-1111-111111111111" {
		t.Errorf("id was %q", manifest.ID)
	}

	want := "https://updates.paayo.ph/assets/e1/_expo/static/js/android/entry-abc.hbc"
	if manifest.LaunchAsset.URL != want {
		t.Errorf("launchAsset url was %q", manifest.LaunchAsset.URL)
	}

	if manifest.LaunchAsset.ContentType != "application/javascript" {
		t.Errorf("launchAsset contentType was %q", manifest.LaunchAsset.ContentType)
	}

	if len(manifest.Assets) != 1 {
		t.Fatalf("got %d assets", len(manifest.Assets))
	}

	sum := sha256.Sum256([]byte("font-bytes"))
	if manifest.Assets[0].Hash != base64.RawURLEncoding.EncodeToString(sum[:]) {
		t.Errorf("asset hash was %q", manifest.Assets[0].Hash)
	}

	if manifest.Assets[0].FileExtension != ".ttf" {
		t.Errorf("asset fileExtension was %q", manifest.Assets[0].FileExtension)
	}
}

func TestAnUnknownRuntimeVersionGetsNoUpdateAvailable(t *testing.T) {
	app, _ := fixture(t)

	response := ask(t, app, map[string]string{
		"expo-platform":        "android",
		"expo-runtime-version": "fp-from-an-older-native-build",
	})

	found, body := part(t, response)

	if disposition := found.Header.Get("content-disposition"); !strings.Contains(disposition, `name="directive"`) {
		t.Fatalf("disposition was %q", disposition)
	}

	var directive map[string]any
	if err := json.Unmarshal(body, &directive); err != nil {
		t.Fatalf("parse directive: %v", err)
	}

	if directive["type"] != "noUpdateAvailable" {
		t.Errorf("directive was %v", directive["type"])
	}
}

func TestACurrentClientGetsNoUpdateAvailable(t *testing.T) {
	app, _ := fixture(t)

	response := ask(t, app, map[string]string{
		"expo-platform":          "android",
		"expo-runtime-version":   "fp-android",
		"expo-current-update-id": "11111111-1111-1111-1111-111111111111",
	})

	_, body := part(t, response)

	var directive map[string]any
	if err := json.Unmarshal(body, &directive); err != nil {
		t.Fatalf("parse directive: %v", err)
	}

	if directive["type"] != "noUpdateAvailable" {
		t.Errorf("directive was %v", directive["type"])
	}
}

func TestTheManifestIsSignedWhenTheClientAsksForIt(t *testing.T) {
	app, key := fixture(t)

	response := ask(t, app, map[string]string{
		"expo-platform":         "android",
		"expo-runtime-version":  "fp-android",
		"expo-expect-signature": `sig, keyid="main", alg="rsa-v1_5-sha256"`,
	})

	found, body := part(t, response)

	header := found.Header.Get("expo-signature")
	if header == "" {
		t.Fatal("no expo-signature on the manifest part")
	}

	if !strings.Contains(header, `keyid="main"`) || !strings.Contains(header, `alg="rsa-v1_5-sha256"`) {
		t.Fatalf("signature header was %q", header)
	}

	start := strings.Index(header, `sig="`) + len(`sig="`)
	raw := header[start : start+strings.Index(header[start:], `"`)]

	signature, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		t.Fatalf("decode signature: %v", err)
	}

	digest := sha256.Sum256(body)
	if err := rsa.VerifyPKCS1v15(&key.PublicKey, crypto.SHA256, digest[:], signature); err != nil {
		t.Fatalf("signature did not verify: %v", err)
	}
}

func TestAnUnsignedRequestGetsNoSignature(t *testing.T) {
	app, _ := fixture(t)

	found, _ := part(t, ask(t, app, map[string]string{
		"expo-platform":        "android",
		"expo-runtime-version": "fp-android",
	}))

	if header := found.Header.Get("expo-signature"); header != "" {
		t.Fatalf("signed an unasked-for response: %q", header)
	}
}

func TestTheManifestRefusesAnUnknownPlatform(t *testing.T) {
	app, _ := fixture(t)

	response := ask(t, app, map[string]string{
		"expo-platform":        "windows",
		"expo-runtime-version": "fp-android",
	})

	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("status was %d", response.StatusCode)
	}
}

func TestAssetPathsCannotEscapeTheExportsTree(t *testing.T) {
	app, _ := fixture(t)

	exports := filepath.Join(app.catalog.root, "exports")

	for _, attempt := range []string{"../../index.json", "e1/../../../etc/passwd", "..%2f..%2findex.json"} {
		full, err := app.catalog.Path(attempt)
		if err != nil {
			continue
		}

		if !strings.HasPrefix(full, exports+string(os.PathSeparator)) {
			t.Fatalf("%q resolved outside the exports tree, to %q", attempt, full)
		}
	}

	if _, err := app.catalog.Path("e1/metadata.json"); err != nil {
		t.Fatalf("a legitimate path was refused: %v", err)
	}
}

func TestTheFloorIsServedPerPlatform(t *testing.T) {
	app, _ := fixture(t)

	request := httptest.NewRequest(http.MethodGet, "/minimum?platform=android", nil)
	recorder := httptest.NewRecorder()
	app.minimum(recorder, request)

	var floor Floor
	if err := json.NewDecoder(recorder.Body).Decode(&floor); err != nil {
		t.Fatalf("parse floor: %v", err)
	}

	if floor.Version != "0.2.0" {
		t.Errorf("version was %q", floor.Version)
	}

	request = httptest.NewRequest(http.MethodGet, "/minimum?platform=ios", nil)
	recorder = httptest.NewRecorder()
	app.minimum(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Errorf("status for an unconfigured platform was %d", recorder.Code)
	}
}

func TestAKeyThatLostItsTrailingNewlineStillLoads(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}

	encoded := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})

	if _, err := NewSigner(strings.TrimRight(string(encoded), "\n"), "main"); err != nil {
		t.Fatalf("new signer: %v", err)
	}
}
