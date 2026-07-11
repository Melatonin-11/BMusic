import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON middleware
  app.use(express.json());

  // API Route: Bilibili Playlist Proxy
  app.get("/api/bilibili/playlist", async (req, res) => {
    try {
      const { media_id, pn = "1", ps = "20" } = req.query;
      const sessdata = req.headers["x-sessdata"] as string | undefined;

      if (!media_id) {
        res.status(400).json({ error: "Missing media_id parameter" });
        return;
      }

      const url = `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${media_id}&pn=${pn}&ps=${ps}&platform=web`;
      
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.bilibili.com/",
      };

      if (sessdata) {
        headers["Cookie"] = `SESSDATA=${encodeURIComponent(sessdata)}`;
      }

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        res.status(response.status).json({ 
          error: `Bilibili API responded with status ${response.status}` 
        });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Bilibili proxy error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // API Route: Simple Bilibili User Profile Proxy (optional, to verify cookie)
  app.get("/api/bilibili/nav", async (req, res) => {
    try {
      const sessdata = req.headers["x-sessdata"] as string | undefined;
      const url = "https://api.bilibili.com/x/web-interface/nav";

      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.bilibili.com/",
      };

      if (sessdata) {
        headers["Cookie"] = `SESSDATA=${encodeURIComponent(sessdata)}`;
      }

      const response = await fetch(url, { headers });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Bilibili Randomizer] Server running on http://localhost:${PORT} (${process.env.NODE_ENV || "development"})`);
  });
}

startServer();
