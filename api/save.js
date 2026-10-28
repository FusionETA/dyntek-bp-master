// Secure save endpoint — the ONLY path that writes Business Partner fields.
// The permission gate runs here, server-side: identity from the token (not the
// browser), stage checked server-side, only whitelisted BP fields written.
// Every successful save writes an audit entry to the deal timeline; edits made
// at the Account Open stage or later are flagged. Only changed fields are written.
import { CONFIG } from '../lib/config.js';
import { b24call, getBody, currentUser, stageLocked } from '../lib/b24.js';

const num = (s) => String(s ?? '').replace(/[, ]/g, '').trim();
const trunc = (s) => { s = String(s ?? ''); return s.length > 120 ? s.slice(0, 117) + '…' : s; };
const enumLabel = (f, id) => {
  id = String(id ?? '');
  if (!id) return '(empty)';
  const o = (f.options || []).find((o) => String(o.id) === id);
  return o ? o.value : id;
};

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

  const me = await currentUser(domain, auth);
  if (me.id <= 0) return res.status(403).json({ ok: false, error: 'Invalid session' });

  const dr = await b24call(domain, 'crm.deal.get', { id: dealId }, auth);
  const deal = dr.data?.result;
  if (!deal) return res.status(403).json({ ok: false, error: 'No access to this deal' });

  // Gate: locked at Account Open and onwards, unless the user is an always-edit exception.
  const locked = await stageLocked(domain, auth, deal);
  const allowed = CONFIG.ALWAYS_EDIT_USER_IDS.includes(me.id) || !locked;
  if (!allowed) return res.status(403).json({ ok: false, error: 'These fields are locked at this stage' });

  // Write only the fields that actually changed, and record a human-readable diff.
  const update = {};
  const changes = []; // [label, from, to]
  for (const f of CONFIG.BP_FIELDS) {
    const { code, type } = f;

    if (type === 'opportunity') {
      if (code in field) {
        const nv = num(field[code]);
        const ov = String(parseFloat(deal.OPPORTUNITY || 0));
        if (parseFloat(nv || 0) !== parseFloat(ov || 0)) { update.OPPORTUNITY = nv; changes.push([f.label, ov, nv]); }
      }
    } else if (type === 'money') {
      if (code in field) {
        const amt = num(field[code]);
        let nv = '';
        if (amt !== '') {
          const c = (String(cur[code] || '').trim().slice(0, 3).toUpperCase()) || deal.CURRENCY_ID || 'MYR';
          nv = `${amt}|${c}`;
        }
        const ov = String(deal[code] ?? '');
        if (ov !== nv) { update[code] = nv; changes.push([f.label, ov || '(empty)', nv || '(empty)']); }
      }
    } else if (type === 'number') {
      if (code in field) {
        const nv = num(field[code]);
        const ov = String(deal[code] ?? '');
        if (parseFloat(nv || 0) !== parseFloat(ov || 0)) { update[code] = nv; changes.push([f.label, ov || '(empty)', nv || '(empty)']); }
      }
    } else if (type === 'select') {
      if (code in field) {
        const nv = String(field[code] ?? '');
        const ov = String(deal[code] ?? '');
        if (ov !== nv) { update[code] = nv; changes.push([f.label, enumLabel(f, ov), enumLabel(f, nv)]); }
      }
    } else if (type === 'file') {
      const incoming = newf[code] || [];
      if (incoming.length) {
        const arr = [];
        for (const id of (keep[code] || [])) if (id !== '') arr.push(parseInt(id, 10));
        for (const p of incoming) if (Array.isArray(p) && p.length === 2 && p[1]) arr.push({ fileData: [p[0], p[1]] });
        update[code] = arr;
        changes.push([f.label, '', `${incoming.length} file(s) added`]);
      }
    } else { // text, textarea
      if (code in field) {
        const nv = String(field[code]);
        const ov = String(deal[code] ?? '');
        if (ov.trim() !== nv.trim()) { update[code] = nv; changes.push([f.label, ov || '(empty)', nv || '(empty)']); }
      }
    }
  }

  if (!Object.keys(update).length) return res.status(200).json({ ok: true, changed: 0 });

  const ur = await b24call(domain, 'crm.deal.update', { id: dealId, fields: update }, auth);
  if (ur.data?.error) return res.status(502).json({ ok: false, error: ur.data.error_description || ur.data.error });

  // Audit log -> deal timeline comment. Locked-stage edits are flagged.
  const flag = locked ? '  [B]⚠ edited at Account Open stage (locked)[/B]' : '';
  const header = `[B]BP Master update[/B] by ${me.name}${flag}`;
  const lines = changes.map(([label, from, to]) => `• ${label}: ${trunc(from)} → ${trunc(to)}`).join('\n');
  try {
    await b24call(domain, 'crm.timeline.comment.add',
      { fields: { ENTITY_ID: dealId, ENTITY_TYPE: 'deal', COMMENT: `${header}\n${lines}` } }, auth);
  } catch { /* never fail a save because the audit note failed */ }

  return res.status(200).json({ ok: true, changed: changes.length, locked });
}
