# Appwrite setup notes for LearnSpanishForAll

## Automatic ping

When Practice opens, `assets/appwrite-client.js` creates the Appwrite `Client`,
`Account`, and `Databases` objects and calls:

```js
client.ping();
```

Results appear in the browser console as `[Appwrite] ping OK` (or a failure
warning) and in the Practice dashboard status line.

## Why not `npm install appwrite`?

This project is a static Markdown → HTML site (no Vite/React/npm app). The
Appwrite web SDK is loaded from CDN on `practice.html`, matching the proven
yt2site Practice pattern and avoiding a Node toolchain.
