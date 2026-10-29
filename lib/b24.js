// Minimal Bitrix24 REST helpers (stateless — every call uses the token supplied
// per request: the user's token from the iframe, or the app token from the
// ONAPPINSTALL event). No stored credentials, no database.
import qs from 'qs';
import { CONFIG } from './config.js';

/** Call a REST method with an explicit auth token. */
export async function b24call(domain, method, params, authToken) {
  const url = `https://${domain}/rest/${method}.json`;
  const body = qs.stringify({ ...params, auth: authToken });
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  let data = {};
  try { data = await r.json(); } catch { /* ignore */ }
  return { http: r.status, data };
}

/** Rebuild a nested object from flat bracket-notation keys, e.g.
 *  { 'data[FIELDS][ID]': '8241', 'auth[access_token]': 'x' }
 *  -> { data: { FIELDS: { ID: '8241' } }, auth: { access_token: 'x' } }.
 *  Vercel's urlencoded parser leaves bracketed keys flat; Bitrix online events
 *  (ONCRMDEALUPDATE) use them, so normalize before reading. */
function unflattenBrackets(obj) {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    const vals = Array.isArray(v) ? v : [v];
    for (const vv of vals) parts.push(`${k}=${encodeURIComponent(vv == null ? '' : vv)}`);
  }
  return qs.parse(parts.join('&'));
}

/** Read and parse a request body, whether JSON or urlencoded (nested brackets supported). */
export async function getBody(req) {
  const ct = req.headers['content-type'] || '';
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
    // Vercel may hand us flat bracket keys (e.g. 'data[FIELDS][ID]') — un-flatten.
    if (Object.keys(req.body).some((k) => k.includes('['))) return unflattenBrackets(req.body);
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.length) {
    if (ct.includes('json')) { try { return JSON.parse(req.body); } catch { return {}; } }
    return qs.parse(req.body);
  }
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) return (req.body && typeof req.body === 'object') ? req.body : {};
    if (ct.includes('json')) { try { return JSON.parse(raw); } catch { return {}; } }
    return qs.parse(raw);
  } catch {
    return (req.body && typeof req.body === 'object') ? req.body : {};
  }
}

/** Extract the app/user access token from a parsed body (flat or nested or bracket-literal). */
export function authFromBody(b) {
  if (!b) return '';
  if (b.AUTH_ID) return String(b.AUTH_ID);
  if (b.auth && typeof b.auth === 'object' && b.auth.access_token) return String(b.auth.access_token);
  if (b['auth[access_token]']) return String(b['auth[access_token]']);
  return '';
}

/** Resolve the current portal user id from a token (0 if invalid / wrong portal). */
export async function currentUserId(domain, auth) {
  if (!auth) return 0;
  const r = await b24call(domain, 'user.current', {}, auth);
  return parseInt(r.data?.result?.ID || 0, 10) || 0;
}

/** Resolve the current user's id and display name from a token. */
export async function currentUser(domain, auth) {
  if (!auth) return { id: 0, name: '' };
  const r = await b24call(domain, 'user.current', {}, auth);
  const u = r.data?.result || {};
  const id = parseInt(u.ID || 0, 10) || 0;
  const name = [u.NAME, u.LAST_NAME].filter(Boolean).join(' ').trim() || (id ? `User ${id}` : '');
  return { id, name };
}

/** Is this deal at the "Account Open" stage or later (by funnel sort)? Ignores the user exception. */
export async function stageLocked(domain, auth, deal) {
  if (!CONFIG.ACCOUNT_OPEN_STATUS_ID) return false;
  const catId = parseInt(deal.CATEGORY_ID || 0, 10);
  const entity = catId === 0 ? 'DEAL_STAGE' : `DEAL_STAGE_${catId}`;
  const res = await b24call(domain, 'crm.status.list',
    { filter: { ENTITY_ID: entity }, order: { SORT: 'ASC' } }, auth);
  const order = (res.data?.result || []).map((s) => s.STATUS_ID);
  const idxLock = order.indexOf(CONFIG.ACCOUNT_OPEN_STATUS_ID);
  if (idxLock === -1) return false;            // no Account Open in this pipeline
  const idxCurrent = order.indexOf(deal.STAGE_ID || '');
  if (idxCurrent === -1) return true;          // unknown stage where lock applies -> safe
  return idxCurrent >= idxLock;
}

/**
 * Editing allowed? Locked at the "Account Open" stage and onwards (by funnel sort),
 * unless the user is in the always-edit list. Pipelines without that stage stay editable.
 */
export async function canEdit(domain, auth, userId, deal) {
  if (CONFIG.ALWAYS_EDIT_USER_IDS.includes(userId)) return true;
  return !(await stageLocked(domain, auth, deal));
}

// ---------------------------------------------------------------------------
// Auto-numbering (BP Master Code "P#####" on deals, Company Code "C#####" on
// companies). The "Code Registry" List is the source of truth for the next
// number: next = max number seen for that prefix + 1. Admins edit that List to
// manage numbering when a deal/company is deleted.
// ---------------------------------------------------------------------------

const NM = () => CONFIG.NUMBERING;

/** Format a number into a prefixed, zero-padded code, e.g. (P, 1) -> "P00001". */
export function fmtCode(prefix, n) {
  return prefix + String(n).padStart(NM().PAD, '0');
}

