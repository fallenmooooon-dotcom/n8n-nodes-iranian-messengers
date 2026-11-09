# Iranian Messengers n8n Nodes - API & Implementation Reference

This reference documents the exact architecture, API specifications, node parameters, error codes, and security invariants across the four packages in `n8n-nodes-iranian-messengers` (`v0.1.1`).

## 1. Monorepo & Package Overview

- **Repository**: `https://github.com/fallenmooooon-dotcom/n8n-nodes-iranian-messengers`
- **Node Engine**: `>=20.19`
- **n8n API Version**: `n8nNodesApiVersion: 1`, `strict: true`
- **Zero Runtime Dependencies**: All 4 packages ship zero `"dependencies"` in `package.json` to qualify for n8n Cloud verification. Multipart encoding, UTF-16 offset calculation, and SHA-256 / HMAC-SHA256 are implemented in pure TypeScript using `Buffer`.

| Package Name | Directory | Credential Name | Nodes Included |
| :--- | :--- | :--- | :--- |
| `n8n-nodes-bale-ir` | `packages/n8n-nodes-bale` | `baleApi` | `bale`, `baleTrigger` |
| `n8n-nodes-eitaayar` | `packages/n8n-nodes-eitaayar` | `eitaaYarApi` | `eitaaYar` |
| `n8n-nodes-rubika` | `packages/n8n-nodes-rubika` | `rubikaApi` | `rubika`, `rubikaTrigger`, `rubikaPollTrigger` |
| `n8n-nodes-soroush` | `packages/n8n-nodes-soroush` | `soroushApi` | `soroush`, `soroushTrigger`, `soroushPollTrigger` |

## 2. Soroush Plus (`n8n-nodes-soroush`)

- **Official Documentation**:
  - Bot Platform: `https://soroushplus.com/p/documents`
  - Mini App (`برنامک`): `https://soroushplus.com/p/documents/mini-app`
- **Default Base URL**: `https://bot.splus.ir`
- **URL Pattern**: `${baseUrl}/bot${token}/${method}` and `${baseUrl}/file/bot${token}/${filePath}`
- **Webhook Constraints**: Must use `https://` and one of the allowed ports: `443`, `80`, `88`, or `8443`.
- **Upload / Download Limits**:
  - Pre-upload check: `50 MB` (`MAX_UPLOAD_BYTES = 50 * 1024 * 1024`)
  - Download check: `20 MB` (`MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024`)

### Resources & Operations (`n8n-nodes-soroush.soroush`)

1. **`bot`**:
   - `getMe` (`GET / getMe`)
2. **`message`**:
   - `sendText` (`sendMessage`): `chatId`, `text`, `additionalFields` (`parse_mode`: `HTML` | `Markdown` | `MarkdownV2` | `None`, `disable_web_page_preview`, `disable_notification`, `reply_to_message_id`, `replyMarkup`).
   - `sendMedia` (`sendPhoto`, `sendAudio`, `sendDocument`, `sendVideo`, `sendAnimation`, `sendVoice`, `sendSticker`): Supports `binaryData` (multipart upload) or `fileIdOrUrl` (JSON body). `caption` and `parse_mode` are supported on all media types except `sticker`.
   - `sendLocation` (`sendLocation`): `chatId`, `latitude` (`-90..90`), `longitude` (`-180..180`), `additionalFields` (`horizontal_accuracy` `0..1500` meters, `reply_to_message_id`, `disable_notification`, `replyMarkup`).
   - `sendContact` (`sendContact`): `chatId`, `phoneNumber`, `firstName`, `additionalFields` (`last_name`, `vcard`, `reply_to_message_id`, `disable_notification`, `replyMarkup`).
   - `forward` (`forwardMessage`), `copy` (`copyMessage`), `editText` (`editMessageText`), `delete` (`deleteMessage`).
3. **`miniApp`**:
   - `sendMiniAppButton` (`sendMessage`): Sends a message with a button containing `web_app: { url: miniAppUrl }`. Supports `keyboardKind: 'inline'` (`inline_keyboard`) or `'reply'` (`keyboard` with `resize_keyboard: true`), plus `additionalFields` (`parse_mode`, `disable_web_page_preview`, `disable_notification`, `reply_to_message_id`).
   - `verifyInitData` (Local cryptographic verification, no HTTP call):
     - Input parameters: `initDataRaw` (raw `window.Soroush.WebApp.initData` query string) and `maxAgeSeconds` (default `86400`, `0` disables expiry check).
     - Algorithm:
       1. Parse URL query parameters from `initDataRaw` and extract `hash` (64-char hex).
       2. Sort remaining key-value pairs alphabetically by key and join with `\n` as `key=value` to form `dataCheckString`.
       3. Compute `secretKey = HMAC_SHA256(key = "WebAppData", message = botToken)`.
       4. Compute `computedHash = HMAC_SHA256(key = secretKey, message = dataCheckString).toString('hex')`.
       5. Compare `computedHash` and `hash` in constant time (`constantTimeEqualHex`).
       6. Parse JSON fields (`user`, `chat`, `receiver`) and return `{ valid: true, auth_date, user, chat, query_id, start_param, ... }`.
