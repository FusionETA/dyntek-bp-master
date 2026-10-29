// Bitrix event handler for ONCRMDEALUPDATE. Fires on every deal change; it
// no-ops unless the deal is at the "Confirm Purchase" trigger stage with a
// blank code. Uses the per-event token Bitrix delivers (stateless — no stored
// credentials). Always replies 200 so Bitrix does not retry-storm.
//
// DEBUG: while CONFIG.NUMBERING.DEBUG is true, every hit writes a "[BP DEBUG]"
// timeline comment to the deal so we can see delivery + outcome from outside.
import { CONFIG } from '../lib/config.js';
import { b24call, getBody, authFromBody, assignCodes } from '../lib/b24.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const body = await getBody(req);
  const auth = authFromBody(body);

  // Deal id lives at data[FIELDS][ID]. getBody normalizes the nested form, but
  // tolerate the flat bracket key and casing variants too.
  let dealId = 0;
  const data = body.data || body.DATA || {};
  const fields = data.FIELDS || data.fields || {};
  dealId = parseInt(fields.ID || fields.id || 0, 10) || 0;
  if (!dealId) {
    dealId = parseInt(
      body['data[FIELDS][ID]'] || body['DATA[FIELDS][ID]'] ||
      body['data[FIELDS][id]'] || 0, 10) || 0;
  }

  const DEBUG = !!CONFIG.NUMBERING.DEBUG;
  const dbg = (msg) => (DEBUG && auth && dealId)
    ? b24call(CONFIG.DOMAIN, 'crm.timeline.comment.add',
        { fields: { ENTITY_ID: dealId, ENTITY_TYPE: 'deal', COMMENT: '[BP DEBUG] ' + msg } }, auth)
        .then(() => {}).catch(() => {})
    : Promise.resolve();

  if (!auth || !dealId) {
    return res.status(200).json({ ok: true, skipped: 'no auth or deal id', hasAuth: !!auth, dealId, keys: Object.keys(body) });
  }

  try {
    const dr = await b24call(CONFIG.DOMAIN, 'crm.deal.get', { id: dealId }, auth);
    const deal = dr.data?.result;
    if (!deal) {
      await dbg('deal.get failed: ' + JSON.stringify(dr.data?.error_description || dr.data?.error || dr.http));
      return res.status(200).json({ ok: true, skipped: 'deal not readable' });
    }

    const result = await assignCodes(CONFIG.DOMAIN, auth, deal);
    await dbg(`stage=${deal.STAGE_ID} cat=${deal.CATEGORY_ID} code=${JSON.stringify(deal[CONFIG.NUMBERING.DEAL_CODE_FIELD] || '')} -> ${JSON.stringify(result)}`);
    return res.status(200).json({ ok: true, dealId, ...result });
  } catch (e) {
    await dbg('error: ' + String((e && e.message) || e));
    return res.status(200).json({ ok: false, dealId, error: String((e && e.message) || e) });
  }
}
