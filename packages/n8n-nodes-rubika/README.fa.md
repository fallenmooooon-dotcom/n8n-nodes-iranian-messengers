# n8n-nodes-rubika

نودهای انجمنی [n8n](https://n8n.io) برای API ربات‌های پیام‌رسان [روبیکا](https://rubika.ir).
با این نودها می‌توانید از داخل ورک‌فلو پیام و فایل بفرستید، چت‌ها را مدیریت کنید و به پیام‌های
دریافتی واکنش نشان دهید.

[English](README.md)

> این یک پروژه‌ی مستقل انجمنی است و ارتباط یا تأیید رسمی از طرف روبیکا یا n8n ندارد.

## امکانات

| نود | کاربرد |
| --- | --- |
| **Rubika** | فراخوانی API ربات روبیکا از داخل ورک‌فلو |
| **Rubika Trigger** | شروع ورک‌فلو هنگام دریافت رویداد از روبیکا (وب‌هوک) |
| **Rubika Poll Trigger** | شروع ورک‌فلو با پرسیدن منظم رویدادهای جدید از روبیکا (بدون نیاز به آدرس عمومی) |

### عملیات نود Rubika

| منبع (Resource) | عملیات |
| --- | --- |
| Bot | Get Me، Set Commands |
| Chat | Get، Set Keypad، Remove Keypad |
| Chat Member | Ban، Unban |
| File | Send (آپلود داده‌ی باینری یا استفاده از File ID)، Get (آدرس دانلود و در صورت نیاز خود فایل) |
| Message | Send Text، Send Poll، Send Location، Send Contact، Forward، Edit Text، Edit Inline Keypad، Delete |

## نصب

در n8n شخصی‌سازی‌شده (self-hosted) به **Settings → Community Nodes → Install** بروید و
`n8n-nodes-rubika` را وارد کنید. برای نصب با Docker یا نصب دستی به
[راهنمای n8n](https://docs.n8n.io/integrations/community-nodes/installation/) مراجعه کنید.

پیش‌نیازها: n8n نسخه‌ی 1.x و Node.js نسخه‌ی 20.19 یا بالاتر.

## اعتبارنامه (Credential)

1. در روبیکا با **@BotFather** گفتگو کنید و یک ربات بسازید. توکن را از BotFather دریافت می‌کنید.
2. در n8n یک اعتبارنامه‌ی **Rubika API** بسازید و توکن را در **Access Token** وارد کنید. اگر کل
   آدرس API را بچسبانید، توکن از آن جدا می‌شود.
3. مقدار پیش‌فرض **Base URL** برابر `https://botapi.rubika.ir/v3` است. فقط در صورت استفاده از
   پروکسی آن را تغییر دهید.
4. روی **Save** بزنید. n8n با فراخوانی `getMe` اعتبارنامه را آزمایش می‌کند.

توکن بخشی از آدرس همه‌ی درخواست‌های روبیکا است. این نودها توکن را از پیام‌های خطا حذف می‌کنند.

## نحوه‌ی استفاده

### ارسال پیام متنی

1. یک نود **Rubika** اضافه کنید و **Message → Send Text** را انتخاب کنید.
2. **Chat ID** (مثلاً از `{{ $json.chat_id }}` یک تریگر) و **Text** را تنظیم کنید.

فیلدهای اختیاری: **Reply To Message ID**، **Disable Notification**، **Formatting**،
**Chat Keypad (JSON)**، **Inline Keypad (JSON)** و **Remove Chat Keypad**.

گزینه‌ی **Formatting** به بخش‌هایی از متن سبک، لینک یا منشن اضافه می‌کند (حداکثر ۳۰ بخش). مکان‌ها
بر اساس واحدهای UTF-16 شمرده می‌شوند، پس هر اموجی ۲ واحد است. یک بخش نامعتبر باعث می‌شود روبیکا کل
پیام را رد کند؛ بنابراین نود پیش از ارسال همه‌ی بخش‌ها را بررسی می‌کند (محدوده، آدرس لینک، کاربر منشن).

### کی‌پدها (Keypad)

**Chat Keypad** دکمه‌ها را پایین صفحه‌ی چت و **Inline Keypad** زیر پیام نشان می‌دهد. هر دو یک شیء
JSON با قالب کی‌پد روبیکا می‌گیرند. نود ساختار را (ردیف‌ها، دکمه‌ها، `id` رشته‌ای و `type` معتبر) پیش
از ارسال بررسی می‌کند:

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

نوع‌های مجاز دکمه: Simple، Selection، Calendar، NumberPicker، StringPicker، Location، CameraImage،
CameraVideo، GalleryImage، GalleryVideo، File، Audio، RecordAudio، Textbox، Link،
AskMyPhoneNumber، AskMyLocation و Barcode.

### ارسال فایل

**File → Send** را انتخاب کنید و **File Type** و **File Source** را تعیین کنید.

با گزینه‌ی **Binary Data** نود سه درخواستی را که روبیکا لازم دارد انجام می‌دهد: `requestSendFile` برای
گرفتن آدرس آپلود، آپلود multipart بایت‌ها و `sendFile`. خروجی شامل `message_id` و `file_id` جدید است که
می‌توانید با گزینه‌ی **File ID** دوباره استفاده کنید.

| نوع فایل | قالب و محدودیت اعلام‌شده |
| --- | --- |
| File | هر فایلی تا ۵۰ مگابایت |
| Image | JPG، GIF، PNG یا WebP تا ۱۰ مگابایت |
| Video | MP4 تا ۵۰ مگابایت |
| Voice | پیام صوتی کوتاه با فرمت MP3 |
| Music | آهنگ با فرمت MP3 |
| Gif | MP4 بدون صدا |

محدودیت حجم پیش از آپلود بررسی می‌شود. قالب فایل را خود روبیکا بررسی می‌کند. کپشن یک فیلد اضافی است.

### دریافت رویدادها

دو روش وجود دارد و برای یک ربات نباید با هم ترکیب شوند.

| | Rubika Trigger (وب‌هوک) | Rubika Poll Trigger |
| --- | --- | --- |
| نیاز به آدرس عمومی HTTPS | بله | خیر |
| سرعت | آنی | بسته به بازه‌ی پولینگ |
| فشرده‌شدن دکمه‌های Inline | بله | در مستندات روبیکا توضیح داده نشده |

**وب‌هوک:** هنگام فعال‌سازی ورک‌فلو، نود آدرس وب‌هوک n8n را با `updateBotEndpoints` ثبت می‌کند: به‌عنوان
`ReceiveUpdate` (پیام‌ها و لمس دکمه‌های chat keypad) و در صورت انتخاب **Inline Button Pressed** به‌عنوان
`ReceiveInlineMessage`. هر دو از یک آدرس استفاده می‌کنند و نود آن‌ها را از روی بدنه‌ی درخواست تشخیص
می‌دهد. اگر Endpoint شما خطا بدهد ممکن است روبیکا ارسال را موقتاً متوقف کند و مستندات روبیکا راهی برای حذف
Endpoint توضیح نمی‌دهد؛ پس غیرفعال‌کردن ورک‌فلو آن را ثبت‌شده باقی می‌گذارد و فعال‌سازی دوباره آن را
دوباره ثبت می‌کند.

**پولینگ:** نود `getUpdates` را صدا می‌زند، مکان‌نمای `next_offset_id` را نگه می‌دارد و ۵۰۰ رویداد آخر را به
خاطر می‌سپارد؛ پس ارسال تکراری یک رویداد هرگز ورک‌فلو را دو بار اجرا نمی‌کند. گزینه‌ی «Fetch Test Event»
مکان‌نما را جابه‌جا نمی‌کند.

هر دو تریگر شیء `Update` روبیکا را برمی‌گردانند، مثلاً:

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

فشرده‌شدن دکمه‌های Inline هم به همین شکل بسته‌بندی می‌شود:
`{ "type": "InlineMessage", "chat_id": "...", "inline_message": { ... } }`. مقدار `button_id` در
`aux_data` نشان می‌دهد کدام دکمه فشرده شده است.

### گروه‌ها و کانال‌ها

طبق مستندات روبیکا: ادمین باید ربات را دستی اضافه و به ادمین ارتقا دهد. بدون تنظیم «دریافت همه‌ی پیام‌ها» در
@BotFather، ربات فقط پیام‌هایی را می‌بیند که او را منشن کرده‌اند یا با `/` شروع می‌شوند. ربات فقط پیام‌های
خودش را ویرایش می‌کند، هر چت حداکثر ۱۰ ربات ادمین دارد و رویدادهای ویرایش و حذف فقط برای اقدام‌های افراد
می‌رسند.

## خروجی

| عملیات | آیتم خروجی |
| --- | --- |
| عملیات دارای فیلد خروجی | شیء `data` پاسخ، مثلاً `{ "message_id": "..." }`، `{ "bot": { ... } }` یا `{ "chat": { ... } }` |
| عملیات بدون فیلد خروجی | `{ "success": true }` |
| File → Send | پاسخ به‌همراه `file_id` |
| File → Get | `{ "file_id": "...", "download_url": "..." }` یا با **Download** فایل به‌صورت باینری و `{ "file_id": "..." }` |

با فعال‌بودن **Continue On Fail**، آیتمی که خطا بدهد به `{ "error": "..." }` تبدیل می‌شود و ارتباطش با
آیتم ورودی حفظ می‌شود.

## خطاها

روبیکا خطاها را با `status` و `status_det` برمی‌گرداند. نود آن‌ها را به‌صورت
`Rubika API error: <status_det>` نشان می‌دهد و برای `INVALID_AUTH` (توکن اشتباه یا باطل‌شده)،
`INVALID_INPUT` (پارامتر ناقص یا نامعتبر) و `TOO_MANY_REQUESTS` (سرعت را کم کنید: از
**Options → Delay Between Items (Ms)** استفاده کنید یا **Retry On Fail** را فعال کنید) راهنما اضافه می‌کند.

## ناسازگاری‌های شناخته‌شده‌ی مستندات

- عملیات **Edit Inline Keypad** متد `editMessageKeypad` را صدا می‌زند که نام متد در مستندات روبیکا است.
  نمونه‌ی curl همان مستندات از آدرس `editInlineKeypad` استفاده می‌کند. اگر ربات شما `INVALID_INPUT` برگرداند،
  ثابت `EDIT_KEYPAD_METHOD` را در `nodes/Rubika/operations.ts` تغییر دهید.
- مکان‌نمای پولینگ در مرجع متدها `offset_id` و در مقدمه `start_id` است. نود از `offset_id` استفاده می‌کند و
  جلوی رویدادهای تکراری را می‌گیرد.
- محدودیت تعداد درخواست با عدد مستند نشده است.
- قالب پاسخ (`status`، `status_det`، `data`) از یادداشت‌های نگه‌دارنده و فهرست فیلدهای مستندات روبیکا
  گرفته شده است.

## هنوز شامل نمی‌شود

Endpointهای `ReceiveQuery`، `GetSelectionItem` و `SearchSelectionItems`، پاسخ‌دادن به فشرده‌شدن دکمه‌ی Inline با
ویرایش پیام از طریق پاسخ وب‌هوک و دانلود رسانه داخل تریگرها. اگر به یکی از آن‌ها نیاز دارید یک Issue باز کنید.

## توسعه

```bash
git clone https://github.com/mehran-asgharian/n8n-nodes-iranian-messengers.git
cd n8n-nodes-iranian-messengers
npm install
npm run build --workspace packages/n8n-nodes-rubika
npm run lint --workspace packages/n8n-nodes-rubika
npm test --workspace packages/n8n-nodes-rubika
```

تست‌های واحد از contextهای ساختگی n8n و پاسخ‌های HTTP از پیش تعیین‌شده استفاده می‌کنند. برای آزمایش با API
واقعی، فایل `examples/smoke-test.workflow.json` را وارد کنید، اعتبارنامه‌ی روبیکا را انتخاب کنید، برای بررسی توکن
**Execute workflow** بزنید و برای دیدن پاسخ echo تریگر پولینگ به ربات خود پیام بفرستید.

انتشار نسخه‌ها با GitHub Actions و همراه با provenance در npm انجام می‌شود؛ کافی است تگی مانند
`rubika-v0.1.0` را push کنید. توکن npm از secret مخزن با نام `NPM_TOKEN` خوانده می‌شود.

## منابع

متدها، پارامترها و مدل‌ها از مستندات API ربات روبیکا در [rubika.ir/botapi](https://rubika.ir/botapi) پیروی می‌کنند.

## مجوز

[MIT](LICENSE). Copyright (c) 2026 Mehran Asgharian.
