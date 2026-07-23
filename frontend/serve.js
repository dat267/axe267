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

serve({
  port: process.env.PORT || 4173,
  fetch(req) {
    let path = new URL(req.url).pathname;
    if (path === "/" || !path.includes(".")) path = "/index.html";
    const f = file(dist + path);
    return f.exists().then((ok) => {
      if (!ok) return new Response("Not found", { status: 404 });
      const ext = path.slice(path.lastIndexOf("."));
      return new Response(f, {
        headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
      });
    });
  },
});
