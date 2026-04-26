import fs from "fs";
import path from "path";
import { Whisk, Media, VideoGenerationModel } from "@rohitaryal/whisk-api";

function decodeEncodedImage(encodedImage: string): Uint8Array {
  const binary = atob(encodedImage);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function resolveExistingPath(base: string): string | null {
  const candidates = [
    base,
    base.replace(/\.png$/, ".jpg"),
    base.replace(/\.png$/, ".jpeg"),
    base.replace(/\.png$/, ".webp"),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

export async function createWhiskProject(cookie: string, styleImagePaths: string[]): Promise<{ project: any; refsAdded: number }> {
  const whisk = new Whisk(cookie);
  const project = await whisk.newProject("Historia-" + Date.now());

  let refsAdded = 0;

  const subjectPath = resolveExistingPath(styleImagePaths[0] || "");
  if (subjectPath) {
    try {
      await project.addSubject({ file: subjectPath });
      refsAdded++;
      console.log(`[whisk] Added subject ref: ${subjectPath}`);
    } catch (e: any) {
      console.warn(`[whisk] addSubject failed: ${e.message}`);
    }
  }

  const stylePath = resolveExistingPath(styleImagePaths[1] || "");
  if (stylePath) {
    try {
      await project.addStyle({ file: stylePath });
      refsAdded++;
      console.log(`[whisk] Added style ref: ${stylePath}`);
    } catch (e: any) {
      console.warn(`[whisk] addStyle failed: ${e.message}`);
    }
  }

  console.log(`[whisk] Project ready with ${refsAdded} reference(s)`);
  return { project, refsAdded };
}

export async function generateImageFromProject(project: any, prompt: string, refsAdded: number): Promise<Uint8Array> {
  console.log(`[whisk] Generating: ${prompt.substring(0, 100)}...`);

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Whisk generation timed out after 60s")), 60000)
  );

  const genPromise = refsAdded > 0
    ? project.generateImageWithReferences({ prompt, aspectRatio: "IMAGE_ASPECT_RATIO_LANDSCAPE" })
    : project.generateImage({ prompt, aspectRatio: "IMAGE_ASPECT_RATIO_LANDSCAPE" });

  const media = await Promise.race([genPromise, timeoutPromise]);

  const encodedImage = (media as any).encodedMedia;
  if (!encodedImage) throw new Error("No image in Whisk response");

  console.log(`[whisk] Image generated successfully`);
  return decodeEncodedImage(encodedImage);
}

export async function generateWhiskImageWithRefs(
  prompt: string,
  cookie: string,
  styleImagePaths: string[]
): Promise<Uint8Array> {
  const { project, refsAdded } = await createWhiskProject(cookie, styleImagePaths);
  return generateImageFromProject(project, prompt, refsAdded);
}

export function getStyleImagePaths(projectId: string): string[] {
  return [
    path.join("uploads", projectId, "style", "style1.png"),
    path.join("uploads", projectId, "style", "style2.png"),
  ];
}

const VEO_31_LITE_MODEL = "veo-3.1-lite-generate-preview";

async function animateWithVeo31Lite(
  imagePath: string,
  cookie: string,
  videoScript: string
): Promise<Buffer> {
  const whisk = new Whisk(cookie);
  await (whisk as any).account.refresh();
  const token: string = await (whisk as any).account.getToken();

  const project = await whisk.newProject("Historia-anim-" + Date.now());
  const workflowId: string = (project as any).projectId;

  const imageData = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase().replace(".", "") || "png";
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  const encodedImage = `data:${mimeType};base64,${imageData.toString("base64")}`;
  const prompt = videoScript || "Cinematic camera slowly pans across the scene";

  const genRes = await fetch("https://aisandbox-pa.googleapis.com/v1/whisk:generateVideo", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      promptImageInput: { prompt, rawBytes: encodedImage },
      modelNameType: VEO_31_LITE_MODEL,
      modelKey: "",
      userInstructions: prompt,
      loopVideo: false,
      clientContext: { workflowId },
    }),
  });

  if (!genRes.ok) {
    const errText = await genRes.text().catch(() => "");
    throw new Error(`Veo 3.1 lite generate failed (${genRes.status}): ${errText.substring(0, 200)}`);
  }

  const genData = await genRes.json();
  const operationName: string | undefined = genData?.operation?.operation?.name;
  if (!operationName) throw new Error("No operation name from Veo 3.1 lite");

  // Poll up to 60 × 2s = 2 minutes
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch("https://aisandbox-pa.googleapis.com/v1:runVideoFxSingleClipsStatusCheck", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ operations: [{ operation: { name: operationName } }] }),
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();

    if (pollData.status === "MEDIA_GENERATION_STATUS_SUCCESSFUL") {
      const rawBytes: string | undefined = pollData.operations?.[0]?.rawBytes;
      if (!rawBytes) throw new Error("No video bytes in Veo 3.1 lite response");
      const base64 = rawBytes.replace(/^data:[^;]+;base64,/, "");
      return Buffer.from(base64, "base64");
    }
    if (pollData.status === "MEDIA_GENERATION_STATUS_FAILED") {
      throw new Error(`Veo 3.1 lite generation failed: ${JSON.stringify(pollData).substring(0, 200)}`);
    }
  }
  throw new Error("Veo 3.1 lite timed out after 2 minutes");
}

async function animateViaVpsProxy(
  imagePath: string,
  cookie: string,
  videoScript: string
): Promise<Buffer> {
  const WHISK_VPS = (process.env.WHISK_VPS_URL ?? "http://5.189.146.143:3050").replace(/\/$/, "");
  console.log(`[whisk-vps] animating ${path.basename(imagePath)} via ${WHISK_VPS}`);

  const imageData = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase().replace(".", "") || "png";
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";

  const formData = new FormData();
  formData.append("file", new Blob([imageData], { type: mimeType }), path.basename(imagePath));
  formData.append("script", videoScript || "Camera slowly pans left revealing the scene");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5 * 60 * 1000);

  try {
    const res = await fetch(`${WHISK_VPS}/api/animate`, {
      method: "POST",
      headers: { "x-whisk-cookie": cookie },
      body: formData as any,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Whisk VPS animate failed (${res.status}): ${errText.substring(0, 200)}`);
    }

    const data = await res.json();
    if (!data.videoUrl) throw new Error("No videoUrl in animate response");
    console.log(`[whisk-vps] videoUrl received, downloading…`);

    const videoRes = await fetch(data.videoUrl, { signal: controller.signal });
    if (!videoRes.ok) throw new Error(`Video download failed: ${videoRes.status}`);
    const buf = await videoRes.arrayBuffer();
    return Buffer.from(buf);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Animate a landscape image into a ~8s video.
 * Tries Veo 3.1 lite directly first; falls back to the VPS proxy if it fails.
 */
export async function animateWhiskImage(
  imagePath: string,
  cookie: string,
  videoScript: string
): Promise<Buffer> {
  try {
    console.log(`[whisk] Trying Veo 3.1 lite for ${path.basename(imagePath)}...`);
    const buf = await animateWithVeo31Lite(imagePath, cookie, videoScript);
    console.log(`[whisk] Veo 3.1 lite succeeded`);
    return buf;
  } catch (err: any) {
    console.warn(`[whisk] Veo 3.1 lite failed (${err.message}) — falling back to VPS proxy`);
  }
  return animateViaVpsProxy(imagePath, cookie, videoScript);
}
