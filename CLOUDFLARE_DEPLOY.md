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
6. **Optional — Real Inbox Email OTP Delivery**:
   - Sign up for a free [Resend](https://resend.com) API key.
   - Open your Pages project -> **Settings** -> **Variables and Secrets** and add:
     - `RESEND_API_KEY` = your Resend API key
     - `EMAIL_FROM` = `SantalStock <noreply@yourdomain.com>` (or `SantalStock <onboarding@resend.dev>` for testing)
   - Redeploy. Without `RESEND_API_KEY`, real MX-domain validation still works and verification OTP codes appear in-app so you can test immediately.

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
- Any account registered with `sunitasoran98@gmail.com` is also automatically granted Admin rights.
