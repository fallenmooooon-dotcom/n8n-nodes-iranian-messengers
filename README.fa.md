# n8n-nodes-iranian-messengers

مخزن واحد (monorepo) از نودهای انجمنی [n8n](https://n8n.io) برای پیام‌رسان‌های ایرانی.

[English](README.md)

| بسته | پلتفرم | نودها |
| --- | --- | --- |
| [`n8n-nodes-bale-ir`](packages/n8n-nodes-bale) | بله | Bale، Bale Trigger (وب‌هوک) |
| [`n8n-nodes-rubika`](packages/n8n-nodes-rubika) | روبیکا | Rubika، Rubika Trigger (وب‌هوک)، Rubika Poll Trigger |
| [`n8n-nodes-eitaayar`](packages/n8n-nodes-eitaayar) | ایتا، از طریق API ایتایار | Eitaa (EitaaYar)، فقط ارسال |
| [`n8n-nodes-soroush`](packages/n8n-nodes-soroush) | سروش‌پلاس | Soroush Plus، Soroush Plus Trigger (وب‌هوک)، Soroush Plus Poll Trigger |

هر بسته جداگانه در npm منتشر می‌شود و README خودش را برای نصب و استفاده دارد. ایتایار یک API فقط‌ارسال است؛
پس نود تریگر ندارد.

## ساختار مخزن

```text
packages/
  n8n-nodes-bale-ir/       نود عملیاتی و تریگر بله
  n8n-nodes-rubika/     نود عملیاتی، تریگر وب‌هوک و تریگر پولینگ روبیکا
  n8n-nodes-eitaayar/   نود عملیاتی ایتایار
  n8n-nodes-soroush/    نود عملیاتی، تریگر وب‌هوک، تریگر پولینگ و پشتیبانی برنامک (Mini App) سروش‌پلاس
.github/workflows/      ورک‌فلوی CI و یک ورک‌فلوی انتشار برای هر بسته
```

ساختار همه‌ی بسته‌ها یکسان است: `credentials/`، `nodes/<Name>/` (با `helpers.ts` برای منطق خالص،
`GenericFunctions.ts` برای درخواست‌ها و `operations.ts` برای عملیات)، `test/`، `examples/` و README
انگلیسی و فارسی.

## توسعه

```bash
npm install
npm run build
npm run lint
npm test
```

این دستورها با npm workspaces برای همه‌ی بسته‌ها اجرا می‌شوند. دستور `npm ci` در CI به فایل
`package-lock.json` نیاز دارد که اولین `npm install` می‌سازد؛ آن را commit کنید.

برای انتشار یک بسته، نسخه‌ی آن را بالا ببرید و تگی با نام همان بسته push کنید، مثلاً `bale-v0.1.0`،
`rubika-v0.1.0`، `eitaayar-v0.1.0` یا `soroush-v0.1.0`. ورک‌فلوی مربوطه بررسی می‌کند تگ با نسخه‌ی بسته
برابر باشد، lint و build و تست‌ها را اجرا می‌کند و با provenance در npm منتشر می‌کند. توکن npm از secret
مخزن با نام `NPM_TOKEN` خوانده می‌شود.

## سلب مسئولیت

این پروژه‌ها مستقل و انجمنی هستند و ارتباط یا تأیید رسمی از طرف n8n، بله، روبیکا، ایتا یا سروش‌پلاس ندارند.
نام پلتفرم‌ها فقط برای توصیف سازگاری به کار رفته است.

## مجوز

[MIT](LICENSE). Copyright (c) 2026 Mehran Asgharian.
