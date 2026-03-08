import { Router, Request, Response } from "express";

const router = Router();

function unwrapTrpc(json: any): any {
  return json?.result?.data?.json?.result || json?.result?.data?.json || json;
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { action, cookie, accessToken, payload, apiKey } = req.body;

    if (action === "session") {
      const r = await fetch("https://labs.google/fx/api/auth/session", { headers: { cookie } });
      const data = await r.json();
      return res.json({ status: r.status, data });
    }

    if (action === "create-project") {
      const r = await fetch("https://labs.google/fx/api/trpc/media.createOrUpdateWorkflow", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ json: { workflowMetadata: { workflowName: payload?.name || "Historia Project" } } }),
      });
      const text = await r.text();
      let data;
      try { data = unwrapTrpc(JSON.parse(text)); } catch { data = { raw: text.substring(0, 1000) }; }
      return res.json({ status: r.status, data });
    }

    if (action === "caption-image") {
      const r = await fetch("https://labs.google/fx/api/trpc/backbone.captionImage", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({
          json: {
            clientContext: { workflowId: payload?.workflowId || "" },
            captionInput: {
              candidatesCount: 1,
              mediaInput: { mediaCategory: payload?.mediaCategory || "MEDIA_CATEGORY_STYLE", rawBytes: payload?.rawBytes },
            },
          },
        }),
      });
      const text = await r.text();
      let data;
      try { data = unwrapTrpc(JSON.parse(text)); } catch { data = { raw: text.substring(0, 1000) }; }
      return res.json({ status: r.status, data });
    }

    if (action === "upload") {
      const r = await fetch("https://labs.google/fx/api/trpc/backbone.uploadImage", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({
          json: {
            clientContext: { workflowId: payload?.workflowId || "" },
            uploadMediaInput: {
              mediaCategory: payload?.mediaCategory || "MEDIA_CATEGORY_STYLE",
              rawBytes: payload?.rawBytes,
              caption: payload?.caption || "",
            },
          },
        }),
      });
      const text = await r.text();
      let data;
      try { data = unwrapTrpc(JSON.parse(text)); } catch { data = { raw: text.substring(0, 1000) }; }
      return res.json({ status: r.status, data });
    }

    if (action === "generate-recipe") {
      const r = await fetch("https://aisandbox-pa.googleapis.com/v1/whisk:runImageRecipe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text.substring(0, 1000) }; }
      return res.json({ status: r.status, data });
    }

    if (action === "generate") {
      const r = await fetch("https://aisandbox-pa.googleapis.com/v1:runImageFx", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text.substring(0, 1000) }; }
      return res.json({ status: r.status, data });
    }

    if (action === "groq-chat") {
      const key = apiKey || process.env.GROQ_API_KEY;
      if (!key) return res.json({ status: 500, data: { error: "GROQ_API_KEY not configured" } });
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text.substring(0, 1000) }; }
      return res.json({ status: r.status, data });
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
