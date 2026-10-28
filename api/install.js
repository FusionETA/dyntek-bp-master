// Install handler. Bitrix calls this on install/reinstall (ONAPPINSTALL event,
// server-to-server, token nested as auth[access_token]). We bind the deal-card
// tab in the app's own context (the only context allowed for placement.bind).
import { CONFIG } from '../lib/config.js';
import { getBody, authFromBody, bindTab } from '../lib/b24.js';

export default async function handler(req, res) {
  const body = await getBody(req);
  const auth = authFromBody(body);
  const handlerUrl = `https://${req.headers.host}/api/index`;

  let bound = false;
  let err = null;
  if (auth) {
    const r = await bindTab(CONFIG.DOMAIN, auth, handlerUrl);
    bound = !!r.data?.result;
    err = r.data?.error_description || r.data?.error || null;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html><meta charset="utf-8">
<body style="font:14px -apple-system,Arial,sans-serif;padding:16px">
<script src="//api.bitrix24.com/api/v1/"></script>
<script>try{BX24.init(function(){BX24.installFinish();});}catch(e){}</script>
${auth === ''
    ? '<p>No auth received from Bitrix.</p>'
    : bound
      ? '<p>✅ BP Master installed. Open any deal to see the <b>BP Master</b> tab.</p>'
      : `<p>Installed, but binding the tab failed: ${err}</p>`}
</body>`);
}
