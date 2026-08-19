# Shared scan counter — setup

LabelLens shows two tallies in the footer:

- **Local** — labels scanned on that device.
- **Global** — total across everyone using your deployed app.

**Both work with no setup.** The global counter defaults to a free keyless counting
service, so it displays on every device immediately after you deploy.

## Should you do the Cloudflare setup below?

The default is fine for a demo. Switch to your own Cloudflare Worker if you want the
counter to be dependable, because the free service has real limitations:

| | Free keyless service (default) | Your Cloudflare Worker |
|---|---|---|
| Setup | none | ~10 minutes |
| Can disappear | yes — the service it replaced already shut down | no, it's yours |
| Key is public | yes, anyone who finds it can inflate the count | origin-locked + rate limited |
| Cost | free | free (well within Cloudflare's limits) |

Either way, if the counter is unreachable the app silently shows the local count only.
A counter should never be able to break a live demo.

**Changing the default key:** in `labellens.html`, edit `COUNTAPI_KEY`. The service has
no namespaces — every key shares one global space — so pick something long and unique,
or you may end up sharing a counter with a stranger. All keys and values are public;
never put anything sensitive in the key.

---

## 1. Create the KV namespace

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free, no card required)
2. In the sidebar: **Storage & Databases → KV**
3. **Create a namespace**, name it `labellens-counter`

## 2. Create the Worker

1. Sidebar: **Compute (Workers) → Create → Start from Hello World**
2. Name it something like `labellens-counter`, click **Deploy**
3. Click **Edit code**
4. Delete the placeholder and paste the entire contents of `counter-worker.js`
5. **Before deploying**, edit the `ALLOWED_ORIGINS` list at the top to your real site:

```js
const ALLOWED_ORIGINS = [
  'https://your-actual-site.netlify.app',
  'http://localhost:8000',
];
```

6. Click **Deploy**

## 3. Bind the KV namespace

The Worker needs `env.COUNTER` to point at your namespace:

1. In the Worker: **Settings → Bindings → Add → KV namespace**
2. **Variable name:** `COUNTER` (exactly this — the code references `env.COUNTER`)
3. **KV namespace:** select `labellens-counter`
4. **Deploy** again so the binding takes effect

## 4. Point the app at your Worker

Copy the Worker URL (like `https://labellens-counter.your-name.workers.dev`), then in
`labellens.html` find:

```js
const COUNTER_API_URL = null;
```

and set it:

```js
const COUNTER_API_URL = 'https://labellens-counter.your-name.workers.dev';
```

Re-upload `labellens.html`. The footer should now read something like:

> **1,847** labels scanned by everyone · **12** scanned on this device

---

## Testing it

```bash
# Should return {"count":0}
curl https://labellens-counter.your-name.workers.dev

# Should return {"count":1}
curl -X POST https://labellens-counter.your-name.workers.dev
```

If `curl` works but the app doesn't show a global count, it's almost always
`ALLOWED_ORIGINS` not matching your deployed origin exactly — scheme and subdomain
included, no trailing slash.

---

## Things worth knowing

**Counts can drift slightly under load.** KV has no atomic increment, so two scans in
the same instant can read the same value and both write N+1, losing one. For a vanity
total that's a fine trade. If you ever need exactness, swap KV for a Durable Object.

**The endpoint is public.** Any key shipped to a static page is readable, so there's no
authentication. Protections are `ALLOWED_ORIGINS` plus a 20-increments-per-minute-per-IP
rate limit. Worst case is an inflated number, not a breach or a bill.

**Resetting the counter:** KV → your namespace → find `scan_count` → edit or delete it.

**If the Worker is unreachable**, the app silently falls back to the local count. This
is deliberate — a counter should never be able to break a live demo.
