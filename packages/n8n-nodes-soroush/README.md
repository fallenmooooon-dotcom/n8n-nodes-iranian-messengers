# n8n-nodes-soroush

Community node for [n8n](https://n8n.io/) to interact with the **[Soroush Plus (سروش‌پلاس)](https://soroushplus.com/p/documents)** Bot Platform and **[Mini App (برنامک)](https://soroushplus.com/p/documents/mini-app)** ecosystem.

[فارسی](README.fa.md)

## Features

- **Bot Operations**: Get bot identity and account information (`getMe`).
- **Messaging**: Send text messages (`MarkdownV2`, `HTML`, `Markdown`), photos, videos, audio, voice notes, animations (with caption), documents, contacts, and map locations (with `horizontal_accuracy`).
- **Message Management**: Forward, copy, edit text, and delete messages.
- **Mini App (برنامک) Integration**:
  - **Send Mini App Button**: Send messages with interactive Mini App launch buttons (both inline keyboard and reply keyboard).
  - **Verify Init Data**: Cryptographically validate `Soroush.WebApp.initData` using `HMAC-SHA-256` (`WebAppData` secret key derivation and `auth_date` expiration check).
  - **Mini App Trigger Event**: Trigger workflows automatically when a user sends data back from a Mini App (`web_app_data`).
- **Interactive Keyboards**: Full support for inline keyboards and callback query handling (`answerCallbackQuery`).
- **Chat & Member Management**: Pin/unpin messages, get member counts, ban/unban users, and leave chats.
- **Two Trigger Modes**:
  - **Soroush Plus Trigger**: Real-time push updates via secure HTTPS webhooks (`setWebhook` on ports `443`, `80`, `88`, or `8443`) with optional media download.
  - **Soroush Plus Poll Trigger**: Long polling (`getUpdates`) for local development without a public HTTPS URL.

## Installation

Install in your n8n instance via **Settings > Community Nodes > Install**:
`n8n-nodes-soroush`

## Credentials

1. Open Soroush Plus and message `@botfather` (`splus.ir/botfather`) to create your bot and receive an API token.
2. In n8n, add a **Soroush Plus API** credential and enter your bot token.

## License

[MIT](LICENSE)
