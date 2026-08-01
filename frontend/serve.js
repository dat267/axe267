const { serve, file } = Bun;

const dist = `${import.meta.dir}/dist`;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".map": "application/json",
};

// Vite emits hashed assets under /assets/*; those are immutable and safe to
// cache long-term. Everything else is served fresh so HTML reflects deploys.
const isHashedAsset = (path) => path.startsWith("/assets/");

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

async function sendFile(path, res) {
  const f = file(dist + path);
  const ok = await f.exists();
  if (!ok) return new Response("Not found", { status: 404 });
  const ext = path.slice(path.lastIndexOf("."));
  const headers = {
    "Content-Type": MIME[ext] || "application/octet-stream",
    ...securityHeaders,
  };
  if (isHashedAsset(path)) {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  } else {
    headers["Cache-Control"] = "no-cache";
  }
  return res(f, { headers });
}

serve({
  port: process.env.PORT || 4173,
  fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    // SPA fallback: routes without a file extension (and the root) render
    // index.html, so client-side navigation and deep links both work. Requests
    // for actual asset files are left untouched and 404 if missing.
    if (path === "/" || !path.includes(".")) {
      path = "/index.html";
    }
    return sendFile(path, (body, init) => new Response(body, init));
  },
});
