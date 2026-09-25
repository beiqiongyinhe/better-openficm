# Better OpenFicM Android

[简体中文](README.md)

> Translation note: this is an English translation of this fork's mobile-rn/README.md.

This is the React Native Android project of Better OpenFicM. The app does not depend on a PC backend: business data is stored in on-device SQLite, and API keys are kept in Android SecureStore.

For end-user instructions on installation, model configuration, the Agent, styles, export and troubleshooting, see the [Android user guide](../docs/USER_GUIDE_EN.md); for what changed in 0.7.3, see the [release notes](../docs/releases/v0.7.3_EN.md).

## Development

~~~powershell
npm ci
npm run type-check
powershell -ExecutionPolicy Bypass -File scripts/build-release.ps1
~~~

Model files are not committed to Git and are not bundled into the APK. On first launch the app downloads the following files from Hugging Face into the app's private directory and verifies their size and SHA-256:

- bge-small-zh-v1.5-q4_k_m.gguf
- bge-reranker-base-q4_k_m.gguf

The release build script first cleans the android/app/build output directory and inspects the APK before finishing; if any GGUF entry is found it fails immediately, so stale incremental resources cannot be published by mistake.

## Release signing

The official build reads a private key from outside the repository through the following environment variables:

- OPENFICM_RELEASE_STORE_FILE
- OPENFICM_RELEASE_STORE_PASSWORD
- OPENFICM_RELEASE_KEY_ALIAS
- OPENFICM_RELEASE_KEY_PASSWORD
- OPENFICM_RELEASE_LINEAGE_FILE (only needed for key rotation)
- OPENFICM_RELEASE_LEGACY_STORE_FILE (required when using a lineage)
- OPENFICM_RELEASE_LEGACY_STORE_PASSWORD (required when using a lineage)
- OPENFICM_RELEASE_LEGACY_KEY_ALIAS (required when using a lineage)
- OPENFICM_RELEASE_LEGACY_KEY_PASSWORD (required when using a lineage)

A release build fails immediately if the first four are missing; when a lineage is used the four legacy signer settings must also be provided, otherwise the build fails explicitly. For local manual installation testing use `npm run android:apk:debug`, which builds a `standalone` APK with the JS bundled in and no Metro, using the debug certificate. That APK must not be used for a release, and keystores, passwords, signing rotation lineages, APKs and GGUF files must never be committed.

## Network boundaries

- Model APIs: connects only to the provider address configured by the user
- Model discovery: reads the provider's model list
- Runtime resources: fetched from OpenFicM GitHub, oh-story GitHub Release, a pinned commit of Lorn.NovelWriteSkills and Hugging Face; downloads never execute remote scripts or hooks
- oh-story updates: reads only official releases and allowlist Markdown, bound to an immutable commit/tree SHA

## Style workflow

- The style library accepts TXT, Markdown and EPUB; the original file and the normalised text are kept in the app's private directory.
- Distillation sends only distributed sampled text to the user's configured default model; the full reference book is never uploaded.
- Reference styles can be picked across works; author styles are stored as several versions per work. The assistant asks before generating body text if no style has been chosen yet, and the writing page and assistant page can also switch styles directly.
- When the Agent creates or rewrites a chapter it saves the AI draft together with the style used; after the author edits it, a new author-style version can be generated from the writing page.
- The Android runtime does not use FastAPI, a server address, Socket.IO or a PC backend.

See DESIGN.md for the detailed architecture and ../THIRD_PARTY_NOTICES.md for third-party notices.
