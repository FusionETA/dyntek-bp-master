# BP Master — Dyntek Bitrix24 app (Vercel)

A single, permission-controlled place to view/edit the **Business Partner** fields on a
deal. Hosted on Vercel (no WAF/bot-challenge, unlike the cPanel host).

- **Portal:** `dyntek.bitrix24.com` (deal category 0)
- **Placement:** `CRM_DEAL_DETAIL_TAB` — a "BP Master" tab on the deal card

## Permission rule

| Who | Before *Account Open* | *Account Open* and onwards |
|-----|-----------------------|----------------------------|
| Any employee with deal access | ✅ can edit | 🔒 read-only |
| User **ID 19** | ✅ can edit | ✅ can edit |

Enforced **server-side** in [`api/save.js`](api/save.js): identity comes from the Bitrix
token (not the browser), the stage is checked on the server, and only whitelisted BP
fields are written. The app is **stateless** — every call uses the token from that request
(the user's from the iframe, or the app's from the install event). No database, no secrets.

## Endpoints

| URL | Role |
|-----|------|
| `/api/index`   | The deal-card tab (view/edit). Also self-binds the tab when opened as the app. |
| `/api/install` | Install handler — binds the tab on `ONAPPINSTALL`. |
| `/api/save`    | The only write path. Server-side gate + field whitelist. |

Config (fields, the lock stage `UC_ACCTOP`, the always-edit user `19`) lives in
[`lib/config.js`](lib/config.js).

## Deploy (Vercel GitHub import)

1. Import this repo into Vercel (Framework preset: **Other**; no build step).
2. After it deploys, note the production URL, e.g. `https://<project>.vercel.app`.
3. In Dyntek → Developer resources → the BP Master local app, set:
   - **Handler path:** `https://<project>.vercel.app/api/index`
   - **Initial installation path:** `https://<project>.vercel.app/api/install`
   - Keep scopes **crm, user, placement**.
4. Save → **Reinstall**. The install handler binds the tab; open any deal to see it.
