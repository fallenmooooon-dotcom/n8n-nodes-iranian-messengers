# n8n-nodes-eitaayar

[n8n](https://n8n.io) community node for **EitaaYar** ([eitaayar.ir](https://eitaayar.ir)), the API
that sends messages and files to [Eitaa](https://eitaa.com) channels and groups.

[فارسی](README.fa.md)

> This is an independent community project. It is not affiliated with or endorsed by Eitaa,
> EitaaYar or n8n.

## EitaaYar is not the Eitaa Apps platform

This package talks to the EitaaYar API (`https://eitaayar.ir/api/...`). It is **not** for the
Eitaa Apps (mini-app) platform documented on `developer.eitaa.com`. EitaaYar is a send-only API:
it has no webhook or polling mechanism, so this package has an action node and no trigger node.

## What you get

| Resource | Operations |
| --- | --- |
| Bot | Get Me |
| Message | Send Text, Send File |

## Installation

Self-hosted n8n: open **Settings → Community Nodes → Install** and enter `n8n-nodes-eitaayar`.
See the [n8n guide to installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/)
for Docker and manual installs.

Requirements: n8n 1.x and Node.js 20.19 or newer.

## Credentials

1. Create an account at [eitaayar.ir](https://eitaayar.ir) and set up your channel or group there
   as EitaaYar describes.
2. Copy the API token from the EitaaYar dashboard. The dashboard shows it with a `bot` prefix
   (`bot<digits>:<uuid>`). The prefix is optional: it is removed automatically, so both forms work,
   and so does a pasted API URL.
3. In n8n create an **EitaaYar API** credential and paste the token into **Access Token**.
4. **Base URL** defaults to `https://eitaayar.ir/api`. Change it only if you use a proxy.
5. Click **Save**. n8n tests the credential by calling `getMe`.

The token is part of every API URL. The node removes it from error messages.

## Usage

### Send a text message

Choose **Message → Send Text**, set **Chat ID** and **Text**.

**Chat ID** is the channel or group identifier from your EitaaYar panel, or the channel username
with or without `@`.

### Send a file

Choose **Message → Send File**, set **Chat ID** and the **Input Binary Field** that holds the file
(for example the output of **Read/Write Files from Disk** or **HTTP Request**). The file is
uploaded as multipart/form-data.

EitaaYar decides the kind of media from the file name extension. Use **File Name** to rename the
upload: a GIF needs `.gif` and a sticker needs `.webp`.

### Additional fields

| Field | Effect |
| --- | --- |
| Caption (Send File only) | Text sent together with the file |
| Delete After Views | Deletes the message automatically after this many views |
| Disable Notification | Sends the message silently |
| Pin | Pins the message in the channel |
| Reply To Message ID | Replies to a message |
| Schedule Date | Sends the message at a later time. A date without a time zone offset is read in the time zone of the n8n server |
| Title | A title that is shown only inside the EitaaYar panel |

The node sends the on/off fields as `1`, as EitaaYar expects, and sends nothing for fields you did
not set.

### Rate limits and sizes

The node enforces no rate limit or file size limit of its own; EitaaYar applies its own. Use
**Options → Delay Between Items (Ms)** when you send many messages in a row, and enable
**Retry On Fail** for transient errors.

## Output

| Operation | Output item |
| --- | --- |
| Get Me | The account object returned by EitaaYar (`id`, `is_bot`, `first_name`, `last_name`, `username`) |
| Send Text, Send File | The `result` object of the response, or `{ "success": true }` when EitaaYar returns none |

EitaaYar answers with an `ok` flag. When it is `false`, the node fails with
`EitaaYar API error: <description>` (or the HTTP status when no description is given). With
**Continue On Fail** an item that fails becomes `{ "error": "..." }` and keeps its pairing with the
input item.

## Development

```bash
git clone https://github.com/mehran-asgharian/n8n-nodes-iranian-messengers.git
cd n8n-nodes-iranian-messengers
npm install
npm run build --workspace packages/n8n-nodes-eitaayar
npm run lint --workspace packages/n8n-nodes-eitaayar
npm test --workspace packages/n8n-nodes-eitaayar
```

The unit tests use a fake n8n context with scripted HTTP responses. To test against the real API,
import `examples/smoke-test.workflow.json` and select your EitaaYar credential. **Execute workflow**
runs **Get Me** to check the token. The last node, which posts a test message, is disabled because it
needs your own channel: enter it in **Chat ID** and enable the node to test sending.

Releases are published by GitHub Actions with an npm provenance statement when a tag such as
`eitaayar-v0.1.0` is pushed. The workflow reads the npm token from the `NPM_TOKEN` repository secret.

## Credits and sources

Methods and parameters follow the EitaaYar API guide published at [eitaayar.ir](https://eitaayar.ir).
The response format (`ok` and `result`) comes from the maintainer's notes of that guide.

## License

[MIT](LICENSE). Copyright (c) 2026 Mehran Asgharian.
