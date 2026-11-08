# n8n-nodes-iranian-messengers

Monorepo of [n8n](https://n8n.io) community nodes for Iranian messaging platforms.

[فارسی](README.fa.md)

| Package | Platform | Nodes |
| --- | --- | --- |
| [`n8n-nodes-bale`](packages/n8n-nodes-bale) | Bale | Bale, Bale Trigger (webhook) |
| [`n8n-nodes-rubika`](packages/n8n-nodes-rubika) | Rubika | Rubika, Rubika Trigger (webhook), Rubika Poll Trigger |
| [`n8n-nodes-eitaayar`](packages/n8n-nodes-eitaayar) | Eitaa, through the EitaaYar API | Eitaa (EitaaYar), send-only |

Each package is published to npm on its own and has its own README with setup and usage.
EitaaYar is a send-only API, so it has no trigger node.

## Repository layout

```text
packages/
  n8n-nodes-bale/       Bale action node and trigger
  n8n-nodes-rubika/     Rubika action node, webhook trigger and poll trigger
  n8n-nodes-eitaayar/   EitaaYar action node
.github/workflows/      CI and one publish workflow per package
```

Every package has the same layout: `credentials/`, `nodes/<Name>/` (with `helpers.ts` for pure
logic, `GenericFunctions.ts` for requests and `operations.ts` for the operation handlers),
`test/`, `examples/` and its own README in English and Persian.

## Development

```bash
npm install
npm run build
npm run lint
npm test
```

The commands run for every package through npm workspaces. CI (`npm ci`) needs the
`package-lock.json` that the first `npm install` creates, so commit it.

To release a package, bump its version and push a tag named after it, for example `bale-v0.1.0`,
`rubika-v0.1.0` or `eitaayar-v0.1.0`. The matching workflow checks that the tag equals the package
version, runs lint, build and tests and publishes with an npm provenance statement. It reads the
npm token from the `NPM_TOKEN` repository secret.

## Disclaimer

These are independent community projects. They are not affiliated with or endorsed by n8n, Bale,
Rubika or Eitaa. Platform names are used only to describe compatibility.

## License

[MIT](LICENSE). Copyright (c) 2026 Mehran Asgharian.
