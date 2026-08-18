// LabelLens optional configuration
//
// SETUP: copy this file to `config.js` and fill in your key.
//   cp config.example.js config.js
//
// `config.js` is listed in .gitignore so it is NOT committed. This file
// (config.example.js) is the safe, keyless template that IS committed.
//
// If config.js is absent, LabelLens works normally — the BarcodeNest lookup
// is simply skipped and only the free, keyless Open Facts databases are used.
//
// ⚠️  READ THIS BEFORE DEPLOYING WITH A KEY  ⚠️
// BarcodeNest's documentation states: "Do not expose one in client-side code or
// public repositories."
//
// LabelLens is a static, client-side app. That means once you deploy config.js
// to GitHub Pages (or any static host), the key inside it is downloaded by every
// visitor's browser and readable via View Source or devtools. Gitignoring the file
// keeps it out of your Git history, but does NOT hide it from users of a deployed site.
//
// So:
//   • Local testing only  → this setup is fine.
//   • Public deployment   → do NOT deploy config.js. Either leave BarcodeNest
//                           disabled, or route the request through a small server-side
//                           proxy that holds the key (see README-barcodenest.md).
//
// Either way: use a free-tier key you can revoke, never a paid one, and rotate it
// if you think it has leaked. BarcodeNest lets you regenerate/revoke keys from
// your account dashboard.

window.LABELLENS_CONFIG = {
  // Get a free key (250 lookups/month) at https://barcodenest.com
  // Leave as null to disable the BarcodeNest fallback entirely.
  barcodeNestApiKey: null,
};
