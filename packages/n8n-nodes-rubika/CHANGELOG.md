# Changelog

All notable changes to `n8n-nodes-rubika` are documented here. The project follows
[Semantic Versioning](https://semver.org/).

## 0.1.1

- Standardised credential, action node, and trigger descriptions for strict `@n8n/node-cli` lint compliance.

## 0.1.0

First release.

- Rubika node with the resources Bot, Chat, Chat Member, File and Message (17 operations),
  including the three-step file upload, text formatting and keypad validation.
- Rubika Trigger node (webhook) and Rubika Poll Trigger node (`getUpdates`).
- Multipart uploads without any runtime dependency.
- Token redaction in errors and documented size limits checked before upload.
