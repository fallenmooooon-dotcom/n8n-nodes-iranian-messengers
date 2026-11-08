# نود جامعه n8n برای سروش‌پلاس (`n8n-nodes-soroush`)

نود انجمنی [n8n](https://n8n.io/) برای اتصال به [پلتفرم بات](https://soroushplus.com/p/documents) و [برنامک‌های (Mini App)](https://soroushplus.com/p/documents/mini-app) **سروش‌پلاس (Soroush Plus)**.

[English](README.md)

## امکانات

- **ارسال پیام و رسانه**: متن (با پشتیبانی از `MarkdownV2`، `HTML` و `Markdown`)، عکس، ویدیو، صوت، پیام صوتی (Voice)، انیمیشن (همراه با کپشن)، فایل و سند، مخاطب و موقعیت جغرافیایی (همراه با دقت مکان `horizontal_accuracy`).
- **یکپارچگی کامل با برنامک (Mini App)**:
  - **Send Mini App Button**: ارسال دکمه‌های باز کردن برنامک (Web App) در کیبورد شیشه‌ای (Inline) یا منوی پایین چت (Reply Keyboard).
  - **Verify Init Data**: اعتبارسنجی رمزنگاری‌شده‌ی `Soroush.WebApp.initData` با الگوریتم `HMAC-SHA-256` (کلید مشتق‌شده با `"WebAppData"` و بررسی زمان انقضای `auth_date`).
  - **Mini App Data Trigger**: اجرای خودکار گردش‌کار هنگام ارسال داده از داخل برنامک به بات (`web_app_data`).
- **مدیریت پیام‌ها**: فوروارد، کپی، ویرایش متن پیام و حذف پیام.
- **کلیدهای تعاملی و Callback**: پاسخ‌دهی به کلیک دکمه‌های اینلاین با `answerCallbackQuery`.
- **مدیریت چت و اعضا**: پین و آن‌پین پیام‌ها، اخراج و رفع مسدودیت کاربر، دریافت اطلاعات چت و تعداد اعضا.
- **دو نوع تریگر ورودی**:
  - **Soroush Plus Trigger (Webhook)**: دریافت رویدادها به‌صورت بلادرنگ از طریق وب‌هوک امن (`HTTPS` روی پورت‌های مجاز `443`، `80`، `88` یا `8443`) همراه با قابلیت دانلود خودکار رسانه.
  - **Soroush Plus Poll Trigger**: دریافت آپدیت‌ها با روش Polling (`getUpdates`) بدون نیاز به آدرس اینترنتی عمومی HTTPS.

## نحوه نصب

در پنل کاربری n8n به بخش **Settings > Community Nodes** رفته و نام پکیج زیر را وارد کنید:
`n8n-nodes-soroush`

## دریافت کلید دسترسی (Token)

۱. در پیام‌رسان سروش‌پلاس به بات `@botfather` مراجعه کنید.
۲. بات جدید خود را ایجاد کرده و توکن ارائه‌شده را در بخش Credentials نود **Soroush Plus API** وارد نمایید.

## مجوز

[MIT](LICENSE)
