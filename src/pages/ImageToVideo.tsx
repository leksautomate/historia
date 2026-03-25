import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Download, Play, Film } from "lucide-react";
import { toast } from "sonner";

const ANIMATIONS = [
  { value: "random",     label: "Random" },
  { value: "zoom_in",    label: "Zoom In" },
  { value: "zoom_out",   label: "Zoom Out" },
  { value: "pan_right",  label: "Pan Right" },
  { value: "pan_left",   label: "Pan Left" },
  { value: "pan_zoom",   label: "Pan Zoom" },
];

const DURATIONS = [3, 5, 7, 10, 15, 20, 30];

export default function ImageToVideo() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [animation, setAnimation] = useState("random");
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState<"480p" | "720p">("720p");
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    setImage(file);
    setVideoUrl(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleGenerate() {
    if (!image) return;
    setLoading(true);
    setVideoUrl(null);
    try {
      const form = new FormData();
      form.append("image", image);
      form.append("animation", animation);
      form.append("duration", String(duration));
      form.append("resolution", resolution);

      const res = await fetch("/api/render/image-to-video", { method: "POST", body: form });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setVideoUrl(data.url);
      toast.success("Video ready!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Film className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-display text-foreground">Image to Video</h1>
      </div>

      <div className="space-y-4">
        {/* Upload */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Upload Image</CardTitle></CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="relative aspect-video rounded-md border-2 border-dashed border-border hover:border-primary/50 bg-secondary cursor-pointer flex items-center justify-center overflow-hidden transition-colors"
            >
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <p className="text-sm">Click or drag an image here</p>
                </div>
              )}
            </div>
            {image && (
              <p className="mt-2 text-xs text-muted-foreground">{image.name} — {(image.size / 1024).toFixed(0)} KB</p>
            )}
          </CardContent>
        </Card>

        {/* Options */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Options</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Animation</Label>
              <Select value={animation} onValueChange={setAnimation}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANIMATIONS.map(a => (
                    <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Duration (sec)</Label>
              <Select value={String(duration)} onValueChange={v => setDuration(Number(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map(d => (
                    <SelectItem key={d} value={String(d)} className="text-xs">{d}s</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Resolution</Label>
              <div className="flex gap-1 pt-1">
                {(["480p", "720p"] as const).map(r => (
                  <Button
                    key={r}
                    size="sm"
                    variant={resolution === r ? "default" : "outline"}
                    className="h-8 text-xs flex-1"
                    onClick={() => setResolution(r)}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generate */}
        <Button
          className="w-full"
          disabled={!image || loading}
          onClick={handleGenerate}
        >
          {loading
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
            : <><Play className="h-4 w-4 mr-2" />Generate Video</>
          }
        </Button>

        {/* Result */}
        {videoUrl && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Result</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                className="w-full rounded-md bg-black aspect-video"
              />
              <a href={videoUrl} download="animated.mp4" target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />Download MP4
                </Button>
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
