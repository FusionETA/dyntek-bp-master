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
(the user's from the iframe, or the app's from the install/event callback). No database, no secrets.

## Auto-numbering

When a deal **enters the _Confirm Purchase_ stage** (`UC_C6PH91`, category 0), the app assigns:

| Code | Where | Prefix | Once per |
|------|-------|--------|----------|
| **BP Master Code** | deal field `UF_CRM_1681096198922` | `P00001` | deal |
| **Company Code**   | company field `UF_CRM_COMPANY_CODE` | `C00001` | company (reused across its deals) |

- Triggered by the app's own **`ONCRMDEALUPDATE`** event; the handler no-ops unless the deal
  is at the trigger stage with a **blank** code (idempotent — safe on back/forward stage moves).
- The next number is `max + 1`, read from the **"Code Registry"** List (`IBLOCK_ID 49`), which
  is the editable source of truth: row name = the code, description = what it was assigned to.
  To manage numbering after a deal/company is deleted, edit that List.
- Numbering is **forward-only** — deals already past the stage are not backfilled.

## Endpoints

| URL | Role |
|-----|------|
| `/api/index`   | The deal-card tab (view/edit). Also self-binds the tab when opened as the app. |
| `/api/install` | Install handler — binds the tab and the `ONCRMDEALUPDATE` event on `ONAPPINSTALL`. |
| `/api/save`    | The only BP-field write path. Server-side gate + field whitelist. |
| `/api/event`   | `ONCRMDEALUPDATE` handler — assigns P/C codes at the trigger stage. |

Config (fields, the lock stage `UC_ACCTOP`, always-edit users, and the `NUMBERING` block)
lives in [`lib/config.js`](lib/config.js).

## Deploy (Vercel GitHub import)

1. Import this repo into Vercel (Framework preset: **Other**; no build step).
2. After it deploys, note the production URL, e.g. `https://<project>.vercel.app`.
3. In Dyntek → Developer resources → the BP Master local app, set:
   - **Handler path:** `https://<project>.vercel.app/api/index`
   - **Initial installation path:** `https://<project>.vercel.app/api/install`
   - Scopes: **crm, user, placement, lists** (`lists` is required for the registry).
4. Save → **Reinstall**. The install handler binds the tab **and** the auto-numbering event;
   open any deal to see the tab.
