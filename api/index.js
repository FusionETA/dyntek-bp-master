// BP Master — deal card tab (and self-install when opened as the app itself).
// Fields render in two sections (Project / Business Partner). Read-only state
// here is UX only; the real permission lock is enforced in /api/save.
import { CONFIG } from '../lib/config.js';
import { b24call, getBody, authFromBody, currentUserId, canEdit, bindTab, bindDealEvent, esc } from '../lib/b24.js';

const idOf = (code) => 'f_' + String(code).replace(/[^A-Za-z0-9_]/g, '');

function fileIds(raw) {
  const out = [];
  for (const it of (Array.isArray(raw) ? raw : [])) {
    const id = (it && typeof it === 'object') ? (it.id ?? it.ID) : it;
    if (id !== null && id !== undefined && id !== '') out.push(String(id));
  }
  return out;
}

function renderField(f, ctx, canEditNow) {
  const deal = ctx.deal;
  const writable = canEditNow && !f.readOnly;
  const dis = writable ? '' : 'disabled';
  const id = idOf(f.code);
  const req = f.required ? ' <span class="req">*</span>' : '';
  const autoTag = (f.readOnly && f.type !== 'companyName' && f.type !== 'dealTitle') ? ' <span class="muted">(auto)</span>' : '';
  const label = `<label for="${esc(id)}">${esc(f.label)}${req}${autoTag}</label>`;
  const val = deal[f.code];

  switch (f.type) {
    case 'companyName':
      return `<label>${esc(f.label)}</label><input value="${esc(ctx.companyTitle || '')}" disabled>`;
    case 'dealTitle':
      return `<label>${esc(f.label)}</label><input value="${esc(deal.TITLE || '')}" disabled>`;
    case 'textarea':
      return `${label}<textarea id="${esc(id)}" data-code="${esc(f.code)}" ${dis}>${esc(val ?? '')}</textarea>`;
    case 'number': {
      if (f.computed) {
        const opp = parseFloat(deal.OPPORTUNITY || 0) || 0;
        const pct = parseFloat(deal[f.computed.pct]); const pctV = (pct || pct === 0) ? pct : 85;
        const cv = (opp && pctV) ? Math.round(opp * pctV / 100 * 100) / 100 : '';
        return `${label}<input id="${esc(id)}" value="${esc(cv)}" data-compute="pct" data-of="${esc(f.computed.pctOf)}" data-pct="${esc(f.computed.pct)}" disabled>`;
      }
      let v = val ?? '';
      if ((v === '' || v == null) && f.default != null) v = f.default;
      return `${label}<input id="${esc(id)}" data-code="${esc(f.code)}" value="${esc(v)}" inputmode="decimal" ${dis}>`;
    }
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
      return `${label}<select id="${esc(id)}" data-code="${esc(f.code)}" ${dis}><option value="">—</option>${opts}</select>`;
    }
    case 'file': {
      const ids = fileIds(val);
      const keeps = ids.map((fid) => `<input type="hidden" data-keep="${esc(f.code)}" value="${esc(fid)}">`).join('');
      const uploader = writable ? `<input type="file" data-filecode="${esc(f.code)}" ${f.multiple ? 'multiple' : ''}>` : '';
      return `${label}<div class="files">${keeps}<small>${ids.length} file(s) attached${writable ? ' — new uploads are added to these' : ''}.</small>${uploader}</div>`;
    }
    default:
      return `${label}<input id="${esc(id)}" data-code="${esc(f.code)}" value="${esc(val ?? '')}" ${dis}>`;
  }
}

function fieldWrap(f, ctx, editable) {
  const sw = f.showWhen
    ? ` data-showwhen-code="${esc(f.showWhen.field)}" data-showwhen-is="${esc(f.showWhen.is)}"` : '';
  const flags = `${f.required ? ' data-required="1"' : ''}${f.showWhen ? ' data-conditional="1"' : ''}${f.type === 'file' ? ' data-isfile="1"' : ''}`;
  return `<div class="field${f.full ? ' full' : ''}"${sw}${flags}>${renderField(f, ctx, editable)}</div>`;
}

