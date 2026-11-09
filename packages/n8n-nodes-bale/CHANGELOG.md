# Changelog

All notable changes to `n8n-nodes-bale-ir` are documented here. The project follows
[Semantic Versioning](https://semver.org/).

## 0.1.1

- Updated webhook deregistration to call `setWebhook` with `{ url: '' }` for full compatibility with the Bale Bot API.
- Aligned node type references in `examples/smoke-test.workflow.json` with the `n8n-nodes-bale-ir` package name and enforced strict `@n8n/node-cli` lint compliance.

## 0.1.0

First release.

- Bale node with the resources Bot, Callback Query, Chat, Chat Member, File and Message
  (19 operations).
- Bale Trigger node (webhook) for messages, edited messages and callback queries, with optional
  media download.
- Multipart uploads without any runtime dependency.
- Token normalisation, token redaction in errors and documented size limits checked before upload.
