<div align="center">

# Better OpenFicM

**A local-first Android app for writing fiction on your phone**

[![Release](https://img.shields.io/github/v/release/beiqiongyinhe/better-openficm?label=release&color=2e7d5b)](https://github.com/beiqiongyinhe/better-openficm/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/beiqiongyinhe/better-openficm/total?color=2e7d5b)](https://github.com/beiqiongyinhe/better-openficm/releases)
[![Android](https://img.shields.io/badge/Android-9.0%2B-3ddc84?logo=android&logoColor=white)](https://github.com/beiqiongyinhe/better-openficm/releases/latest)
[![ABI](https://img.shields.io/badge/ABI-arm64--v8a-blue)](https://github.com/beiqiongyinhe/better-openficm/releases/latest)
[![License](https://img.shields.io/badge/License-Apache--2.0-lightgrey)](LICENSE)

[Download](#download) · [User guide (Chinese)](docs/USER_GUIDE.md) · [Changelog](docs/releases) · [Build from source](#build-from-source)

[简体中文](README.md)

</div>

---

Better OpenFicM is an Android adaptation of [OpenFic](https://github.com/syrizelink/OpenFic) rebuilt with React Native, Expo SQLite, and an **on-device Agent runtime**. The installed APK needs no PC, FastAPI, Socket.IO, or Metro.

> This is an independently maintained derivative project, not an official OpenFic Android client. The app interface and documentation are in Simplified Chinese.

---

## 🔧 This repository is a community-modified build (better-openficm)

- Modified from upstream [tioners/OpenFicM](https://github.com/tioners/OpenFicM) at commit `c5619630`. **Not an official release.**
- Copyright in the original design, code, and content belongs to upstream [OpenFicM](https://github.com/tioners/OpenFicM) and [OpenFic](https://github.com/syrizelink/OpenFic); this repository continues to be released under Apache-2.0 and keeps the upstream `LICENSE`, `NOTICE`, and `THIRD_PARTY_NOTICES.md`.
- The main changes are listed in [Changes in this modified build](#changes-in-this-modified-build) at the end of this document.

> ⚠️ **This build is signed with a certificate different from the upstream official build**: `ff68431a9d797589a0f6034848dc1c34ae4e3acba878d5183b5afe941f08a837`
> A device with the upstream official build installed **cannot install this build on top of it** — uninstall the official build first. Uninstalling wipes local project data, so export everything before you do.

## What it solves

Most mobile AI writing tools are chat wrappers: they generate text, but you have to keep track of your own project material, characters, and world rules — and paste them back into the prompt yourself.

Better OpenFicM ports the desktop Agent system to the phone. The agent reads your chapters, characters, and world entries, writes back to them under permissions you control, and can delegate to sub-agents. Your work stays on the device; the network is used only when you actually call a model.

## Download

Get the APK from [Releases](https://github.com/beiqiongyinhe/better-openficm/releases/latest) and install it directly. When upgrading, install over the old version — do not uninstall first.

| Requirement | Android 9.0 or newer |
| --- | --- |
| ABI | arm64-v8a only (mainstream 64-bit phones) |
| APK size | ~127 MB |
| Signing certificate SHA-256 | `ff68431a9d797589a0f6034848dc1c34ae4e3acba878d5183b5afe941f08a837` |

> The fingerprint above is this modified build (better-openficm). The upstream official build is signed with `c5dd7c04…63`; the two differ, so they cannot be installed over each other.

Download only from this project's Releases. A signature conflict usually means the installed package uses a different certificate; uninstalling clears local projects, so export first.

## Quick start

1. **First launch** — tap the one-tap fetch button to download and verify Agents/Skills and the local retrieval models (~225 MB, from GitHub and Hugging Face).
2. **Configure a model** — Settings → Models & Providers. Enter a Base URL and API Key, fetch the model list, then set a default model. OpenAI-compatible, Google Gemini, and Anthropic protocols are supported.
3. **Start writing** — create a project on the shelf, then describe your task in the assistant.

Full steps: [Android user guide](docs/USER_GUIDE.md) (Chinese).

## Core capabilities

### A real agent, not a chat box

The agent activates Skills per task, calls local tools, reads the current project's data, delegates to sub-agents, and updates chapters, characters, and world entries under the permissions you set. A live trace shows every tool call and result.

Tool permissions have three levels: allow / ask every time / deny. Write-capable tools are best left on "ask".

### Somewhere to keep the outline

Beyond chapters, characters, and world entries there is a fourth category: outlines, plot direction, foreshadowing lists — things that **haven't happened in the text yet**. Put them in the world entries and the agent treats them as established canon.

Notes attach to the book's existing structure at three levels: whole book for the overall outline, volume for that volume's arc and foreshadowing, chapter for what a specific chapter must achieve. Notes can move between levels — a memo that only affects one chapter can be promoted to volume level once you realise the whole volume needs it. Deleting a chapter or volume asks whether to keep or remove its notes; keeping them promotes them one level up.

The agent can read and write notes, but only note titles go into the prompt — content is fetched on demand, so a large note collection does not slow down every turn.

### Style pipeline

| Concept | Source | Scope |
| --- | --- | --- |
| Reference book | TXT / Markdown / EPUB you import | Global library |
| Reference style | Constraints distilled from a reference book | Across projects |
| Author style | Learned from the diff between AI draft and your final edit | Current project only |

Reference-style distillation runs in **repeatable rounds**: each round reads 24 consecutive chapters, and tapping again advances forward through the book, merging new evidence into the existing guide rather than starting over. The full novel is never uploaded — only the current window's samples.

Author style works the other way: the agent writes a chapter, you edit it your way, then tap "evolve author style" and the model compares the two versions to extract your personal voice.

### Local first

Projects, chapters, characters, world entries, chat history, style versions, and the search index all live in the app's private directory. API keys are stored in Android SecureStore, never in SQLite. Chinese embedding and reranking models run on the phone's CPU, so semantic search needs no external vector database.

Only when you initiate a model request does the app send the context needed for that task to the provider you configured.

### Mobile-shaped editing

Chapters open in preview mode to avoid mis-taps; tap edit to type. Autosave, background save, keyboard avoidance, and a volume/chapter outline grouped by volume are built in. Export a chapter, a volume, or the whole novel as Markdown through the Android share sheet.

The assistant supports multiple sessions, per-session model selection, editing past messages to re-run, and persistent retry with expandable raw error details.

## Full feature list

<details>
<summary>Expand to view</summary>

**Shelf and writing**

- Local shelf with volume grouping; create, rename, and delete chapters
- Preview-first editing, autosave, background save, keyboard avoidance
- Export a chapter / the current volume / the whole novel as Markdown through the system share sheet

**Assistant and Agent**

- Per-project isolated sessions with per-session model selection
- Structured questions, live trace, tool permission approval
- Sub-agent delegation, decided by the model per task
- A 24-model-request budget shared per conversation, to avoid saturating relay rate limits
- Persistent retry of failed tasks, editing past messages to re-run, copying and regenerating finished messages

**Data and retrieval**

- Local character library and world entries, exportable one by one or in bulk as JSON / Markdown
- Three-level notes (whole book / volume / chapter) that can move between levels; deleting a container offers to keep or remove them
- Full-text search + Chinese embedding semantic index + reranker precision pass
- Consistency checks for characters and world entries after chapters change

**Style system**

- TXT / Markdown / EPUB import, compatible with UTF-8, UTF-16, GB18030/GBK
- Reference-style distillation following the Lorn method, with multi-round continuation and resumable runs
- AI drafts linked to author final edits, with project-level author-style version evolution
- Style selected and injected dynamically from the assistant and writing pages

**Models and settings**

- OpenAI-compatible / Google Gemini / Anthropic protocols
- Fetch the model list from the provider API, searchable by name or ID
- Output truncation detection: when a reasoning model hits the ceiling, the app tells you to raise the max output tokens
- Compatibility fix for Gemini functionDeclaration parameter schemas
- Nine setting groups: general, connection, index, context, tool permissions, rules, skills, agents, advanced
- Check for app updates and oh-story content pack updates under advanced settings

</details>

## Security and privacy boundaries

- API keys live in Android SecureStore, not in plaintext SQLite.
- The APK ships no GGUF models, Agents/Skills, or catalogs; they are fetched on first launch from pinned sources and verified by size and SHA-256.
- Remote content is read from an allowlist of Markdown files pinned to immutable commits. Remote hooks, scripts, and Git configuration are never executed.
- HTTP Base URLs are allowed so self-hosted providers work; prefer HTTPS across networks.
- Uninstalling deletes local data. There is no cloud sync.

## Build from source

Requires Node.js 22, Java 17, the Android SDK, and PowerShell.

~~~powershell
cd mobile-rn
npm ci
npm run type-check
powershell -ExecutionPolicy Bypass -File scripts/build-release.ps1
~~~

For local testing use `npm run android:apk:debug`, which produces a `standalone` APK with bundled JS and a debug certificate. **Never publish that build.**

<details>
<summary>Release signing and key rotation</summary>

Release builds require four environment variables: `OPENFICM_RELEASE_STORE_FILE`, `OPENFICM_RELEASE_STORE_PASSWORD`, `OPENFICM_RELEASE_KEY_ALIAS`, `OPENFICM_RELEASE_KEY_PASSWORD`. Without all four, `app/build.gradle` refuses `assembleRelease` — a deliberate guard against shipping a debug-signed build.

The build script clears the generated `android/app/build` directory first and rejects any GGUF entry before copying artifacts, so stale incremental resources cannot re-enter the APK.

Key rotation additionally requires the previous signer's `OPENFICM_RELEASE_LEGACY_STORE_FILE`, `OPENFICM_RELEASE_LEGACY_STORE_PASSWORD`, `OPENFICM_RELEASE_LEGACY_KEY_ALIAS`, and `OPENFICM_RELEASE_LEGACY_KEY_PASSWORD` alongside `OPENFICM_RELEASE_LINEAGE_FILE`. The script uses the old and new signers from the lineage file to write and verify the signature inheritance chain. Unset the lineage variable when no legacy signer is configured.

GGUF files, APKs, signing material, and local.properties stay out of Git. Pinned sources and hashes are in `mobile-rn/src/settings/remote-resources.ts`.

Output: `OpenFicM-Android-<version>.apk`

</details>

## Repository layout

| Path | Purpose |
| --- | --- |
| `mobile-rn` | The Better OpenFicM Android app |
| `docs` | User guide, release notes, project handover record |
| `backend`, `frontend`, `desktop` | Retained OpenFic upstream sources and compatibility fixes, kept for provenance |
| `THIRD_PARTY_NOTICES.md` | Third-party project, content, and model notices |

## Credits

- [syrizelink/OpenFic](https://github.com/syrizelink/OpenFic) — original project, product design, and desktop Agent system, Apache-2.0
- [worldwonderer/oh-story-claudecode](https://github.com/worldwonderer/oh-story-claudecode) — writing Skills and sub-agent content, MIT
- [lornshrimp/Lorn.NovelWriteSkills](https://github.com/lornshrimp/Lorn.NovelWriteSkills) — reference-style distillation method and allowlisted material; the pinned upstream commit declares no license at the repository root, see the third-party notices
- [BAAI/bge-small-zh-v1.5](https://huggingface.co/BAAI/bge-small-zh-v1.5) and [BAAI/bge-reranker-base](https://huggingface.co/BAAI/bge-reranker-base) — local retrieval models

## Community

- [Linux Do](https://linux.do)

## License

Project code is released under the [Apache License 2.0](LICENSE). Third-party content remains under its own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

## Changes in this modified build

Baseline: upstream [tioners/OpenFicM](https://github.com/tioners/OpenFicM) commit `c5619630`.
This repository adds the following enhancements on top of it (`git diff upstream/main`, 30 files, +1952 / −249, including 5 new files).

### New: import works from local files on the phone

Upstream's project page only lets you create an empty project by hand and paste chapters in one by one. This build turns "import" into a proper feature: tap **New or import project** at the top of the project page and pick a file from your phone.

- Supports **TXT / Markdown / EPUB**, up to 50 MB per file
- Parses by **volume / chapter structure** instead of cutting by character count:
  - EPUB reads the spine segments and page boundaries, giving the most accurate volume and chapter boundaries
  - TXT / Markdown rely on heading levels
- Reports "Imported 《X》, N chapters in total" when finished
- Project name prefers the title inside the document, falls back to the file name, then to "Untitled project"

**Measured results** (real device database, three long novels):

| Work | Volumes | Chapters | Result |
| --- | --- | --- | --- |
| 遭银龙王女变成幼龙姬的我 (turned into a dragon girl by the Silver Dragon Queen) | 9 | 774 | Volume names correct character by character; 100/144/114/76/76/104/99/28/33 per volume |
| 恶役少爷怎么可能会是圣女？ (how could the villainous young master be a saint?) | 2 | 270 | Correct |
| 她们认清感情，骑士却已转生幼狐 (they realised their feelings, but the knight had reincarnated as a young fox) | 4 | 317 | Correct |

None of the three had empty chapters, duplicate chapters, or "Chapter 1 (1)"-style fragment naming.

> Note: short author-notice chapters from the source text ("Note", "Changed", and the like) are not filtered out automatically, to avoid cutting real chapters by mistake.

### New: project covers

- Pick a cover for each project; the image is copied into the app's private directory
- Replacing a cover cleans up the old image, leaving no leftovers
- Without a cover, the app falls back to a placeholder built from the first character of the title
- Older project libraries are migrated automatically by adding a column; **existing projects and text are not lost**

### New: project organising

- **Edit** — rename a project and change its description directly
- **Sort** — move projects up and down in the list to match your own habits
- **Merge** — merge one project into another (with a clear warning first: the merged-in project is deleted, and its chapters, characters, world entries, and notes are not migrated automatically)

### New: assistant conversation attachments

- Attach files from the phone inside a conversation; the content really enters the model context
- Up to 50 MB per file, with an 8,000,000-character cap on extracted text
- An over-long attachment is truncated at 20,000 characters when it enters the prompt, marked "(attachment too long, truncated)"

### Assistant page UX improvements

- **Long replies collapsed** — messages over 600 characters fold to 12 lines by default, with one tap to expand or collapse
- **Conversation progress bar** — drag on the right edge to jump anywhere
- **Back to bottom** — a button appears once you scroll away from the bottom, returning you there in one tap
- **Edit and resend** — edit a sent message and the conversation branches again from that point

### Settings page enhancements

- **Model parameters editable / deletable** — change the name, model ID, temperature, or max output of an existing model, or delete configurations you no longer use
  - Temperature must be between 0 and 2; max output must be an integer (note: 1M is usually the context window, do not enter 1000000)
  - Edits do not affect the currently selected model
- **Back key takeover on category pages** — inside a settings category page, the system back key returns to the settings list instead of exiting the app; gesture back works the same way, real routed pages (such as "Author style → Style library") are covered too, and root pages like the shelf still exit normally

### Other

| Area | Description |
| --- | --- |
| Unified text extraction | TXT / Markdown / EPUB extraction is consolidated into one module, `lib/text-extract.ts`; the duplicate implementation in `style/source-library.ts` (including duplicated size / character limit constants) was removed, shrinking that file from 414 to 231 lines |
| Icon / splash | App icon and splash screen reworked, with a markedly smaller footprint |
| Dependency lock | `package-lock.json` updated in step, `.gitignore` additions |
