import { Router, Request, Response } from "express";
import { db } from "../db";
import { projects, scenes } from "../../shared/schema";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import archiver from "archiver";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/assets/:projectId/:type/:filename", (req: Request, res: Response) => {
  const { projectId, type, filename } = req.params;
  const safePath = path.normalize(path.join("uploads", projectId, type, filename));
  if (!safePath.startsWith(path.normalize("uploads"))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (fs.existsSync(safePath)) {
    return res.sendFile(path.resolve(safePath));
  }

  const svgPath = safePath.replace(/\.png$/, ".svg");
  if (fs.existsSync(svgPath)) {
    return res.sendFile(path.resolve(svgPath));
  }

  res.status(404).json({ error: "File not found" });
});

router.post("/assets/:projectId/:type/:filename", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const { projectId, type, filename } = req.params;
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const dir = path.join("uploads", projectId, type);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, req.file.buffer);
    res.json({ success: true, path: filePath });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/download/:projectId", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return res.status(404).json({ error: "Project not found" });

    const projectScenes = await db.select().from(scenes)
      .where(eq(scenes.project_id, projectId))
      .orderBy(scenes.scene_number);

    const safeTitle = (project.title || projectId).replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(res);

    const projectDir = path.join("uploads", projectId);

    const imagesDir = path.join(projectDir, "images");
    if (fs.existsSync(imagesDir)) {
      archive.directory(imagesDir, "images");
    }
    const svgDir = path.join(projectDir, "images");
    if (fs.existsSync(svgDir)) {
      const svgFiles = fs.readdirSync(svgDir).filter(f => f.endsWith(".svg"));
      for (const f of svgFiles) {
        archive.file(path.join(svgDir, f), { name: `images/${f}` });
      }
    }

    const audioDir = path.join(projectDir, "audio");
    if (fs.existsSync(audioDir)) {
      archive.directory(audioDir, "audio");
    }

    const styleDir = path.join(projectDir, "style");
    if (fs.existsSync(styleDir)) {
      archive.directory(styleDir, "style");
    }

    archive.append(JSON.stringify(projectScenes, null, 2), { name: "scenes.json" });
    await archive.finalize();
  } catch (e: any) {
    console.error("download error:", e.message);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
});

export default router;
