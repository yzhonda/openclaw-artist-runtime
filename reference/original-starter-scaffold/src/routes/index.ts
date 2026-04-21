export function registerRoutes(api: any): void {
  // TODO: Verify current registerHttpRoute signature.
  api.registerHttpRoute?.({
    path: "/plugins/artist-runtime",
    match: "prefix",
    auth: "gateway",
    async handler(req: any, res: any) {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.endsWith("/api/status")) {
        const body = JSON.stringify({
          ok: true,
          plugin: "artist-runtime",
          status: "scaffold",
          next: "Implement services and console UI.",
        });
        res.statusCode = 200;
        res.setHeader?.("content-type", "application/json");
        res.end?.(body);
        return true;
      }
      const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Artist Runtime</title></head>
<body><h1>Artist Runtime Producer Console</h1><p>Scaffold route is alive.</p><p>API: <a href="/plugins/artist-runtime/api/status">/api/status</a></p></body></html>`;
      res.statusCode = 200;
      res.setHeader?.("content-type", "text/html; charset=utf-8");
      res.end?.(html);
      return true;
    },
  });
}