# n8n-nodes-rubika

[n8n](https://n8n.io) community nodes for the [Rubika](https://rubika.ir) messenger Bot API.
Send messages and files, manage chats and react to incoming messages from your workflows.

[فارسی](README.fa.md)

> This is an independent community project. It is not affiliated with or endorsed by Rubika or n8n.

## What you get

| Node | Purpose |
| --- | --- |
| **Rubika** | Call the Rubika Bot API from a workflow |
| **Rubika Trigger** | Start a workflow when Rubika sends an event to your bot (webhook) |
| **Rubika Poll Trigger** | Start a workflow for new events by asking Rubika regularly (no public URL needed) |

### Rubika node operations

| Resource | Operations |
| --- | --- |
| Bot | Get Me, Set Commands |
| Chat | Get, Set Keypad, Remove Keypad |
| Chat Member | Ban, Unban |
| File | Send (upload binary data or reuse a file ID), Get (download address, optionally the file itself) |
| Message | Send Text, Send Poll, Send Location, Send Contact, Forward, Edit Text, Edit Inline Keypad, Delete |

## Installation

Self-hosted n8n: open **Settings → Community Nodes → Install** and enter `n8n-nodes-rubika`.
See the [n8n guide to installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/)
for Docker and manual installs.

Requirements: n8n 1.x and Node.js 20.19 or newer.

## Credentials

1. Open a chat with **@BotFather** in Rubika and create a bot. BotFather replies with a token.
2. In n8n create a **Rubika API** credential and paste the token into **Access Token**. If you
   paste a whole API URL, the token is extracted from it.
3. **Base URL** defaults to `https://botapi.rubika.ir/v3`. Change it only if you use a proxy.
4. Click **Save**. n8n tests the credential by calling `getMe`.

The token is part of every Rubika API URL. The nodes remove it from error messages.

## Usage

### Send a text message

1. Add a **Rubika** node and choose **Message → Send Text**.
2. Set **Chat ID** (for example from `{{ $json.chat_id }}` of a trigger) and the **Text**.

Optional fields: **Reply To Message ID**, **Disable Notification**, **Formatting**,
**Chat Keypad (JSON)**, **Inline Keypad (JSON)** and **Remove Chat Keypad**.

**Formatting** adds styles, links and mentions to parts of the text (up to 30 parts). Positions
count UTF-16 units, so an emoji counts as 2. One invalid part makes Rubika reject the whole
message, so the node checks every part (range, link URL, mention user) before sending.

### Keypads

**Chat Keypad** shows buttons at the bottom of the chat, **Inline Keypad** shows buttons under
a message. Both take a JSON object in the Rubika keypad format. The node checks the structure
(rows, buttons, a string `id` and a known button `type`) before the request is sent:

```json
{
  "rows": [
    { "buttons": [{ "id": "100", "type": "Simple", "button_text": "Add account" }] },
    { "buttons": [
      { "id": "101", "type": "Simple", "button_text": "Edit" },
      { "id": "102", "type": "Simple", "button_text": "Remove" }
    ] }
  ],
  "resize_keyboard": true,
  "one_time_keyboard": false
}
```

Allowed button types: Simple, Selection, Calendar, NumberPicker, StringPicker, Location,
CameraImage, CameraVideo, GalleryImage, GalleryVideo, File, Audio, RecordAudio, Textbox, Link,
AskMyPhoneNumber, AskMyLocation and Barcode.

### Send a file

Choose **File → Send**, pick the **File Type** and the **File Source**.

With **Binary Data** the node makes the three requests Rubika needs: `requestSendFile` to get an
upload address, a multipart upload of the bytes, and `sendFile`. The output contains the
`message_id` and the new `file_id`, which you can reuse with **File ID**.

| File type | Documented format and limit |
| --- | --- |
| File | Any file, up to 50 MB |
| Image | JPG, GIF, PNG or WebP, up to 10 MB |
| Video | MP4, up to 50 MB |
| Voice | Short voice message as MP3 |
| Music | Song as MP3 |
| Gif | MP4 without sound |

The size limits are checked before anything is uploaded. Formats are checked by Rubika. The
caption is an additional field.

### Receive events

There are two ways, and they should not be combined for the same bot.

| | Rubika Trigger (webhook) | Rubika Poll Trigger |
| --- | --- | --- |
| Needs a public HTTPS address | Yes | No |
| Speed | Immediate | Depends on the poll interval |
| Inline button presses | Yes | Not described in the Rubika reference |

**Webhook:** when the workflow is activated the node registers the n8n webhook URL with
`updateBotEndpoints`: as `ReceiveUpdate` (messages and taps on chat keypad buttons) and, if you
selected **Inline Button Pressed**, as `ReceiveInlineMessage`. Both use the same URL and the node
tells them apart by their payload. Rubika may pause delivery when your endpoint fails, and the
Rubika reference describes no way to remove an endpoint, so deactivating the workflow leaves it
registered. Activating the workflow again registers it again.

**Polling:** the node calls `getUpdates`, stores the `next_offset_id` cursor and remembers the
latest 500 events, so a repeated delivery never starts the workflow twice. "Fetch Test Event"
never moves the cursor.

Both triggers emit the Rubika `Update` object, for example:

```json
{
  "type": "NewMessage",
  "chat_id": "b0...",
  "new_message": {
    "message_id": "12345",
    "text": "Hello",
    "sender_type": "User",
    "sender_id": "u0...",
    "aux_data": { "start_id": null, "button_id": "100" }
  }
}
```

Inline button presses are wrapped in the same style:
`{ "type": "InlineMessage", "chat_id": "...", "inline_message": { ... } }`. The `button_id` in
`aux_data` tells you which button was pressed.

### Groups and channels

From the Rubika reference: an admin must add the bot manually and promote it to admin. Without
the setting "receive all messages" in @BotFather the bot only sees messages that mention it or
start with `/`. The bot can edit only its own messages, a chat can have at most 10 admin bots,
and edit or delete events arrive only for actions by people.

## Output

| Operation | Output item |
| --- | --- |
| Operations with output fields | The `data` object of the response, for example `{ "message_id": "..." }`, `{ "bot": { ... } }` or `{ "chat": { ... } }` |
| Operations without output fields | `{ "success": true }` |
| File → Send | The response plus `file_id` |
| File → Get | `{ "file_id": "...", "download_url": "..." }`, or with **Download** the file as binary data and `{ "file_id": "..." }` |

With **Continue On Fail** an item that fails becomes `{ "error": "..." }` and keeps its pairing
with the input item.

## Errors

Rubika answers failed calls with `status` and `status_det`. The node shows them as
`Rubika API error: <status_det>` and adds a hint for `INVALID_AUTH` (wrong or revoked token),
`INVALID_INPUT` (missing or invalid parameter) and `TOO_MANY_REQUESTS` (slow down: use
**Options → Delay Between Items (Ms)** or enable **Retry On Fail**).

## Known documentation conflicts

- **Edit Inline Keypad** calls `editMessageKeypad`, the method name in the Rubika reference. Its
  curl example uses the URL `editInlineKeypad` instead. If your bot answers with `INVALID_INPUT`,
  change the constant `EDIT_KEYPAD_METHOD` in `nodes/Rubika/operations.ts`.
- The polling cursor is `offset_id` in the methods reference but `start_id` in the introduction.
  The node uses `offset_id` and guards against repeated events.
- Request limits are not documented with numbers.
- The response format (`status`, `status_det`, `data`) comes from the maintainer's notes and the
  field lists of the Rubika reference.

## Not included yet

The `ReceiveQuery`, `GetSelectionItem` and `SearchSelectionItems` endpoints, answering an inline
button press by editing the message from the webhook response, and downloading media inside the
triggers. Open an issue if you need one of them.

## Development

```bash
git clone https://github.com/mehran-asgharian/n8n-nodes-iranian-messengers.git
cd n8n-nodes-iranian-messengers
npm install
npm run build --workspace packages/n8n-nodes-rubika
npm run lint --workspace packages/n8n-nodes-rubika
npm test --workspace packages/n8n-nodes-rubika
```

The unit tests use fake n8n contexts with scripted HTTP responses. To test against the real API,
import `examples/smoke-test.workflow.json`, select your Rubika credential, run the token check
with **Execute workflow** and send a message to your bot to see the echo reply from the poll
trigger.

Releases are published by GitHub Actions with an npm provenance statement when a tag such as
`rubika-v0.1.0` is pushed. The workflow reads the npm token from the `NPM_TOKEN` repository secret.

## Credits and sources

Methods, parameters and models follow the Rubika Bot API documentation at
[rubika.ir/botapi](https://rubika.ir/botapi).

## License

[MIT](LICENSE). Copyright (c) 2026 Mehran Asgharian.
