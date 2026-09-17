package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
)

// Floor is the lowest native version the API will still talk to.
type Floor struct {
	Version string `json:"version"`
	URL     string `json:"url"`
}

// Release names one published export for one platform.
type Release struct {
	ID                 string `json:"id"`
	CreatedAt          string `json:"createdAt"`
	Platform           string `json:"platform"`
	RuntimeVersion     string `json:"runtimeVersion"`
	Export             string `json:"export"`
	RollBackToEmbedded bool   `json:"rollBackToEmbedded"`
}

// Index is the baked catalogue, written at image build time by stage.mjs.
type Index struct {
	Minimum  map[string]Floor `json:"minimum"`
	Releases []Release        `json:"releases"`
}

type fileMetadata struct {
	Bundle string `json:"bundle"`
	Assets []struct {
		Path string `json:"path"`
		Ext  string `json:"ext"`
	} `json:"assets"`
}

type exportMetadata struct {
	FileMetadata map[string]fileMetadata `json:"fileMetadata"`
}

// Asset is one entry of the manifest, in the shape the protocol defines.
type Asset struct {
	Hash          string `json:"hash"`
	Key           string `json:"key"`
	ContentType   string `json:"contentType"`
	FileExtension string `json:"fileExtension,omitempty"`
	URL           string `json:"url"`
}

type resolved struct {
	release     Release
	launchAsset Asset
	assets      []Asset
}

// Catalog is every release the image holds, read once at boot.
type Catalog struct {
	root      string
	minimum   map[string]Floor
	byRuntime map[string]resolved
}

// LoadCatalog reads the baked index and hashes every file each release points at.
func LoadCatalog(root string) (*Catalog, error) {
	raw, err := os.ReadFile(filepath.Join(root, "index.json"))
	if err != nil {
		return nil, fmt.Errorf("read index: %w", err)
	}

	var index Index
	if err := json.Unmarshal(raw, &index); err != nil {
		return nil, fmt.Errorf("parse index: %w", err)
	}

	catalog := &Catalog{
		root:      root,
		minimum:   index.Minimum,
		byRuntime: map[string]resolved{},
	}

	// Newest wins where two releases claim the same runtime version.
	releases := append([]Release(nil), index.Releases...)
	sort.SliceStable(releases, func(i, j int) bool {
		return releases[i].CreatedAt < releases[j].CreatedAt
	})

	for _, release := range releases {
		entry, err := catalog.resolve(release)
		if err != nil {
			return nil, err
		}

		catalog.byRuntime[key(release.Platform, release.RuntimeVersion)] = entry
	}

	return catalog, nil
}

// Lookup answers with the release serving this platform and runtime version.
func (c *Catalog) Lookup(platform, runtimeVersion string) (resolved, bool) {
	entry, ok := c.byRuntime[key(platform, runtimeVersion)]

	return entry, ok
}

// Floor answers with the minimum supported native version for a platform.
func (c *Catalog) Floor(platform string) (Floor, bool) {
	floor, ok := c.minimum[platform]

	return floor, ok
}

// Path resolves a request path under the exports tree, refusing anything that escapes it.
func (c *Catalog) Path(rest string) (string, error) {
	clean := path.Clean("/" + rest)
	full := filepath.Join(c.root, "exports", filepath.FromSlash(clean))

	exports := filepath.Join(c.root, "exports")
	if !strings.HasPrefix(full, exports+string(os.PathSeparator)) {
		return "", fmt.Errorf("path escapes the exports tree")
	}

	return full, nil
}

func (c *Catalog) resolve(release Release) (resolved, error) {
	dir := filepath.Join(c.root, "exports", release.Export)

	raw, err := os.ReadFile(filepath.Join(dir, "metadata.json"))
	if err != nil {
		return resolved{}, fmt.Errorf("read metadata for %s: %w", release.Export, err)
	}

	var metadata exportMetadata
	if err := json.Unmarshal(raw, &metadata); err != nil {
		return resolved{}, fmt.Errorf("parse metadata for %s: %w", release.Export, err)
	}

	files, ok := metadata.FileMetadata[release.Platform]
	if !ok {
		return resolved{}, fmt.Errorf("export %s carries nothing for %s", release.Export, release.Platform)
	}

	launch, err := c.asset(release, dir, files.Bundle, "application/javascript", "")
	if err != nil {
		return resolved{}, err
	}

	assets := make([]Asset, 0, len(files.Assets))
	for _, entry := range files.Assets {
		asset, err := c.asset(release, dir, entry.Path, contentTypeFor(entry.Ext), entry.Ext)
		if err != nil {
			return resolved{}, err
		}

		assets = append(assets, asset)
	}

	return resolved{release: release, launchAsset: launch, assets: assets}, nil
}

func (c *Catalog) asset(release Release, dir, rel, contentType, ext string) (Asset, error) {
	contents, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(rel)))
	if err != nil {
		return Asset{}, fmt.Errorf("read %s: %w", rel, err)
	}

	sum := sha256.Sum256(contents)

	extension := ""
	if ext != "" {
		extension = "." + strings.TrimPrefix(ext, ".")
	}

	return Asset{
		Hash:          base64.RawURLEncoding.EncodeToString(sum[:]),
		Key:           fmt.Sprintf("%x", sum),
		ContentType:   contentType,
		FileExtension: extension,
		URL:           path.Join("/assets", release.Export, rel),
	}, nil
}

func contentTypeFor(ext string) string {
	if ext == "" {
		return "application/octet-stream"
	}

	if guess := mime.TypeByExtension("." + strings.TrimPrefix(ext, ".")); guess != "" {
		return guess
	}

	return "application/octet-stream"
}

func key(platform, runtimeVersion string) string {
	return platform + "\x00" + runtimeVersion
}
