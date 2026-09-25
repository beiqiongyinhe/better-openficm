# Changelog

[简体中文](CHANGELOG.md)

> Translation note: this is an English translation of this fork's CHANGELOG.md. The 0.7.0 section was already in English in the original; the remaining sections were Chinese and have been translated.

## 0.7.0 - 2026-08-20

- Moved Agent/Skill and local retrieval models out of the APK. Added startup resource integrity checks, one-click GitHub/Hugging Face download, temporary-file SHA-256 verification and automatic model warm-up.
- Added the original Lorn.NovelWriteSkills distillation Skill and allowlisted references, pinned to commit `5acd34586d5d241193bd36ceed9341f7f482ea3b`; the upstream repository root does not declare a license.
- Added the isolated Lorn style distillation and evolution plugin with per-project style guides and optional FastAPI integration.
- Added persistent assistant retry actions, message copying, and human-readable network errors with expandable details.
- Added JSON and Markdown exports for individual or all character and world-info entries.
- Pinned first-run catalogs to an immutable OpenFicM commit while retaining SHA-256 verification.
- Made edited user-message branch replacement atomic and closed an autosave race that could leave the newest draft unsaved.
- Preserved Gemini thought signatures across tool turns and retained native network failure details for retry diagnostics.
- Hardened release builds against stale Android outputs and fails the build if any local GGUF model is bundled.

## 0.6.0 - 2026-08-19

- Added Markdown export for the current chapter, the current volume and the whole novel.
- The writing page now opens in preview mode by default; tapping Edit enters the body editor.
- Added retrying of the original request after an assistant API failure, without saving the user message twice.
- Added editing of past user messages and re-running the Agent from the edited point.

## 0.5.0 - 2026-08-18

- Refined the Agent run trace, structured questions, tool permissions and the per-project assistant experience.
- Fixed leftover vector index entries after deleting characters and world-book entries, and improved the settings-save failure message.
- Fixed Gemini tool-parameter schema compatibility on mobile.
- Synced the release version number, the Android 9+ minimum and the signing-rotation documentation.

## 0.4.0 - 2026-08-18

- Added a mobile table of contents grouped by volume.
- Added creating, renaming and deleting volumes and chapters.
- Chapter deletions and edits now clean up the full-text and vector indexes in step.
- Updated the Android product name to OpenFicM.
- Added a verifiable local GGUF download flow.
- Completed the open-source licence, third-party notices, signing isolation and mobile CI.
- Corrected the built-in agent's OpenFicM identity and feedback address.
- Replaced the public template private key with a unique release certificate and provided a safe signing-rotation lineage build flow.

## 0.3.0 - 2026-08-17

- Added per-project assistant conversations, model switching and chat history management.
- Imported the PC's built-in skills and agents, with sub-agent collaboration.
- Added oh-story release checks, allowlist updates and rollback.
- Bundled local embedding and reranking models.
- Fixed the character and world-book consistency check after chapter changes.