// Compact read-only header strip (Company / Project / BP Master Code).
function contextBanner(fields, ctx) {
  const chips = fields.map((f) => {
    let v;
    if (f.type === 'companyName') v = ctx.companyTitle;
    else if (f.type === 'dealTitle') v = ctx.deal.TITLE;
    else v = ctx.deal[f.code];
    return `<div class="chip"><span>${esc(f.label)}</span><b>${esc(v || '—')}</b></div>`;
  }).join('');
  return `<div class="ctx">${chips}</div>`;
}

// Nest fields: section -> group (both contiguous in array order).
function buildSections(fields) {
  const sections = [];
  for (const f of fields) {
    let s = sections[sections.length - 1];
    if (!s || s.key !== f.section) { s = { key: f.section, groups: [] }; sections.push(s); }
    let g = s.groups[s.groups.length - 1];
    if (!g || g.key !== f.group) { g = { key: f.group, fields: [] }; s.groups.push(g); }
    g.fields.push(f);
  }
  return sections;
}

export default async function handler(req, res) {
  const body = await getBody(req);
  const auth = String(body.AUTH_ID || authFromBody(body) || '');

  let dealId = 0;
  const po = body.PLACEMENT_OPTIONS;
  if (po) { try { const o = typeof po === 'string' ? JSON.parse(po) : po; dealId = parseInt(o.ID || 0, 10) || 0; } catch { /* ignore */ } }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // Opened as the app itself (app context, no deal) -> self-install / bind.
  if (auth && dealId === 0) {
    const host = req.headers.host;
    const r = await bindTab(CONFIG.DOMAIN, auth, `https://${host}/api/index`);
    const okb = !!r.data?.result;
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

  // Self-heal the auto-numbering event binding (tab always has app-context auth).
  try { await bindDealEvent(CONFIG.DOMAIN, auth, `https://${req.headers.host}/api/event`); } catch { /* non-blocking */ }

  const userId = await currentUserId(CONFIG.DOMAIN, auth);
  const dr = await b24call(CONFIG.DOMAIN, 'crm.deal.get', { id: dealId }, auth);
  const deal = dr.data?.result || {};
  const editable = !!deal.ID && await canEdit(CONFIG.DOMAIN, auth, userId, deal);

  let companyTitle = '';
  if (deal.COMPANY_ID) {
    const cr = await b24call(CONFIG.DOMAIN, 'crm.company.get', { id: deal.COMPANY_ID }, auth);
    companyTitle = cr.data?.result?.TITLE || '';
  }
  const ctx = { deal, companyTitle };

  // Section -> titled sub-group cards (array order is authoritative).
  const bodyHtml = buildSections(CONFIG.BP_FIELDS).map((s) => `
    <h3 class="section">${esc(CONFIG.SECTION_LABELS[s.key] || s.key)}</h3>
    ${s.groups.map((g) => g.key === '_context'
      ? contextBanner(g.fields, ctx)
      : `<div class="group"><div class="gtitle">${esc(g.key)}</div>
           <div class="grid">${g.fields.map((f) => fieldWrap(f, ctx, editable)).join('')}</div></div>`
    ).join('')}`).join('');

  res.status(200).send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BP Master</title>
<style>
  :root{--b:#e6e9ef;--muted:#707a8a;--accent:#2066b0}*{box-sizing:border-box}
  body{font:14px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2733;margin:0;padding:16px}
  .bar{display:flex;align-items:center;gap:10px;margin-bottom:14px;position:sticky;top:0;background:#fff;padding:4px 0;z-index:2}
  .pill{font-size:12px;padding:3px 10px;border-radius:999px}.pill.edit{background:#e8f5e9;color:#2e7d32}.pill.lock{background:#fdecea;color:#c62828}
  h3.section{font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);margin:24px 0 12px}
  .group{border:1px solid var(--b);border-radius:10px;padding:14px;margin-bottom:14px;background:#fff}
  .gtitle{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#8a94a6;margin-bottom:12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px 16px}
  .field.full{grid-column:1/-1}
  .ctx{display:flex;flex-wrap:wrap;gap:8px 24px;background:#f4f8fd;border:1px solid #e1e9f4;border-radius:10px;padding:11px 16px;margin-bottom:14px}
  .ctx .chip{display:flex;flex-direction:column;min-width:130px}
  .ctx .chip span{font-size:11px;color:var(--muted)}.ctx .chip b{font-size:13px;color:#1b2733}
  label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
  .req{color:#c62828;font-weight:700}.muted{color:#9aa4b2}
  input,textarea,select{width:100%;padding:8px 10px;border:1px solid var(--b);border-radius:6px;font:inherit;background:#fff}
  input:disabled,textarea:disabled,select:disabled{background:#f5f6f8;color:#5a6775}
  textarea{min-height:52px;resize:vertical}.money{display:flex;gap:6px}.money .cur{max-width:84px;text-align:center}
  .files small{color:var(--muted)}
  .actions{margin-top:18px;display:flex;align-items:center;gap:12px;position:sticky;bottom:0;background:#fff;padding:10px 0}
  button{background:var(--accent);color:#fff;border:0;border-radius:6px;padding:9px 18px;font:inherit;cursor:pointer}button:disabled{opacity:.5;cursor:default}
  .msg{font-size:13px}.msg.ok{color:#2e7d32}.msg.err{color:#c62828}
</style></head>
<body>
  <div class="bar"><strong>BP Master</strong>
    ${editable ? '<span class="pill edit">Editable</span>' : '<span class="pill lock">Locked — Account Open stage or later</span>'}
  </div>
  <form id="bpForm">
    ${bodyHtml}
    ${editable ? '<div class="actions"><button type="submit" id="saveBtn">Save</button><span class="msg" id="msg"></span></div>' : ''}
  </form>
<script src="//api.bitrix24.com/api/v1/"></script>
<script>
  BX24.init(function(){ BX24.fitWindow(); });
  var DEAL_ID = ${dealId};
  var form=document.getElementById('bpForm');
  function ctrl(code){ return form.querySelector('[data-code="'+code+'"]'); }

  // Show/hide conditional fields based on their controlling Yes/No select.
  function applyConditions(){
    form.querySelectorAll('[data-showwhen-code]').forEach(function(el){
      var c=ctrl(el.getAttribute('data-showwhen-code'));
      el.style.display=(c && String(c.value)===String(el.getAttribute('data-showwhen-is')))?'':'none';
    });
  }
  // Recompute read-only derived values (Cap Value = Project Value x Cap%).
  function recompute(){
    form.querySelectorAll('[data-compute="pct"]').forEach(function(el){
      var of=ctrl(el.getAttribute('data-of')), pc=ctrl(el.getAttribute('data-pct'));
      var o=parseFloat((of&&of.value)||0)||0, p=parseFloat((pc&&pc.value)||0)||0;
      el.value=(o&&p)?String(Math.round(o*p/100*100)/100):'';
    });
  }
  if(form){
    form.addEventListener('change',function(){applyConditions();recompute();});
    form.addEventListener('input',function(){recompute();});
    applyConditions();recompute();
  }

  function readB64(file){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res([file.name,String(r.result).split(',')[1]||'']);};r.onerror=rej;r.readAsDataURL(file);});}

  // A visible, conditionally-required field must have a value before saving.
  function missingRequired(){
    var miss=[];
    form.querySelectorAll('.field[data-conditional="1"][data-required="1"]').forEach(function(w){
      if(w.style.display==='none')return;
      if(w.getAttribute('data-isfile')==='1'){
        var hasOld=w.querySelector('[data-keep]'); var inp=w.querySelector('input[type=file]');
        if(!hasOld && !(inp && inp.files && inp.files.length)) miss.push(w);
      } else {
        var c=w.querySelector('[data-code]');
        if(c && String(c.value).trim()==='') miss.push(w);
      }
    });
    return miss;
  }

  if(form){form.addEventListener('submit', async function(e){
    e.preventDefault();
    var btn=document.getElementById('saveBtn'),msg=document.getElementById('msg');
    var miss=missingRequired();
    if(miss.length){
      var names=miss.map(function(w){var l=w.querySelector('label');return l?l.textContent.replace('*','').trim():'';});
      msg.className='msg err';msg.textContent='Please fill: '+names.join(', ');
      return;
    }
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