4. **`callbackQuery`**:
   - `answer` (`answerCallbackQuery`): `callbackQueryId`, `additionalFields` (`text`, `show_alert`, `url`, `cache_time`).
5. **`file`**:
   - `get` (`getFile` + optional binary download from `/file/bot<token>/<file_path>`).
6. **`chat`**:
   - `get` (`getChat`), `getMemberCount` (`getChatMembersCount`), `leave` (`leaveChat`), `pinMessage` (`pinChatMessage`), `unpinMessage` (`unpinChatMessage`), `unpinAllMessages` (`unpinAllChatMessages`).
7. **`chatMember`**:
   - `ban` (`banChatMember`), `unban` (`unbanChatMember`).

### Triggers (`n8n-nodes-soroush.soroushTrigger` & `soroushPollTrigger`)

- **Supported Update Kinds**: `message`, `edited_message`, `channel_post`, `edited_channel_post`, `callback_query`, `web_app_data` (detected when `update.message.web_app_data` is present; also attaches parsed `web_app_data_parsed` to the output item).
- **Webhook Deregistration**: Calls `deleteWebhook` with `{ drop_pending_updates: false }`.
- **Polling State**: Stores `lastOffset` in `getWorkflowStaticData('node')` and calls `getUpdates` with `offset = lastOffset + 1`.

## 3. Bale (`n8n-nodes-bale-ir`)

- **Official Documentation**: `https://docs.bale.ai/`
- **Default Base URL**: `https://tapi.bale.ai`
- **URL Pattern**: `${baseUrl}/bot${token}/${method}` and `${baseUrl}/file/bot${token}/${filePath}`
- **Node Types**: `n8n-nodes-bale-ir.bale`, `n8n-nodes-bale-ir.baleTrigger`
- **Key Differences vs. Soroush Plus**:
  - `parse_mode` supports `HTML` and `Markdown` only.
  - `sendAnimation` and `sendSticker` do not accept a `caption` parameter in Bale.
  - Webhook deletion in `BaleTrigger.node.ts` calls `setWebhook` with `{ url: '' }`.
  - Resources & Operations (19 total):
    - `bot`: `getMe`
    - `message`: `sendText`, `sendMedia` (`photo`, `audio`, `document`, `video`, `animation`, `voice`, `sticker`), `sendLocation`, `sendContact`, `forward`, `copy`, `editText`, `delete`
    - `callbackQuery`: `answer`
    - `file`: `get`
    - `chat`: `get`, `getMemberCount`, `leave`, `setTitle`, `setDescription`, `pinMessage`, `unpinMessage`, `unpinAllMessages`
    - `chatMember`: `get`, `ban`, `unban`

## 4. EitaaYar (`n8n-nodes-eitaayar`)

- **Official Documentation**: `https://eitaayar.ir/assets/download/API_eitaayar.ir.pdf`
- **Default Base URL**: `https://eitaayar.ir`
- **URL Pattern**: `${baseUrl}/api/bot${token}/${method}`
- **Node Type**: `n8n-nodes-eitaayar.eitaaYar`
- **Resources & Operations**:
  - `bot`: `getMe`
  - `message`:
    - `sendText` (`sendMessage`): `chatId` (channel `@username` or numeric ID from EitaaYar dashboard), `text`, `additionalFields` (`title`, `date` ISO or Unix seconds, `pin` boolean -> `1`/`0`, `disable_notification` boolean -> `1`/`0`, `reply_to_message_id`, `viewCountForDelete`).
    - `sendFile` (`sendFile`): Multipart upload (`file` field + form fields `chat_id`, `caption`, `title`, `date`, `pin`, `disable_notification`, `reply_to_message_id`, `viewCountForDelete`). Max size: `50 MB`.

## 5. Rubika (`n8n-nodes-rubika`)

- **Official Documentation**: `https://rubika.ir/botapi/methods`
- **Default Base URL**: `https://botapi.rubika.ir`
- **URL Pattern**: `${baseUrl}/v3/${token}/${method}`
- **Node Types**: `n8n-nodes-rubika.rubika`, `n8n-nodes-rubika.rubikaTrigger`, `n8n-nodes-rubika.rubikaPollTrigger`
- **Response Envelope**: `{ status: "OK", data: { ... } }` or `{ status: "ERROR_...", dev_message: "..." }`.
- **Upload Size Limits**:
  - `Image`: `10 MB`
  - `Voice`, `Music`, `Gif`, `Video`: `50 MB`
  - `File`: `100 MB`
- **Resources & Operations (17 total)**:
  - `bot`: `getMe`, `setCommands`, `updateEndpoints`
  - `message`: `sendText` (with `formatting`: `'none'` | `'markdown'` | `'html'` | `'raw'` producing `metadata.meta_data_parts`), `sendFile` (3-step upload or existing `file_id`), `sendPoll`, `sendLocation` (coordinates formatted as strings), `sendContact`, `forward`, `editText`, `editKeypad` (`inline` or `chat`), `delete`
  - `chat`: `get`, `pinMessage`, `unpinMessage`
  - `chatMember`: `ban`, `unban`
  - `file`: `getDownloadUrl` (plus optional binary download)
