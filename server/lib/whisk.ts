import fs from "fs";
import path from "path";

export interface WhiskStyleRef {
  mediaGenerationId: string;
  caption: string;
}

async function getWhiskSession(cookie: string): Promise<string> {
  const res = await fetch("https://labs.google/fx/api/auth/session", { headers: { cookie } });
  if (!res.ok) throw new Error(`Whisk session failed: ${res.status}`);
  const data = await res.json();
  const accessToken = data?.access_token;
  if (!accessToken) throw new Error("No access_token in Whisk session — cookie may be expired");
  return accessToken;
}

function unwrapTrpc(json: any): any {
  return json?.result?.data?.json?.result || json?.result?.data?.json || json;
}

async function createWhiskProject(cookie: string): Promise<string> {
  const res = await fetch("https://labs.google/fx/api/trpc/media.createOrUpdateWorkflow", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      json: { workflowMetadata: { workflowName: "Historia-" + Date.now() } },
    }),
  });
  const text = await res.text();
  let data: any;
  try { data = unwrapTrpc(JSON.parse(text)); } catch { throw new Error(`Whisk create-project parse error: ${text.substring(0, 300)}`); }
  if (res.status >= 400) throw new Error(`Whisk create-project failed (${res.status}): ${JSON.stringify(data).substring(0, 300)}`);
  const workflowId = data?.workflowId;
  if (!workflowId) throw new Error(`No workflowId from Whisk. Response: ${JSON.stringify(data).substring(0, 300)}`);
  return workflowId;
}

async function captionWhiskImage(rawBytes: string, workflowId: string, cookie: string): Promise<string> {
  const res = await fetch("https://labs.google/fx/api/trpc/backbone.captionImage", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      json: {
        clientContext: { workflowId },
        captionInput: {
          candidatesCount: 1,
          mediaInput: {
            mediaCategory: "MEDIA_CATEGORY_STYLE",
            rawBytes,
          },
        },
      },
    }),
  });
  const text = await res.text();
  if (res.status >= 400) {
    console.warn(`Whisk caption failed (${res.status}), using empty caption`);
    return "";
  }
  let data: any;
  try { data = unwrapTrpc(JSON.parse(text)); } catch { return ""; }
  return data?.candidates?.[0]?.output || "";
}

async function uploadToWhisk(rawBytes: string, caption: string, workflowId: string, cookie: string): Promise<string> {
  const res = await fetch("https://labs.google/fx/api/trpc/backbone.uploadImage", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      json: {
        clientContext: { workflowId },
        uploadMediaInput: {
          mediaCategory: "MEDIA_CATEGORY_STYLE",
          rawBytes,
          caption,
        },
      },
    }),
  });
  const text = await res.text();
  let data: any;
  try { data = unwrapTrpc(JSON.parse(text)); } catch { throw new Error(`Whisk upload parse error: ${text.substring(0, 300)}`); }
  if (res.status >= 400) throw new Error(`Whisk upload failed (${res.status}): ${JSON.stringify(data).substring(0, 300)}`);
  const mediaId = data?.uploadMediaGenerationId;
  if (!mediaId) throw new Error(`No uploadMediaGenerationId from Whisk. Response: ${JSON.stringify(data).substring(0, 300)}`);
  return mediaId;
}

