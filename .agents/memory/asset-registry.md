---
name: Asset registry
description: How uploaded files are tracked for permanent URLs and export lookup
---

Every file uploaded via /ai/upload-media is registered in _asset_registry (in-memory dict backed by data/asset_registry.json).

Registry record: { path, name, mime, size, ext, uploadedAt, serverUrl }

Lookup: _asset_path_by_id(fileId) → local disk path or None

Permanent URL: /uploads/<fileId><ext> — served by the GET /uploads/ handler with Cache-Control: public, max-age=86400

**Why:** Without registry, export had no way to find the file for a given clip's fileId. localStorage only stores metadata; actual bytes are on disk.

**How to apply:** Any feature that needs to locate an uploaded file should use _asset_path_by_id(). New upload handlers must call _register_asset() and return serverUrl in the response.
