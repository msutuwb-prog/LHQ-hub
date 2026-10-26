# LHQ Quotes & Invoices

Quote, invoice and receipt generator for LHQ Learning Solutions. The app runs in the browser. Two small Netlify Functions send the PDF directly: one by email from LHQ's Gmail account, one on WhatsApp from LHQ's WhatsApp Business number.

```
site/                     the app: index.html (LHQ Hub home, students), editor.html (quotes, invoices, receipts, cards), reports.html, tutor.html, theme.js, sync.js
netlify/functions/        send-email.mjs     sends email through Gmail
                          send-whatsapp.mjs  sends WhatsApp messages through Meta's Cloud API
netlify.toml              tells Netlify where everything is
package.json              lists the one library the email function needs
```

Email and WhatsApp are set up separately. Each one switches on by itself once its settings are added, so you can do email first and WhatsApp later.

## Part A: Email (about 20 minutes)

### 1. Create a Gmail App Password

Gmail needs a special "App Password" before another service can send from the account. Your normal password won't work.

1. Sign in to **learnhqes@gmail.com** and open <https://myaccount.google.com/security>.
2. Turn on **2-Step Verification** if it isn't on already. App Passwords need it.
3. Open <https://myaccount.google.com/apppasswords>.
4. Name it `LHQ Quote App` and click **Create**.
5. Copy the 16-letter password Google shows you. You won't be able to see it again.

### 2. Put the files on GitHub

Netlify only runs the email function for sites deployed from GitHub (drag-and-drop deploys skip it).

1. Sign in at <https://github.com> (create a free account if needed).
2. Click **New repository**, name it `lhq-quotes`, choose **Private**, and click **Create repository**.
3. On the next page click **uploading an existing file**.
4. Open the unzipped folder on your computer, select **everything inside it** (`site`, `netlify`, `netlify.toml`, `package.json`, `README.md`, `.gitignore`) and drag it all onto the GitHub page. Use Chrome or Edge so the folders upload with their contents.
5. Click **Commit changes**.

### 3. Connect the repository to Netlify

**If you already have the app on Netlify from a drag-and-drop deploy**, link the repository to that same site so the web address stays the same and the quotes already saved on staff devices are kept:
Site configuration → Build & deploy → **Link repository** → GitHub → `lhq-quotes`.

**Otherwise**, create a new site: **Add new project → Import an existing project → GitHub** → choose `lhq-quotes`.

Netlify reads the settings from `netlify.toml`. Leave the build command empty and click **Deploy**.

### 4. Add the email settings

In Netlify open **Site configuration → Environment variables → Add a variable** and add these three:

| Key | Value |
|---|---|
| `GMAIL_USER` | `learnhqes@gmail.com` |
| `GMAIL_APP_PASSWORD` | the 16-letter App Password from step 1 (mark it as a secret) |
| `APP_ACCESS_CODE` | a code you choose for staff, e.g. `LHQ-quotes-4821` |

Optional: `FROM_NAME` changes the sender name (default: *LHQ Learning Solutions*).

Then go to **Deploys → Trigger deploy → Deploy site** so the function picks up the new settings.

### 5. Turn it on in the app

On each phone, tablet or computer that will send quotes:

1. Open the app and expand **Sending (email & WhatsApp)** at the bottom of the editor.
2. Type the access code from step 4.
3. The email dot turns green and reads *Email: ready. Sends from learnhqes@gmail.com.*

## Part B: WhatsApp (about 1 hour, plus Meta's template approval)

The app sends through Meta's **WhatsApp Cloud API**. Your WhatsApp Business *app* on the phone can't be controlled by other software, so the number has to be connected to the Cloud API as well.

### Before you start: which number?

**Option 1: keep your current number (recommended).** Meta's *coexistence* option connects a number that's already in the WhatsApp Business app to the Cloud API. The phone app keeps working, and the last 6 months of chats are carried over. Parents' replies to quotes appear in the app as normal. A few app features switch off on a connected number, including broadcast lists and disappearing messages.

Coexistence runs through Meta's sign-up flow, where you scan a QR code from the WhatsApp Business app. If Meta doesn't offer it when you add your number in step B2, a Meta Business Partner can connect it for you. Ask for coexistence onboarding and *direct Cloud API access in your own Meta business account*. If the partner only offers their own API instead, send me their API details and I'll adapt the app.

> ⚠️ Don't add your current number through the ordinary "add phone number" route unless Meta offers coexistence. The ordinary route requires deleting the number from the WhatsApp Business app first, and its chat history is lost.

**Option 2: a second number just for sending.** Any SIM that isn't on WhatsApp can be registered directly in step B2 with no partner. Replies to that number don't show in any phone app, so the quote message points parents to 0992 525 250.

