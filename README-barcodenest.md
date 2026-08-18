# BarcodeNest fallback — setup and the API key problem

LabelLens can optionally use [BarcodeNest](https://barcodenest.com) as a fallback when a
barcode isn't found in Open Food Facts, Open Beauty Facts, or Open Products Facts.

**It is off by default.** With no key configured, LabelLens skips it entirely and works
normally using only the free, keyless open databases.

---

## The problem you need to understand first

BarcodeNest's own documentation says:

> Do not expose one in client-side code or public repositories.

LabelLens is a **static client-side app**. There is no server. Every line of JavaScript it
runs — including any API key — is downloaded by the visitor's browser and readable through
View Source or devtools.

This means:

| | Key stays secret? |
|---|---|
| Running locally on your own machine | ✅ Yes |
| Committed to a public GitHub repo | ❌ No — it's in your Git history forever |
| Gitignored but deployed to GitHub Pages | ❌ No — every visitor downloads it |

`.gitignore` solves the *second* row only. It keeps the key out of your commit history. It
does **not** hide the key from anyone who visits your deployed site, because the browser
must be able to read the file in order to use it.

There is no way around this in a purely static app. It is a structural property of
client-side code, not a configuration mistake.

---

## Option A — Local testing only (simplest, recommended to start)

Use BarcodeNest while developing on your own machine, and don't deploy the key.

```bash
cp config.example.js config.js
# edit config.js and paste your free key
python3 -m http.server 8000
# visit http://localhost:8000/labellens.html
```

When you deploy, just **don't upload `config.js`**. The deployed site falls back to the
open databases only. Nothing breaks.

---

## Option B — Deploy with no BarcodeNest at all (default)

Do nothing. Ship the 7 core files without `config.js`. This is the current default state
of the repo and is completely fine — the Open Facts family covers a large majority of
consumer packaged goods, and the photo-OCR path handles anything they miss.

---

## Option C — Server-side proxy (the only safe way to deploy it)

If you genuinely need BarcodeNest on a public deployment, the key has to live somewhere
the browser can't read. That means a tiny server that holds the key and forwards requests.

A minimal version using a serverless function (Cloudflare Workers, Vercel, Netlify
Functions all work and have free tiers):

```js
// api/barcode.js  — the key lives in an environment variable, never in client code
export default async function handler(req, res) {
  const code = req.query.code;
  if (!/^\d{8,14}$/.test(code || '')) {
    return res.status(400).json({ error: 'invalid barcode' });
  }
  const r = await fetch(`https://api.barcodenest.com/v1/products/${code}`, {
    headers: { 'X-API-Key': process.env.BARCODENEST_KEY }
  });
  res.status(r.status).json(await r.json());
}
```

Then point LabelLens at your proxy instead of BarcodeNest directly, by changing
`BARCODENEST_ENDPOINT` in `labellens.html` to your function's URL and removing the
`X-API-Key` header (the proxy adds it).

This also lets you add your own rate limiting, which matters — see below.

---

## Quota behaviour

The free tier is **250 lookups/month**, roughly 8/day. LabelLens is built around that:

- BarcodeNest is queried **sequentially, only after all three open databases miss** — it is
  deliberately not part of the parallel batch, so a scan that Open Food Facts can answer
  costs zero BarcodeNest quota.
- Results are cached per session, so re-scanning the same barcode doesn't spend a second call.
- A `429` response (rate limit / quota exhausted) is caught and logged, and the app falls
  through to the "use the photo option" message rather than showing an error.
- Requests time out after **5 seconds** so a slow response can't stall a scan.

If you deploy publicly with a working key and the app gets any real traffic, expect the
monthly quota to be consumed quickly by strangers. This is another reason Option A or B is
usually the right call for a student/demo project.

---

## Revoking a leaked key

If you accidentally commit or deploy a key, revoke it immediately from the BarcodeNest
account dashboard and generate a new one. Note that removing it in a later commit does
**not** remove it from your Git history — anyone can read it from the earlier commit.
Revoking is the only real fix.
