# n8n-nodes-bale-ir

[n8n](https://n8n.io) community nodes for the [Bale](https://bale.ai) messenger Bot API.
Send messages and media, manage chats and react to incoming messages and button presses
from your workflows.

[فارسی](README.fa.md)

> This is an independent community project. It is not affiliated with or endorsed by Bale or n8n.

## What you get

| Node | Purpose |
| --- | --- |
| **Bale** | Call the Bale Bot API from a workflow |
| **Bale Trigger** | Start a workflow when Bale sends an update to your bot (webhook) |

### Bale node operations

| Resource | Operations |
| --- | --- |
| Bot | Get Me |
| Callback Query | Answer |
| Chat | Get, Get Member Count, Leave, Pin Message, Unpin Message, Unpin All Messages |
| Chat Member | Ban, Unban |
| File | Get (information, optionally download as binary data) |
| Message | Send Text, Send Media (photo, audio, document, video, voice, animation), Send Location, Send Contact, Forward, Copy, Edit Text, Delete |

### Bale Trigger

Listens for **Message**, **Edited Message** and **Callback Query** updates. Optionally downloads
the photo, audio, document, video, voice or animation of a message as binary data.

## Installation

Self-hosted n8n: open **Settings → Community Nodes → Install** and enter `n8n-nodes-bale-ir`.
See the [n8n guide to installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/)
for Docker and manual installs.

Requirements: n8n 1.x and Node.js 20.19 or newer.

## Credentials

1. Open a chat with **@botfather** in Bale and create a bot. BotFather replies with a token.
2. In n8n create a **Bale API** credential and paste the token into **Access Token**.
   A leading `bot` prefix is removed automatically, so both `123456:ABC...` and
   `bot123456:ABC...` work.
3. **Base URL** defaults to `https://tapi.bale.ai`. Change it only if you use a proxy or a test
   environment. A trailing slash is ignored.
4. Click **Save**. n8n tests the credential by calling `getMe`.

The token is part of every Bale API URL. The nodes remove it from error messages and never put
file download URLs (which contain it) into the output.

## Usage

### Send a text message

1. Add a **Bale** node, choose **Message → Send Text**.
2. Set **Chat ID** to a numeric chat ID or a channel username such as `@my_channel`.
3. Enter the **Text** (1 to 4096 characters).

Optional fields: **Reply To Message ID**, **Reply Markup (JSON)** and **Parse Mode**.
**Parse Mode** is not sent unless you set it, because Bale does not support the full Telegram
Markdown or HTML syntax.

### Send a file

Choose **Message → Send Media**, pick the **Media Type** and one of three sources:

| Source | Limit documented by Bale |
| --- | --- |
| Binary Data (uploaded as multipart/form-data) | Photos up to 10 MB, other types up to 50 MB |
| URL (Bale downloads the file) | 5 MB for photos, 20 MB for other types |
| File ID (a file already stored on Bale) | none stated |

Uploads are checked against the multipart limits before the request is sent. Captions may have
up to 1024 characters. Animations are sent without a caption because the Bale reference lists
none for them.

### Buttons

**Reply Markup (JSON)** takes a JSON object that follows the keyboard types of the Bale Bot API
reference, for example an inline keyboard:

```json
{
  "inline_keyboard": [
    [
      { "text": "Open website", "url": "https://example.com" },
      { "text": "Confirm", "callback_data": "confirm" }
    ]
  ]
}
```

When a user presses a `callback_data` button, **Bale Trigger** (with **Callback Query** selected)
emits the update. Use **Callback Query → Answer** with `{{ $json.callback_query.id }}` to
acknowledge it.

### Receive messages

1. Add a **Bale Trigger** and choose the update kinds.
2. Activate the workflow. n8n registers its webhook URL with Bale (`setWebhook`) and removes it
   when the workflow is deactivated.

Bale only delivers webhooks to **HTTPS** URLs on **port 443 or 88**. The trigger checks the URL
before registering it and explains what to change. Make n8n reachable on a public HTTPS address
and set the `WEBHOOK_URL` environment variable to it. Keep the webhook URL private: it contains
a random identifier.

**Download Media** (trigger option) stores the media of a message in the binary property you
choose (default `data`). If a download fails, the message is still emitted with a
`mediaDownloadError` field.

### Rate limits

Bale allows about one message per second to the same chat and roughly 20 to 30 messages per
second across different chats. Use **Options → Delay Between Items (Ms)** (for example `1000`) when
sending many messages to one chat, and enable **Retry On Fail** for transient errors. Errors with
the codes 400, 401, 403, 404 and 429 include a hint explaining the usual cause.

## Output

| Operation | Output item |
| --- | --- |
| Operations that return an object (send, forward, copy, edit, get) | The object returned by Bale |
| Operations that return `true` (delete, pin, ban, answer, ...) | `{ "success": true }` |
| Chat → Get Member Count | `{ "count": 42 }` |
| File → Get with **Download** | The file information plus the file as binary data |
| Bale Trigger | The Bale `Update` object |

With **Continue On Fail** an item that fails becomes `{ "error": "..." }` and keeps its pairing
with the input item.

## Not included yet

Polling trigger (`getUpdates`), media groups, chat title, description and photo changes, invite
links, promoting members, stickers and payments. Open an issue if you need one of them.

## Development

```bash
git clone https://github.com/mehran-asgharian/n8n-nodes-iranian-messengers.git
cd n8n-nodes-iranian-messengers
npm install
npm run build     # compile all packages
npm run lint      # n8n community node linter
npm test          # unit tests (no network, no real token)
```

Run a single package with `npm run <script> --workspace packages/n8n-nodes-bale`, and start n8n
with the node loaded using `npm run dev --workspace packages/n8n-nodes-bale`.

The unit tests use fake n8n contexts with scripted HTTP responses. To test against the real API,
import `examples/smoke-test.workflow.json` into n8n, select your Bale credential on the nodes,
click **Execute workflow** for the token check, and send a message to your bot to see the echo
reply.

Releases are published by GitHub Actions with an npm provenance statement when a tag such as
`bale-v0.1.0` is pushed. The workflow reads the npm token from the `NPM_TOKEN` repository secret.

## Credits and sources

The request and response formats follow the Bale Bot API documentation at
[docs.bale.ai](https://docs.bale.ai/). The `answerCallbackQuery` method, the error codes and the
rate limits were taken from the maintainer's notes of that documentation.

## License

[MIT](LICENSE). Copyright (c) 2026 Mehran Asgharian.