/** Highest number already registered for a prefix (0 if none). */
export async function maxRegistered(domain, auth, prefix) {
  const r = await b24call(domain, 'lists.element.get', {
    IBLOCK_TYPE_ID: 'lists',
    IBLOCK_ID: NM().REGISTRY_IBLOCK_ID,
    FILTER: { '%=NAME': prefix + '%' },
    ELEMENT_ORDER: { NAME: 'DESC' },
    select: ['ID', 'NAME'],
  }, auth);
  let max = 0;
  const re = new RegExp('^' + prefix + '(\\d+)$');
  for (const row of (r.data?.result || [])) {
    const m = re.exec(String(row.NAME || ''));
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  return max;
}

/** Does a code already exist in the registry? */
export async function codeExists(domain, auth, code) {
  const r = await b24call(domain, 'lists.element.get', {
    IBLOCK_TYPE_ID: 'lists',
    IBLOCK_ID: NM().REGISTRY_IBLOCK_ID,
    FILTER: { '=NAME': code },
    select: ['ID'],
  }, auth);
  return (r.data?.result || []).length;
}

/** Record a code in the registry (row name = code, description = what it's for). */
export async function registerCode(domain, auth, code, detail) {
  return b24call(domain, 'lists.element.add', {
    IBLOCK_TYPE_ID: 'lists',
    IBLOCK_ID: NM().REGISTRY_IBLOCK_ID,
    FIELDS: { NAME: code, DETAIL_TEXT: detail || '' },
  }, auth);
}

/** Allocate the next free code for a prefix (max+1), stepping past any taken. */
async function allocateCode(domain, auth, prefix) {
  let n = (await maxRegistered(domain, auth, prefix)) + 1;
  for (let i = 0; i < 25; i++) {
    const code = fmtCode(prefix, n);
    if (!(await codeExists(domain, auth, code))) return code;
    n += 1; // another writer took it between read and write
  }
  return fmtCode(prefix, n);
}

/**
 * Assign codes for a deal that has entered the trigger stage. Idempotent:
 * only fills a code that is currently empty. Returns a summary of what it did.
 */
export async function assignCodes(domain, auth, deal) {
  const n = NM();
  const out = { atTrigger: false, dealCode: null, companyCode: null, notes: [] };

  if (parseInt(deal.CATEGORY_ID || 0, 10) !== n.CATEGORY_ID) return out;
  if (String(deal.STAGE_ID || '') !== n.TRIGGER_STATUS_ID) return out;
  out.atTrigger = true;

  const today = new Date().toISOString().slice(0, 10);

  // Deal -> BP Master Code
  if (!String(deal[n.DEAL_CODE_FIELD] || '').trim()) {
    const code = await allocateCode(domain, auth, n.DEAL_PREFIX);
    const ur = await b24call(domain, 'crm.deal.update',
      { id: deal.ID, fields: { [n.DEAL_CODE_FIELD]: code } }, auth);
    if (ur.data?.result) {
      const reg = await registerCode(domain, auth, code,
        `Deal #${deal.ID} — ${deal.TITLE || ''} — ${today}`);
      if (!reg.data?.result) out.notes.push('registry(deal) failed: ' + JSON.stringify(reg.data?.error_description || reg.data?.error || reg.http));
      out.dealCode = code;
    } else {
      out.notes.push('deal update failed: ' + (ur.data?.error_description || ur.data?.error || '?'));
    }
  }

  // Company -> Company Code (once per company, reused across its deals)
  const companyId = parseInt(deal.COMPANY_ID || 0, 10);
  if (companyId > 0) {
    const cr = await b24call(domain, 'crm.company.get', { id: companyId }, auth);
    const company = cr.data?.result;
    if (company && !String(company[n.COMPANY_CODE_FIELD] || '').trim()) {
      const code = await allocateCode(domain, auth, n.COMPANY_PREFIX);
      const ur = await b24call(domain, 'crm.company.update',
        { id: companyId, fields: { [n.COMPANY_CODE_FIELD]: code } }, auth);
      if (ur.data?.result) {
        const reg = await registerCode(domain, auth, code,
          `Company #${companyId} — ${company.TITLE || ''} — via deal #${deal.ID} — ${today}`);
        if (!reg.data?.result) out.notes.push('registry(company) failed: ' + JSON.stringify(reg.data?.error_description || reg.data?.error || reg.http));
        out.companyCode = code;
      } else {
        out.notes.push('company update failed: ' + (ur.data?.error_description || ur.data?.error || '?'));
      }
    }
  }

  return out;
}

/** Bind the ONCRMDEALUPDATE event to a handler (idempotent — rebinds cleanly). */
export async function bindDealEvent(domain, auth, handlerUrl) {
  await b24call(domain, 'event.unbind', { event: 'ONCRMDEALUPDATE', handler: handlerUrl }, auth);
  return b24call(domain, 'event.bind', { event: 'ONCRMDEALUPDATE', handler: handlerUrl }, auth);
}

/** Bind (idempotently) the BP Master tab onto the deal card. */
export async function bindTab(domain, auth, handlerUrl) {
  // Unbind ALL handlers for this placement first (clears any old/duplicate
  // bindings, e.g. a previous host), then bind this one.
  await b24call(domain, 'placement.unbind', { PLACEMENT: 'CRM_DEAL_DETAIL_TAB' }, auth);
  return b24call(domain, 'placement.bind', {
    PLACEMENT: 'CRM_DEAL_DETAIL_TAB',
    HANDLER: handlerUrl,
    TITLE: 'BP Master',
    DESCRIPTION: 'Business Partner master fields',
  }, auth);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