function fileToBase64DataUrl(filePath: string): string {
  const bytes = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const mime = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function decodeEncodedImage(encodedImage: string): Uint8Array {
  const binary = atob(encodedImage);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function generateWhiskImageWithRefs(
  prompt: string,
  cookie: string,
  styleImagePaths: string[]
): Promise<Uint8Array> {
  const accessToken = await getWhiskSession(cookie);

  const existingStylePaths = styleImagePaths.filter(p => {
    if (!p) return false;
    const exts = [p, p.replace(/\.png$/, ".jpg"), p.replace(/\.png$/, ".jpeg"), p.replace(/\.png$/, ".webp")];
    return exts.some(e => fs.existsSync(e));
  });

  if (existingStylePaths.length === 0) {
    return generateWhiskImagePlain(prompt, accessToken);
  }

  const workflowId = await createWhiskProject(cookie);
  console.log(`[whisk] Created project: ${workflowId}`);

  const styleRefs: WhiskStyleRef[] = [];

  for (const stylePath of existingStylePaths) {
    const actualPath = [stylePath,
      stylePath.replace(/\.png$/, ".jpg"),
      stylePath.replace(/\.png$/, ".jpeg"),
      stylePath.replace(/\.png$/, ".webp"),
    ].find(p => fs.existsSync(p));

    if (!actualPath) continue;

    try {
      const rawBytes = fileToBase64DataUrl(actualPath);
      const caption = await captionWhiskImage(rawBytes, workflowId, cookie);
      console.log(`[whisk] Captioned style ref: ${caption.substring(0, 80)}`);

      const mediaId = await uploadToWhisk(rawBytes, caption, workflowId, cookie);
      console.log(`[whisk] Uploaded style ref, mediaId: ${mediaId}`);

      styleRefs.push({ mediaGenerationId: mediaId, caption });
    } catch (e: any) {
      console.warn(`[whisk] Failed to process style ref ${actualPath}: ${e.message}`);
    }
  }

  if (styleRefs.length === 0) {
    console.warn("[whisk] No style refs uploaded successfully, falling back to plain generation");
    return generateWhiskImagePlain(prompt, accessToken);
  }

  const recipeMediaInputs = styleRefs.map(ref => ({
    caption: ref.caption,
    mediaInput: {
      mediaCategory: "MEDIA_CATEGORY_STYLE",
      mediaGenerationId: ref.mediaGenerationId,
    },
  }));

  console.log(`[whisk] Generating with ${styleRefs.length} style ref(s) using generate-recipe`);

  const genRes = await fetch("https://aisandbox-pa.googleapis.com/v1/whisk:runImageRecipe", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      clientContext: {
        workflowId,
        tool: "BACKBONE",
      },
      imageModelSettings: {
        imageModel: "GEM_PIX",
        aspectRatio: "IMAGE_ASPECT_RATIO_LANDSCAPE",
      },
      userInstruction: prompt,
      recipeMediaInputs,
      seed: 0,
    }),
  });

  if (!genRes.ok) {
    const errText = await genRes.text();
    console.error(`[whisk] generate-recipe failed ${genRes.status}: ${errText.substring(0, 500)}`);
    if (genRes.status === 429) throw new Error("Whisk rate limited — wait a minute and try again.");
    if (genRes.status === 401 || genRes.status === 403) throw new Error("Whisk auth expired. Update your Whisk Cookie.");
    throw new Error(`Whisk recipe failed (${genRes.status}): ${errText.substring(0, 200)}`);
  }

  const genData = await genRes.json();
  const encodedImage = genData?.imagePanels?.[0]?.generatedImages?.[0]?.encodedImage;
  if (!encodedImage) throw new Error("No image in Whisk recipe response");

  return decodeEncodedImage(encodedImage);
}

async function generateWhiskImagePlain(prompt: string, accessToken: string): Promise<Uint8Array> {
  const genRes = await fetch("https://aisandbox-pa.googleapis.com/v1:runImageFx", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      userInput: { candidatesCount: 1, prompts: [prompt] },
      generationParams: { seed: null },
      clientContext: { tool: "WHISK" },
      modelInput: { modelNameType: "IMAGEN_3_5" },
      aspectRatio: "LANDSCAPE",
    }),
  });

  if (!genRes.ok) {
    const errText = await genRes.text();
    throw new Error(`Whisk generation failed: ${genRes.status} - ${errText.substring(0, 200)}`);
  }

  const genData = await genRes.json();
  const encodedImage = genData?.imagePanels?.[0]?.generatedImages?.[0]?.encodedImage;
  if (!encodedImage) throw new Error("No image in Whisk response");

  return decodeEncodedImage(encodedImage);
}

export function getStyleImagePaths(projectId: string): string[] {
  return [
    path.join("uploads", projectId, "style", "style1.png"),
    path.join("uploads", projectId, "style", "style2.png"),
  ];
}
