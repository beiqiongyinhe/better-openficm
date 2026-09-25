# Contributing

[简体中文](CONTRIBUTING.md)

> Translation note: this is an English translation of this fork's CONTRIBUTING.md.

Before filing an issue, search the existing issues first, and remove API keys, tokens and private novel content from logs and screenshots.

Developing for Android:

~~~powershell
cd mobile-rn
npm ci
npm run models:download
npm run type-check
~~~

Requirements for a contribution:

- Keep the change focused and follow the existing TypeScript and React Native patterns
- Use transactions for database writes, and clean up the full-text and vector indexes at the same time
- Do not commit GGUF, APK, keystore, local.properties, environment variables or credentials
- Use Conventional Commits for PR titles, for example feat(writing): add volume management
- Update README or DESIGN.md for any user-visible behaviour change

