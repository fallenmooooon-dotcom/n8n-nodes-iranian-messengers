# Changelog

All notable changes to `n8n-nodes-bale` are documented here. The project follows
[Semantic Versioning](https://semver.org/).

## 0.1.0

First release.

- Bale node with the resources Bot, Callback Query, Chat, Chat Member, File and Message
  (19 operations).
- Bale Trigger node (webhook) for messages, edited messages and callback queries, with optional
  media download.
- Multipart uploads without any runtime dependency.
- Token normalisation, token redaction in errors and documented size limits checked before upload.
