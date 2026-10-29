// BP Master — deal card tab (and self-install when opened as the app itself).
// Read-only state here is UX only; the real lock is enforced in /api/save.
import { CONFIG } from '../lib/config.js';
import { b24call, getBody, authFromBody, currentUserId, canEdit, bindTab, bindDealEvent, esc } from '../lib/b24.js';

function fileIds(raw) {
  const out = [];
  for (const it of (Array.isArray(raw) ? raw : [])) {
    const id = (it && typeof it === 'object') ? (it.id ?? it.ID) : it;
    if (id !== null && id !== undefined && id !== '') out.push(String(id));
  }
  return out;
}

function renderField(f, deal, canEditNow) {
  // Auto-generated fields (e.g. BP Master Code) are never editable here.
  const writable = canEditNow && !f.readOnly;
  const dis = writable ? '' : 'disabled';
  const id = 'f_' + f.code.replace(/[^A-Za-z0-9_]/g, '');
  const label = `<label for="${esc(id)}">${esc(f.label)}${f.readOnly ? ' <span style="color:#9aa4b2">(auto)</span>' : ''}</label>`;
  const val = deal[f.code];

  switch (f.type) {
    case 'textarea':
      return `${label}<textarea id="${esc(id)}" data-code="${esc(f.code)}" ${dis}>${esc(val ?? '')}</textarea>`;
    case 'number':
      return `${label}<input id="${esc(id)}" data-code="${esc(f.code)}" value="${esc(val ?? '')}" ${dis}>`;
    case 'money': {
      const [amtRaw, curRaw] = String(val ?? '').split('|');
      const amt = amtRaw ? String(parseFloat(amtRaw)) : '';
      const cur = curRaw || deal.CURRENCY_ID || 'MYR';
      return `${label}<div class="money">
        <input id="${esc(id)}" data-code="${esc(f.code)}" value="${esc(amt)}" inputmode="decimal" ${dis}>
        <input class="cur" data-cur="${esc(f.code)}" value="${esc(cur)}" maxlength="3" ${dis}></div>`;
    }
    case 'opportunity': {
      const amt = String(parseFloat(deal.OPPORTUNITY || 0));
      return `${label}<div class="money">
        <input id="${esc(id)}" data-code="${esc(f.code)}" value="${esc(amt)}" inputmode="decimal" ${dis}>
        <input class="cur" value="${esc(deal.CURRENCY_ID || 'MYR')}" disabled></div>`;
    }
    case 'select': {
      const cur = String(val ?? '');
      const opts = (f.options || []).map((o) =>
        `<option value="${esc(o.id)}" ${cur === String(o.id) ? 'selected' : ''}>${esc(o.value)}</option>`).join('');
      return `${label}<select data-code="${esc(f.code)}" ${dis}><option value="">—</option>${opts}</select>`;
    }
    case 'file': {
      const ids = fileIds(val);
      const keeps = ids.map((fid) => `<input type="hidden" data-keep="${esc(f.code)}" value="${esc(fid)}">`).join('');
      const uploader = canEditNow ? `<input type="file" data-filecode="${esc(f.code)}" multiple>` : '';
      return `${label}<div class="files">${keeps}<small>${ids.length} file(s) attached${canEditNow ? ' — new uploads are added to these' : ''}.</small>${uploader}</div>`;
    }
    default:
      return `${label}<input id="${esc(id)}" data-code="${esc(f.code)}" value="${esc(val ?? '')}" ${dis}>`;
  }
}

