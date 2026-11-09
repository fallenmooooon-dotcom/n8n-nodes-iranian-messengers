---
name: n8n-iranian-messengers
description: Build, configure, debug, and audit n8n community nodes and automation workflows for Iranian messaging platforms including Bale (n8n-nodes-bale-ir), EitaaYar (n8n-nodes-eitaayar), Rubika (n8n-nodes-rubika), and Soroush Plus (n8n-nodes-soroush). Use when the user asks to create or troubleshoot n8n bots, webhooks, polling triggers, Mini Apps (برنامک), file uploads, keyboards, or node packages for Bale, Eitaa, Rubika, or Soroush Plus.
---
# n8n-iranian-messengers

Build, configure, and maintain production-grade n8n workflows and community nodes (`n8n-nodes-bale-ir`, `n8n-nodes-eitaayar`, `n8n-nodes-rubika`, and `n8n-nodes-soroush`) for Iranian messaging platforms with zero runtime dependencies and strict `@n8n/node-cli` compliance.

## When to Use

- Designing or troubleshooting n8n workflows (`workflow.json`) that use Bale, EitaaYar, Rubika, or Soroush Plus nodes.
- Developing, auditing, or extending the `n8n-nodes-bale-ir`, `n8n-nodes-eitaayar`, `n8n-nodes-rubika`, or `n8n-nodes-soroush` community node packages.
- Implementing Soroush Plus Mini App (`برنامک`) flows, including `web_app` launch buttons, `web_app_data` webhook/polling events, and `HMAC-SHA256` signature verification (`verifyInitData`).
- Handling platform-specific differences in Bot APIs, file upload flows (single-step multipart vs. Rubika 3-step upload), text formatting (`HTML`, `Markdown`, `MarkdownV2`, or Rubika UTF-16 `metadata`), and webhook vs. polling triggers.

## Steps

### 1. Select the Target Platform and Package

Identify which messenger and n8n node types apply to the task. Consult `references/api-and-node-reference.md` for full endpoint, resource, operation, and parameter tables.

| Platform | npm Package | n8n Node Types | Base URL | Protocol Family |
| :--- | :--- | :--- | :--- | :--- |
| Bale (`بله`) | `n8n-nodes-bale-ir` | `n8n-nodes-bale-ir.bale`, `n8n-nodes-bale-ir.baleTrigger` | `https://tapi.bale.ai` | Telegram-like (`/bot<token>/<method>`) |
| Soroush Plus (`سروش‌پلاس`) | `n8n-nodes-soroush` | `n8n-nodes-soroush.soroush`, `n8n-nodes-soroush.soroushTrigger`, `n8n-nodes-soroush.soroushPollTrigger` | `https://bot.splus.ir` | Telegram-like + Mini App (`WebAppInfo`) |
| EitaaYar (`ایتایار`) | `n8n-nodes-eitaayar` | `n8n-nodes-eitaayar.eitaaYar` | `https://eitaayar.ir` | Send-only REST (`/api/bot<token>/<method>`) |
| Rubika (`روبیکا`) | `n8n-nodes-rubika` | `n8n-nodes-rubika.rubika`, `n8n-nodes-rubika.rubikaTrigger`, `n8n-nodes-rubika.rubikaPollTrigger` | `https://botapi.rubika.ir` | JSON RPC-style (`/v3/<token>/<method>`) |

### 2. Normalize Credentials and Redact Secrets

1. Strip leading/trailing whitespace and any accidental URL or `bot` prefix from the user token before constructing URLs:
   - Bale and Soroush Plus prepend `bot` in the URL path (`/bot${token}/${method}`).
   - EitaaYar prepends `/api/bot${token}/${method}`.
   - Rubika uses `/v3/${token}/${method}` with no `bot` prefix.
2. Redact the raw bot token (and any one-time upload URLs in Rubika) with `<redacted-token>` or `<redacted-upload-url>` in all thrown `NodeApiError` and `NodeOperationError` messages and descriptions.

### 3. Implement Platform-Specific Messaging and Media Flows

- **Bale (`n8n-nodes-bale-ir`)**:
  - Supports `HTML` and `Markdown` in `parse_mode`.
  - Does NOT support captions on `sendAnimation` or `sendSticker` (hide `caption` for those media types).
  - Enforces a 50 MB pre-upload size check (`MAX_UPLOAD_BYTES`) and 20 MB download limit (`MAX_DOWNLOAD_BYTES`).
  - Deregisters webhooks on trigger deactivation by calling `setWebhook` with `{ url: '' }`.
