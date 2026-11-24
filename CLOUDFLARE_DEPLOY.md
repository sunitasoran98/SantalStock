# Deploying SantalStock on Cloudflare Pages

This project is pre-configured for **Cloudflare Pages** with:
- Frontend static bundle built into `dist/` via Vite (`npm run build`)
- Full-stack edge API in `functions/api/[[path]].ts` (runs automatically on Cloudflare Pages Functions — zero Node.js dependencies)
- Automatic browser-local fallback if deployed via static Direct Upload without Functions
- Production caching & security headers in `public/_headers`

---

## Option 1: GitHub -> Cloudflare Pages (Recommended — Full-Stack + Shared Database)

1. Push this project to a GitHub repository (or use AI Studio's Export to GitHub / Download ZIP and push).
2. Open **Cloudflare Dashboard** -> **Workers & Pages** -> **Create** -> **Pages** -> **Connect to Git**.
3. Select your repository and configure build settings:
   - **Framework preset**: `Vite` (or `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Click **Save and Deploy**. Cloudflare automatically deploys both `dist/` and `functions/api/[[path]].ts`.
5. **Enable Permanent Global Storage (KV Database)**:
   - In Cloudflare Dashboard -> **Storage & Databases** -> **KV** -> **Create a namespace** (e.g. `santalstock-db`).
   - Open your Pages project -> **Settings** -> **Bindings** -> **Add** -> **KV namespace**:
     - **Variable name**: `SANTALSTOCK_KV`
     - **KV namespace**: select `santalstock-db`
   - Redeploy once so all Admin Mode edits, uploaded photos, orders, and user accounts persist globally across every visitor.
5b. **Photo Storage (R2) — zaroori, warna ~10-15 photo ke baad upload fail hoga**:
   - KV ka ek record max 25 MB ka hota hai. R2 ke bina har photo usi record me jaati hai.
   - Cloudflare Dashboard -> **R2 Object Storage** -> pehli baar **Enable / Purchase R2 Plan** (free plan: 10 GB/month storage, download free; Cloudflare payment method maangta hai, free limit me charge nahi hota).
   - **Create bucket** -> naam `santalstock-images` -> Location: Automatic.
   - Pages project -> **Settings** -> **Bindings** -> **Add** -> **R2 bucket**:
     - **Variable name**: `SANTALSTOCK_R2`
     - **R2 bucket**: `santalstock-images`
   - Redeploy. Pehle se KV me padi photos pehli request par apne aap R2 me shift ho jaati hain.
   - Preview photo sabke liye khuli hai. Full-size file (`/api/img/full/...`) sirf admin, photo ke owner, ya paid order wale buyer ko milti hai.
5c. **Duplicate photo detection (3 layer)**:
   - Layer 1 Exact (same file) aur Layer 2 Edited (resize, compress, filter, halka crop, mirror) apne aap chalte hain, kuch setup nahi.
   - Layer 3 Internet: Admin > Review me har photo par Google Lens, TinEye, Bing, Yandex buttons (R2 chalu hona chahiye).
   - Optional auto internet check: [SerpApi](https://serpapi.com) key lo, phir Pages -> Settings -> Variables and Secrets me `SERPAPI_KEY` (Secret) add karo. Har nayi upload par Google Lens exact-match search apne aap chalegi; har search SerpApi ka 1 credit leta hai.
6. **Optional — Real Inbox Email OTP Delivery**:
   - Sign up for a free [Resend](https://resend.com) API key.
   - Open your Pages project -> **Settings** -> **Variables and Secrets** and add:
     - `RESEND_API_KEY` = your Resend API key
     - `EMAIL_FROM` = `SantalStock <noreply@yourdomain.com>` (or `SantalStock <onboarding@resend.dev>` for testing)
   - Redeploy. **Sign up and password reset OTP go only by email.** Without `RESEND_API_KEY` they show "Email service is not set up yet".
   - Testing only: add `ALLOW_SCREEN_OTP` = `1` to show the OTP on screen. Delete it before going live, otherwise anyone can reset any password.
   - Note: `onboarding@resend.dev` sends only to your own Resend account email. To email real users, verify your domain in Resend → Domains and use `noreply@yourdomain`.

---

## Option 2: Direct Upload (Fastest — Drag & Drop `dist/`)

1. Run `npm install && npm run build` locally to generate the `dist/` folder.
2. Open **Cloudflare Dashboard** -> **Workers & Pages** -> **Create** -> **Pages** -> **Direct Upload**.
3. Upload the `dist/` folder and click **Deploy site**.
   - Even without Functions, the built-in static fallback engine keeps login, admin click-to-edit mode, cart, and uploads working in the browser.

---

## Default Admin Login
- **Email**: `admin@santalstock.in`
- **Password**: `admin123`
- This demo login works only until the owner admin is set up.

## First-time owner Admin setup
1. Set up email OTP first (EmailJS or Resend, below).
2. Site → Login → Admin → "Set admin password".
3. Name, `sunitasoran98@gmail.com`, mobile, password, confirm → OTP comes to that Gmail → enter it.
4. You are now Admin. The demo login `admin@santalstock.in` / `admin123` is switched off automatically.
5. Forgot it later? Admin → Forgot? → OTP to the same Gmail.

## Email OTP with EmailJS (no domain needed)
Sends OTP from your own Gmail. Free plan: 200 emails/month. The OTP is sent from the server, so it never reaches the browser.
1. emailjs.com → Sign up → Email Services → Add New Service → Gmail → Connect your Gmail → Create. Copy the Service ID.
2. Email Templates → Create New Template:
   - Subject: `{{subject}}`
   - Content: `Your {{site}} {{purpose}} code is {{code}}. It is valid for {{minutes}} minutes. If you did not ask for it, ignore this email.`
   - Settings / To Email: `{{to_email}}` · From Name: `SantalStock`
   - Save. Copy the Template ID.
3. Account → General: copy Public Key and Private Key.
4. Account → Security: turn ON "Allow EmailJS API for non-browser applications" and "Use Private Key". Save.
5. Cloudflare → Workers & Pages → santalstock → Settings → Variables and Secrets → Production → add (Type: Secret):
   `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`
6. Push / Retry deployment. If RESEND_API_KEY is also set, Resend is tried first.