### B1. Create a Meta app

1. Go to <https://developers.facebook.com>, log in with the Facebook account that manages LHQ's Meta Business portfolio, and click **My Apps → Create app**.
2. Choose the **Connect with customers through WhatsApp** use case, name it `LHQ Quotes`, and select LHQ's business portfolio.
3. When the app opens, go to **WhatsApp → API Setup** (sometimes called *Quickstart*).

### B2. Connect the phone number

On the **API Setup** page, click **Add phone number** and follow the steps for the option you chose above. When it's done, the page shows two IDs. Copy both:

- **Phone number ID** (goes into `WA_PHONE_NUMBER_ID`)
- **WhatsApp Business Account ID** (goes into `WA_BUSINESS_ACCOUNT_ID`)

Also add a payment method in **WhatsApp Manager → Payment settings**. Meta charges a small fee for each message a business sends ([Meta's pricing page](https://developers.facebook.com/docs/whatsapp/pricing) lists the rates for Malawi).

### B3. Create a permanent access token

The token on the API Setup page expires after 24 hours, so create a permanent one:

1. Open <https://business.facebook.com/settings> → **Users → System users → Add**. Name it `LHQ Quotes app` and give it the **Admin** role.
2. Click **Assign assets**. Add the **LHQ Quotes** app (full control) and LHQ's **WhatsApp account** (full control).
3. Click **Generate new token**, choose the LHQ Quotes app, set expiry to **Never**, and tick `whatsapp_business_messaging` and `whatsapp_business_management`.
4. Copy the token (goes into `WA_TOKEN`). You won't be able to see it again.

### B4. Create the two message templates

WhatsApp only lets a business start a conversation with a template Meta has approved. You need two: one for quotes and invoices, one for receipts. In **WhatsApp Manager → Message templates → Create template**, create the first:

| Field | Value |
|---|---|
| Category | **Utility** |
| Name | `lhq_tutoring_document` |
| Language | **English** |
| Header | **Document** (upload any sample PDF when asked) |
| Body | see below |
| Footer | `LHQ Learning Solutions · +265 992 525 250` |

Body (copy exactly, including the numbered placeholders):

```
Hello {{1}}, thank you for choosing LHQ Learning Solutions. Please find attached your tutoring {{2}} ({{3}}) for {{4}}.

Total: MKW {{5}}
Balance due: MKW {{6}}

Kindly send proof of payment to 0992 525 250 or learnhqes@gmail.com. A receipt will be issued once payment is confirmed.
```

Sample values for Meta's review: `Mr Banda`, `quote`, `1038`, `Chikondi's Tuition`, `150,000.00`, `150,000.00`.

The app always fills the placeholders in this order: {{1}} parent's name, {{2}} quote or invoice, {{3}} number, {{4}} "Being payment for", {{5}} total, {{6}} balance. You can reword the rest of the template, but keep all six placeholders.

Then create the receipt template the same way:

| Field | Value |
|---|---|
| Category | **Utility** |
| Name | `lhq_tutoring_receipt` |
| Language | **English** |
| Header | **Document** |
| Footer | `LHQ Learning Solutions · +265 992 525 250` |

Body:

```
Hello {{1}}, thank you for your payment of MKW {{2}} for {{3}}. Please find attached your receipt ({{4}}).

Balance remaining: MKW {{5}}

Please keep this receipt for your records.
```

Sample values: `Mr Banda`, `116,000.00`, `Chikondi's Tuition`, `RCT-0031`, `0.00`. The order is fixed: {{1}} parent's name, {{2}} amount received, {{3}} "Being payment for", {{4}} receipt number, {{5}} balance remaining.

Approval usually takes from a few minutes to a day.

### B5. Add the WhatsApp settings to Netlify

In **Site configuration → Environment variables**, add:

| Key | Value |
|---|---|
| `WA_TOKEN` | the permanent token from B3 (mark it as a secret) |
| `WA_PHONE_NUMBER_ID` | the Phone number ID from B2 |
| `WA_BUSINESS_ACCOUNT_ID` | the WhatsApp Business Account ID from B2 (lets the app preview the approved wording) |

Only if you named the templates differently or chose another language: `WA_TEMPLATE` (quote/invoice template name), `WA_RECEIPT_TEMPLATE` (receipt template name) and `WA_TEMPLATE_LANG` (for example `en_GB` for English UK).

Then **Deploys → Trigger deploy → Deploy site**. On each device, the WhatsApp dot under **Sending** turns green once the template is approved. Devices that already have the access code need no extra step.

## Day-to-day use

- **Quote → Invoice → Receipt.** Each has its own number series (Q-1038, INV-0001, RCT-0001). In **Saved**, tap **→ Invoice** on a quote or **→ Receipt** on an invoice: the new document copies everything across, links back to the one it came from, and fills in the amounts (a receipt starts with the invoice's balance as the amount received).
- **Dates.** Quotes get a *Valid until* date (30 days by default) and invoices a *Due date* (7 days); tap 7 / 14 / 30 days or pick a date. The tuition period is picked as a start and end date and prints as "19 Oct – 13 Nov 2026 (4 weeks)". Change the default day counts under **Company & bank details**.
- **Discounts** can be a percentage or an amount, with a reason that prints on the document (e.g. "Discount (Sibling 10%)").
- **Receipts** record the amount received, any earlier payments, the payment method and reference, and who received it. A receipt that clears the balance shows a PAID IN FULL stamp.

- **Send → Email → Send email now** emails the parent straight away with the PDF attached. A copy appears in the Gmail account's **Sent** folder, and parents' replies arrive in that inbox.
- **Send → WhatsApp → Send on WhatsApp now** sends the PDF from LHQ's number with the approved message. The window shows exactly what the parent will receive.
- Saved quotes show **✓ Emailed** and **✓ WhatsApp** with the date once sent.
- "Open Email" and "Open WhatsApp" still work as a backup: they open your own app with the message filled in and download the PDF for you to attach.

## Good to know

- Gmail allows roughly 500 emails a day from one account, far more than this app needs.
- "Sent on WhatsApp" means Meta accepted the message. If a parent's number isn't on WhatsApp, Meta drops the message without telling the app, so double-check numbers.
- Meta limits how many new people a business can message each day. The starting limit is far above what LHQ needs, and it rises once Meta verifies the business.
- Anyone who has the access code can send email and WhatsApp messages from LHQ's accounts through the app. To change the code, edit `APP_ACCESS_CODE` in Netlify, trigger a deploy, and enter the new code on each device.
- To stop direct sending at any time: revoke the Gmail App Password at <https://myaccount.google.com/apppasswords>, or delete the System User's token in Meta Business settings.
- To update the app later, upload the changed files to the same GitHub repository. Netlify redeploys automatically.

## School list

`schools.js` holds the School dropdown used on tuition cards and the student checklist (from the "Cambridge Schools Malawi – LHQ Working Directory", 25 Oct 2026). Each line is `{a:'Area', n:'Name shown', k:'other names for search'}`. Add or rename schools there. Anyone can still type a school that isn't listed.

## Tuition cards

A tuition card is a one-page brief for tutors: student, Year & level, tuition period, where, a weekly timetable, and for each subject the tutor, days, sessions, topics, current grade and notes. It shows no fees, payments or parent contact details.

1. In **Saved**, tap **→ Card** on an invoice or receipt. The student, level, period and subjects carry over. (Or tap **Card** at the top to start one by hand.)
2. Open each subject and add the tutor, days and session length. Start and end times are optional; leave them blank until the timetable is set and the card shows "time to be confirmed".
3. Choose topics from the Cambridge list for the student's level: tick a whole chapter, or open it to pick sub-topics (IGCSE Maths). Use **Full course** to cover everything from the beginning. Add any topic that isn't listed under **Your own topics**.
4. Tap **Share card**, choose **Whole card** or **One subject**, then **Share image** or **Share PDF** and pick the staff WhatsApp group.

Tutors, grades, "Grade based on" options and session lengths can be edited under **Lists**. Card numbers run as TC-0001, TC-0002 … (set the next one under **Numbering**).

Saving a receipt also updates the linked invoice's "Amount already paid".

## Student topic checklist

Students fill in `checklist.html` on the same site (for example https://your-site.netlify.app/checklist.html). In the app, open **Student topic checklist** to copy the link or send it on WhatsApp.

The student fills in five short steps: (1) name, Year, exam series and school; (2) their subjects from a tick-box dropdown, with the paper (Core, Extended or Not sure) for IGCSE Maths, Chemistry, Physics, Biology and Combined Science and an optional latest grade; (3) topics, one subject at a time: what to cover, then tap a chapter to open it and tick topics inside (or "All of" the chapter); chapter-only lists are a simple tick per chapter; (4) the days they could come and where (At LHQ, Online or Either); (5) any notes.

The message is easy to read and ends with a link for LHQ admin. Open that link on the device that has the app's saved documents, and a new tuition card fills in with the student's choices. Their availability and notes appear in a green box that only you see. Opening the same link again opens the card already made from it rather than a duplicate.

On the tuition card, IGCSE Maths, Chemistry, Physics, Biology and Combined Science have a **Paper** dropdown (Core or Extended) next to Tutor. The card shows a CORE or EXTENDED badge beside the syllabus code, and Core cards leave out Extended-only topics.

## Instalment plans

Quotes are always for the full amount, with an optional line "Instalment plans are available on request" (tick box under the subjects on a quote).

On an invoice, choose **50/50 plan** under Payment. The 1st instalment is due on the first day of tuition; the 2nd on the first day of the second half of the tuition period, in whole weeks (e.g. a 4-week period starting Mon 26 Oct → Mon 9 Nov). Both dates can be changed. The invoice shows a Payment Plan table with Paid / Next due, the next instalment as the Due Date, and the grace-period rule: if the 2nd instalment is not received within the grace period (3 days by default, set under Company & bank details), sessions pause until payment is confirmed and paused sessions are made up afterwards.

A receipt made from the invoice fills in the next instalment as the amount received and states the next payment. In **Saved**, invoices show their status: Paid, the next instalment's due date, "in grace until …" or "overdue".

## Backup & restore

Saved documents live in the browser on each device. Open **Backup & restore** (in the settings panel) and tap **Back up now** to save everything into one file (LHQ-backup_date.json); on a phone or tablet it opens the share menu so you can put it in Google Drive or send it to yourself on WhatsApp. The app shows a reminder if nothing has been backed up for 7 days. **Restore from a backup** loads a backup file: "Add to this device" merges it with what is already there; "Replace everything" makes the device match the backup. The access code is never included in a backup.

## Progress reports (test version, no cloud)

**Tutors** keep a session log on their phone (`tutor.html`). Send each tutor their personal link from a tuition card's **Share** screen (**Send to tutors**), or from **Reports** → **Tutor links**. The link lists every student on saved tuition cards with that tutor's name, and **View card** shows the full card on the tutor's phone (only the subjects that tutor teaches, plus the card note). Topics travel as short codes that the tutor page looks up in `topics.js`, and links are compressed with a fixed word list (`LHQ_DICT` in `codec.js`, using `pako.min.js`). Never edit `LHQ_DICT`: links already sent depend on it. Tutor links use the short address `/t#…`, which `_redirects` points at `tutor.html`. Send it again when cards change. After each session the tutor logs attendance (attended / late / absent), topics covered and, if one was given, the topical assessment score, plus an optional line for the parent. SRAs are logged when marked: topic, review 1–4, handed in on time / late / not handed in, and the score. Once a month they add Strengths / To improve / Next steps per student. Everything stays on the tutor's phone; **Send to LHQ** sends one WhatsApp message to 0992 525 250 with a link.

**Admin** taps the link in the tutor's message on the tablet that has the app's data; the log is imported into Reports (repeats are ignored, edits and deletions are applied). Reports shows which tutors have logged this period, each student's status, and flags (absences, grade drops, late or missing SRAs, missing logs, and home SRA scores far above topical tests). **Preview & share** produces the parent report: weekly or 2-weekly (one page) or monthly (at-a-glance page + detailed report with SRAs by topic and a section per subject). The overall comment is drafted from the results and can be edited; tutors' lines and comments can be edited before sending. Share as an image (page 1) or PDF.

Working grade = average of topical assessments in the tuition period (LHQ scale A* 90+, A 80–89, B 70–79, C 60–69, D 50–59). SRA scores are never shown to parents; only SRAs handed in on time are. Set "Topical assessments: Every 2 weeks" on a tuition card subject where tests are fortnightly.

## LHQ Hub: sign-in and online storage (step 1)

- `netlify/functions/hub.mjs` is the server (`/api/hub/*`). It signs people in with personal PINs and stores everything in Netlify Blobs (store `lhq-hub`): people, every quote/invoice/receipt/card (`doc/<id>`), previous versions (`hist/…`), deleted documents (`trash/…`), and shared settings (`kv/…`).
- Netlify needs the environment variable **`LHQ_SECRET`** (a long random string). Without it the Hub shows "isn't set up yet".
- `site/sync.js` runs before each page's own script. It shows the sign-in screen, fills the page's local copy from the server, and uploads every change (it watches `localStorage` writes, so the existing pages work unchanged). Offline changes upload when the device is back online.
- Invoice, receipt, quote and card numbers are checked on the server: if two devices save the same number, the second gets the next free one and is told.
- The first person to open the Hub sets it up and becomes admin. Admins add people and reset PINs under their name → People & access. Five wrong PINs lock that person out for 15 minutes.
- Tutors' session-log links (`/t#…`) don't need sign-in yet; that comes in step 2.