export default async function handler(req, res) {
  const body = await getBody(req);
  const domain = String(body.DOMAIN || '');
  const auth = String(body.AUTH_ID || authFromBody(body) || '');

  let dealId = 0;
  const po = body.PLACEMENT_OPTIONS;
  if (po) { try { const o = typeof po === 'string' ? JSON.parse(po) : po; dealId = parseInt(o.ID || 0, 10) || 0; } catch { /* ignore */ } }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // Opened as the app itself (app context, no deal) -> self-install / bind the tab.
  // Bitrix does not send a DOMAIN field on the tab POST, so we don't require it;
  // the token is the real auth and all REST calls target CONFIG.DOMAIN.
  if (auth && dealId === 0) {
    const host = req.headers.host;
    const r = await bindTab(CONFIG.DOMAIN, auth, `https://${host}/api/index`);
    const okb = !!r.data?.result;
    // Also bind the auto-numbering event here — this self-setup page is what the
    // "Reinstall" button loads, so the event must bind from here too.
    let okev = false, everr = '';
    try {
      const er = await bindDealEvent(CONFIG.DOMAIN, auth, `https://${host}/api/event`);
      okev = !!er.data?.result;
      everr = er.data?.error_description || er.data?.error || '';
    } catch (e) { everr = String((e && e.message) || e); }
    return res.status(200).send(`<!doctype html><meta charset="utf-8"><body style="font:14px -apple-system,Arial,sans-serif;padding:16px;line-height:1.5">
<script src="//api.bitrix24.com/api/v1/"></script>
${okb ? '<p>✅ BP Master tab is set up. Open any deal to see the <b>BP Master</b> tab.</p>'
      : `<p>⚠ Tab binding failed: ${esc(r.data?.error_description || r.data?.error || '')}</p>`}
${okev ? '<p>✅ Auto-numbering is active — codes assign when a deal enters <b>Confirm Purchase</b>.</p>'
       : `<p>⚠ Auto-numbering did not bind${everr ? ': ' + esc(everr) : ''}. Make sure the app has the <b>lists</b> scope, then reopen this.</p>`}</body>`);
  }

  const ok = (auth && dealId > 0);
  if (!ok) {
    return res.status(200).send(`<!doctype html><meta charset="utf-8"><body style="font:14px -apple-system,Arial,sans-serif;padding:16px"><p>Couldn't load the deal context.</p></body>`);
  }

  // Bind the auto-numbering event from here — the tab always runs with a valid
  // OAuth (app-context) token, which CAN bind events (the webhook cannot). This
  // self-heals the binding; event.bind is idempotent so repeated loads are safe.
  try {
    const er = await bindDealEvent(CONFIG.DOMAIN, auth, `https://${req.headers.host}/api/event`);
    if (CONFIG.NUMBERING.DEBUG) {
      await b24call(CONFIG.DOMAIN, 'crm.timeline.comment.add',
        { fields: { ENTITY_ID: dealId, ENTITY_TYPE: 'deal',
          COMMENT: '[BP BIND] ' + JSON.stringify(er.data?.result ?? (er.data?.error_description || er.data?.error || er.http)) } },
        auth);
    }
  } catch { /* don't block the tab on a binding hiccup */ }

  const userId = await currentUserId(CONFIG.DOMAIN, auth);
  const dr = await b24call(CONFIG.DOMAIN, 'crm.deal.get', { id: dealId }, auth);
  const deal = dr.data?.result || {};
  const editable = !!deal.ID && await canEdit(CONFIG.DOMAIN, auth, userId, deal);

  const fieldsHtml = CONFIG.BP_FIELDS.map((f) => `<div class="field">${renderField(f, deal, editable)}</div>`).join('');

  res.status(200).send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BP Master</title>
<style>
  :root{--b:#e6e9ef;--muted:#707a8a;--accent:#2066b0}*{box-sizing:border-box}
  body{font:14px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2733;margin:0;padding:16px}
  .bar{display:flex;align-items:center;gap:10px;margin-bottom:14px;position:sticky;top:0;background:#fff;padding:4px 0;z-index:2}
  .pill{font-size:12px;padding:3px 10px;border-radius:999px}.pill.edit{background:#e8f5e9;color:#2e7d32}.pill.lock{background:#fdecea;color:#c62828}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
  label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
  input,textarea,select{width:100%;padding:8px 10px;border:1px solid var(--b);border-radius:6px;font:inherit;background:#fff}
  input:disabled,textarea:disabled,select:disabled{background:#f5f6f8;color:#5a6775}
  textarea{min-height:52px;resize:vertical}.money{display:flex;gap:6px}.money .cur{max-width:84px;text-align:center}
  .files small{color:var(--muted)}
  .actions{margin-top:18px;display:flex;align-items:center;gap:12px;position:sticky;bottom:0;background:#fff;padding:10px 0}
  button{background:var(--accent);color:#fff;border:0;border-radius:6px;padding:9px 18px;font:inherit;cursor:pointer}button:disabled{opacity:.5;cursor:default}
  .msg{font-size:13px}.msg.ok{color:#2e7d32}.msg.err{color:#c62828}
</style></head>
<body>
  <div class="bar"><strong>Business Partner</strong>
    ${editable ? '<span class="pill edit">Editable</span>' : '<span class="pill lock">Locked — Account Open stage or later</span>'}
  </div>
  <form id="bpForm" class="grid">
    ${fieldsHtml}
    ${editable ? '<div class="actions"><button type="submit" id="saveBtn">Save</button><span class="msg" id="msg"></span></div>' : ''}
  </form>
<script src="//api.bitrix24.com/api/v1/"></script>
<script>
  BX24.init(function(){ BX24.fitWindow(); });
  var DEAL_ID = ${dealId};
  function readB64(file){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res([file.name,String(r.result).split(',')[1]||'']);};r.onerror=rej;r.readAsDataURL(file);});}
  var form=document.getElementById('bpForm');
  if(form){form.addEventListener('submit', async function(e){
    e.preventDefault();
    var btn=document.getElementById('saveBtn'),msg=document.getElementById('msg');
    btn.disabled=true;msg.className='msg';msg.textContent='Saving…';
    var payload={auth:(BX24.getAuth()||{}).access_token||'',deal_id:DEAL_ID,field:{},cur:{},keep:{},newfile:{}};
    form.querySelectorAll('[data-code]').forEach(function(el){payload.field[el.getAttribute('data-code')]=el.value;});
    form.querySelectorAll('[data-cur]').forEach(function(el){payload.cur[el.getAttribute('data-cur')]=el.value;});
    form.querySelectorAll('[data-keep]').forEach(function(el){var c=el.getAttribute('data-keep');(payload.keep[c]=payload.keep[c]||[]).push(el.value);});
    var fileInputs=form.querySelectorAll('input[type=file][data-filecode]');
    for(var i=0;i<fileInputs.length;i++){var c=fileInputs[i].getAttribute('data-filecode');for(var j=0;j<fileInputs[i].files.length;j++){var p=await readB64(fileInputs[i].files[j]);(payload.newfile[c]=payload.newfile[c]||[]).push(p);}}
    fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      .then(function(r){return r.json();})
      .then(function(d){if(d.ok){msg.className='msg ok';msg.textContent='Saved.';}else{msg.className='msg err';msg.textContent=d.error||'Save failed.';}})
      .catch(function(){msg.className='msg err';msg.textContent='Network error.';})
      .finally(function(){btn.disabled=false;});
  });}
</script>
</body></html>`);
}
