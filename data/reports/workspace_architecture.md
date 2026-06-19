# Workspace Architecture
**Phase 5.6 — CapCut Video Editor Clone SaaS**

## Overview

Workspaces group users (Owner / Editor / Viewer) around shared projects. They are a Pro+ feature — Free users cannot create workspaces.

## Data Model

### workspaces.json
```json
{
  "ws_abc123": {
    "id": "ws_abc123",
    "name": "My Agency",
    "ownerId": "userId123",
    "members": [
      { "userId": "userId456", "role": "editor", "email": "bob@co.com", "joinedAt": 1718000000 },
      { "userId": "userId789", "role": "viewer", "email": "alice@co.com", "joinedAt": 1718001000 }
    ],
    "createdAt": 1717000000
  }
}
```

### projects.json (with workspace)
Projects carry an optional `workspaceId` field. Projects without one are personal.

```json
{
  "id": "proj_xxx",
  "name": "Brand Video",
  "workspaceId": "ws_abc123",
  ...
}
```

## Role Matrix

| Action | Owner | Editor | Viewer |
|--------|-------|--------|--------|
| Create workspace | ✅ | — | — |
| Delete workspace | ✅ | ❌ | ❌ |
| Invite members | ✅ | ❌ | ❌ |
| Remove members | ✅ | ❌ | ❌ |
| Edit shared projects | ✅ | ✅ | ❌ |
| View shared projects | ✅ | ✅ | ✅ |
| Export from workspace | ✅ | ✅ | ❌ |

## API Surface

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/workspace/list` | Session | List all workspaces user belongs to |
| GET | `/workspace/projects/<wsId>` | Session | List projects in workspace |
| POST | `/workspace/create` | Session (Pro+) | Create a workspace |
| POST | `/workspace/invite` | Session (Owner) | Invite a member by email |
| POST | `/workspace/remove-member` | Session (Owner) | Remove a member |
| POST | `/workspace/delete` | Session (Owner) | Delete a workspace |

## Team Member Limits by Plan

| Plan | Max Members (incl. owner) |
|------|--------------------------|
| Free | 1 (no workspace) |
| Pro | 5 |
| Business | Unlimited |

## Invite Flow

```
Owner → POST /workspace/invite { workspaceId, email, role }
  → Find user by email in users.json
  → Check team_members limit for owner's plan
  → Append to workspace.members
  → (Future: send email notification via SendGrid)
```