- **Soroush Plus (`n8n-nodes-soroush`)**:
  - Supports `HTML`, `Markdown`, and `MarkdownV2` in `parse_mode`.
  - Supports `caption` on `sendPhoto`, `sendAudio`, `sendDocument`, `sendVideo`, `sendAnimation`, and `sendVoice` (only `sticker` has no caption).
  - Supports `horizontal_accuracy` (`0` to `1500` meters) on `sendLocation`.
  - Mini App (`miniApp` resource):
    - `sendMiniAppButton`: Sends an inline keyboard (`inline_keyboard`) or reply keyboard (`keyboard`) button containing `web_app: { url: miniAppUrl }` (requires `https://`).
    - `verifyInitData`: Validates `window.Soroush.WebApp.initData` by parsing URL query params, sorting all keys except `hash` alphabetically (`key=value` joined by `\n`), computing `secretKey = HMAC_SHA256(key="WebAppData", data=botToken)`, and checking `HMAC_SHA256(key=secretKey, data=dataCheckString) === hash`, plus verifying `auth_date` against `maxAgeSeconds`.
  - Webhooks require `https://` on ports `443`, `80`, `88`, or `8443`.
- **EitaaYar (`n8n-nodes-eitaayar`)**:
  - Outbound-only gateway (`getMe`, `sendMessage`, `sendFile`). There is no webhook or polling API in EitaaYar.
  - Supports `title`, `date` (Unix timestamp scheduling), `pin` (`1`/`0`), `disable_notification` (`1`/`0`), `reply_to_message_id`, and `viewCountForDelete` (auto-delete after N views).
  - Enforces a 50 MB upload size limit.
- **Rubika (`n8n-nodes-rubika`)**:
  - Uses `status: "OK"` envelopes (`{ status: "OK", data: { ... } }`) instead of `{ ok: true, result: ... }`.
  - Converts inline formatting markers into UTF-16 `metadata.meta_data_parts` (`Bold`, `Italic`, `Underline`, `Strike`, `Mono`, `Spoiler`, `Quote`, `Link`) where emojis count as 2 UTF-16 code units.
  - Uploads binary files in 3 steps:
    1. `requestSendFile` with `{ type: File | Image | Voice | Music | Gif | Video }` to obtain `upload_url`.
    2. Multipart `POST` of binary buffer to `upload_url` (`file` field) to receive `file_id`.
    3. `sendFile` with `chat_id`, `file_id`, and optional `text` / keypads.
  - Enforces per-type upload limits: `Image` 10 MB, `Voice`/`Music`/`Gif`/`Video` 50 MB, `File` 100 MB.
  - Registers webhook endpoints via `updateBotEndpoints` (`ReceiveUpdate` for messages/queries and `ReceiveInlineMessage` for inline keypad presses).

### 4. Enforce `@n8n/node-cli` Strict Build and Lint Rules

When modifying or creating TypeScript files in any n8n community node package:

1. Keep `"dependencies"` absent from `package.json` (`strict: true` requires zero runtime dependencies). Build multipart bodies (`buildMultipartBody`) and cryptographic primitives (`hmacSha256`) using `Buffer` directly without importing restricted Node built-ins (`node:crypto`, `node:fs`, `node:path`).
2. Follow `@n8n/node-cli` ESLint rules for `INodeProperties`:
   - Do NOT end `description` strings with a trailing period (`.`), unless the description contains multiple sentences.
   - Sort `options` arrays alphabetically by `name` whenever an option list has 5 or more entries (or keep them consistently sorted).
   - Use Sentence case for `displayName` and `name` labels in options.
   - Avoid duplicate `name` definitions with incompatible `default` values unless non-overlapping `displayOptions` cleanly partition them.
3. Run the verification suite before publishing or finishing changes:

```bash
npm test && npm run build && npm run lint
```

## Gotchas

- **Bale Package Name in Workflows**: The npm package for Bale is `n8n-nodes-bale-ir` (not `n8n-nodes-bale`). Always use `"type": "n8n-nodes-bale-ir.bale"` and `"type": "n8n-nodes-bale-ir.baleTrigger"` in n8n workflow JSON files.
- **Restricted Imports in n8n Cloud Strict Mode**: Importing `crypto` or `node:crypto` inside node files fails `@n8n/node-cli` lint (`@n8n/community-nodes/no-restricted-imports`). Use the pure `Buffer`-based `hmacSha256` implementation in `nodes/Soroush/helpers.ts`.
- **Soroush Poll Trigger Initial Offset**: Initialize `maxUpdateId` to `lastOffset ?? -1` (not `0`) so `update_id: 0` is still processed and updates with `update_id <= lastOffset` are skipped.
- **Rubika Envelope Variations**: Rubika's step-2 file upload endpoint (`upload_url`) can return either `{ status: "OK", data: { file_id: "..." } }` or a flat `{ file_id: "..." }` object. Always support both shapes.
