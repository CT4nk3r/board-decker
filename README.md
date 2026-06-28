# Deck

A fast, native **desktop board over Azure DevOps work items**. Linear/Trello-style
UX, but ADO stays the single source of truth — no separate database, no sync service.
Deck reads and writes ADO directly.

> Status: **MVP (M0–M3)** — onboarding, board, drag-to-change-state, detail/edit,
> create, and scope filters all work two-way against ADO.

## Stack

- **Shell:** Tauri v2 (Rust) — small native binary, secure token storage, no CORS.
- **Frontend:** React 19 + TypeScript + Vite 7.
- **UI:** Tailwind CSS v4 + custom shadcn-style primitives (Radix) + lucide icons.
- **Data:** TanStack Query (fetch + cache + optimistic updates).
- **Board DnD:** dnd-kit. **UI state:** Zustand.

## Architecture

Azure DevOps REST sends no permissive CORS headers, so the webview can't call it
directly. Every ADO call is routed through Rust:

```
React UI ──invoke──▶ Rust `ado_request(method, url, body, contentType)`
   ▲                      │  attaches Authorization: Basic base64(":"+PAT) from the OS keychain
   └──── work items ──────┘  reqwest ▶ https://dev.azure.com/{org}/{project}/_apis/wit/...
```

- The **PAT lives in the OS keychain** (Rust `keyring` crate) and is attached
  server-side — it never touches JavaScript.
- The TypeScript layer builds ADO URLs/bodies and invokes the Rust command.
- Onboarding validates credentials with `ado_request_with_pat` *before* the PAT is
  persisted with `save_pat`.

### Rust commands (`src-tauri/src/lib.rs`)
| command | purpose |
| --- | --- |
| `save_pat` / `has_pat` / `delete_pat` | keychain PAT lifecycle |
| `ado_request` | authenticated ADO call using the stored PAT |
| `ado_request_with_pat` | onboarding validation with an inline PAT |

## Features

- **Onboarding:** org / project / (optional) team / PAT → validate (`GET _apis/projects`) → store in keychain.
- **Board:** columns = ADO states (unioned across the project's work-item types, ordered by state category); cards = work items.
- **Drag-to-change-state:** PATCH `System.State` with optimistic update + rollback toast on failure.
- **Scopes/filters:** assigned-to-me, active, recently changed, created-by-me, all, plus a **sprint picker** from team iterations. Client-side search.
- **Detail panel:** title, description (HTML), state, priority, assignee, tags, iteration, parent, linked PRs/branches, and comments — editable via JSON-Patch `PATCH`.
- **Create work item:** type + title + description + priority + tags → `POST _apis/wit/workitems/$type`.

## ADO layer reuse

The `src/lib/ado/` modules port logic from the `ado-plane-sync` project:
WIQL scope presets (`wiql.ts`), the work-item field mapper (`mapper.ts`), and the
REST client shape (`client.ts`) — adapted to invoke Rust instead of calling axios.

## Develop

Prerequisites: Node ≥ 18 and the Rust toolchain (`https://rustup.rs`).

```bash
npm install
npm run tauri dev      # run the desktop app (hot reload)
npm run tauri build    # produce a distributable bundle
npm run build          # type-check + build the frontend only
```

Cross-platform: Tauri builds macOS, Windows, and Linux from this one codebase.

## CI & Releases

GitHub Actions builds the Tauri app on every push/PR and publishes installers on tags
(`.github/workflows/`):

- **`ci.yml`** — on push/PR to `master`: type-checks and builds the frontend, then
  builds the native app on **macOS (Apple Silicon + Intel universal)**, **Windows (x64 +
  ARM64)**, and **Linux (x64 + ARM64)**. The resulting bundles are uploaded as workflow
  artifacts (7-day retention).
- **`release.yml`** — on a `v*` tag: builds all three platforms with
  [`tauri-action`](https://github.com/tauri-apps/tauri-action) and publishes the installers
  to a **GitHub Release**. Cut one by tagging:

  ```bash
  # keep "version" in src-tauri/tauri.conf.json in sync with the tag, then:
  git tag v0.1.0 && git push origin v0.1.0
  ```

  The release is published automatically once all platforms finish. Builds are unsigned by
  default; add Apple/Windows signing secrets (see the commented `env` block in
  `release.yml`) to sign.
