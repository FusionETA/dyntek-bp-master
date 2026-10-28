// Secure save endpoint — the ONLY path that writes Business Partner fields.
// The permission gate runs here, server-side: identity from the token (not the
// browser), stage checked server-side, only whitelisted BP fields written.
import { CONFIG } from '../lib/config.js';
import { b24call, getBody, currentUserId, canEdit } from '../lib/b24.js';

const num = (s) => String(s ?? '').replace(/[, ]/g, '').trim();

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const body = await getBody(req);
  const auth = String(body.auth || '');
  const dealId = parseInt(body.deal_id || 0, 10);
  const field = body.field || {};
  const cur = body.cur || {};
  const keep = body.keep || {};
  const newf = body.newfile || {};

  if (!auth || !dealId) return res.status(400).json({ ok: false, error: 'Bad request' });

  const domain = CONFIG.DOMAIN;

  const userId = await currentUserId(domain, auth);
  if (userId <= 0) return res.status(403).json({ ok: false, error: 'Invalid session' });

  const dr = await b24call(domain, 'crm.deal.get', { id: dealId }, auth);
  const deal = dr.data?.result;
  if (!deal) return res.status(403).json({ ok: false, error: 'No access to this deal' });

  if (!(await canEdit(domain, auth, userId, deal))) {
    return res.status(403).json({ ok: false, error: 'These fields are locked at this stage' });
  }

  const update = {};
  for (const f of CONFIG.BP_FIELDS) {
    const { code, type } = f;
    if (type === 'opportunity') {
      if (code in field) update.OPPORTUNITY = num(field[code]);
    } else if (type === 'money') {
      if (code in field) {
        const amt = num(field[code]);
        if (amt === '') update[code] = '';
        else {
          const c = (String(cur[code] || '').trim().slice(0, 3).toUpperCase()) || deal.CURRENCY_ID || 'MYR';
          update[code] = `${amt}|${c}`;
        }
      }
    } else if (type === 'number') {
      if (code in field) update[code] = num(field[code]);
    } else if (type === 'file') {
      const incoming = newf[code] || [];
      if (incoming.length) {
        const arr = [];
        for (const id of (keep[code] || [])) if (id !== '') arr.push(parseInt(id, 10));
        for (const pair of incoming) {
          if (Array.isArray(pair) && pair.length === 2 && pair[1]) arr.push({ fileData: [pair[0], pair[1]] });
        }
        update[code] = arr;
      }
    } else { // text, textarea, select
      if (code in field) update[code] = String(field[code]);
    }
  }

  if (!Object.keys(update).length) return res.status(400).json({ ok: false, error: 'Nothing to update' });

  const ur = await b24call(domain, 'crm.deal.update', { id: dealId, fields: update }, auth);
  if (ur.data?.error) return res.status(502).json({ ok: false, error: ur.data.error_description || ur.data.error });

  return res.status(200).json({ ok: true });
}
