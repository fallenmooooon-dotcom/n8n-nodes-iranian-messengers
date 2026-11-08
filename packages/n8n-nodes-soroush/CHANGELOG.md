# Changelog

All notable changes to `n8n-nodes-soroush` will be documented in this file.

## [0.1.0] - 2026-11-08

### Added

- `Soroush Plus` action node supporting Bot (`getMe`), Message (`sendText`, `sendMedia`, `sendLocation`, `sendContact`, `forward`, `copy`, `editText`, `delete`), Mini App (`sendMiniAppButton`, `verifyInitData`), Callback Query (`answer`), File (`get` + binary download), Chat (`get`, `getMemberCount`, `leave`, `pinMessage`, `unpinMessage`, `unpinAllMessages`), and Chat Member (`ban`, `unban`) operations.
- `Soroush Plus Trigger` webhook node supporting `message`, `edited_message`, `channel_post`, `edited_channel_post`, `callback_query`, and Mini App `web_app_data` events with optional automatic media download.
- `Soroush Plus Poll Trigger` polling node (`getUpdates`) with automatic `offset` tracking.
- `Soroush Plus API` credential with automatic `bot` prefix normalization and `getMe` connection test.
