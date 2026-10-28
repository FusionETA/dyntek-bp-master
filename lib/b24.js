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

/** Read and parse a request body, whether JSON or urlencoded (nested brackets supported). */
export async function getBody(req) {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/json')) {
    try { return JSON.parse(raw || '{}'); } catch { return {}; }
  }
  return qs.parse(raw);
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

/**
 * Editing allowed? Locked at the "Account Open" stage and onwards (by funnel sort),
 * unless the user is in the always-edit list. Pipelines without that stage stay editable.
 */
export async function canEdit(domain, auth, userId, deal) {
  if (CONFIG.ALWAYS_EDIT_USER_IDS.includes(userId)) return true;
  if (!CONFIG.ACCOUNT_OPEN_STATUS_ID) return true;

  const stageId = deal.STAGE_ID || '';
  const catId = parseInt(deal.CATEGORY_ID || 0, 10);
  const entity = catId === 0 ? 'DEAL_STAGE' : `DEAL_STAGE_${catId}`;

  const res = await b24call(domain, 'crm.status.list',
    { filter: { ENTITY_ID: entity }, order: { SORT: 'ASC' } }, auth);
  const order = (res.data?.result || []).map((s) => s.STATUS_ID);

  const idxLock = order.indexOf(CONFIG.ACCOUNT_OPEN_STATUS_ID);
  if (idxLock === -1) return true;            // no Account Open in this pipeline -> editable
  const idxCurrent = order.indexOf(stageId);
  if (idxCurrent === -1) return false;        // unknown stage where lock applies -> safe
  return idxCurrent < idxLock;
}

/** Bind (idempotently) the BP Master tab onto the deal card. */
export async function bindTab(domain, auth, handlerUrl) {
  await b24call(domain, 'placement.unbind',
    { PLACEMENT: 'CRM_DEAL_DETAIL_TAB', HANDLER: handlerUrl }, auth);
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
