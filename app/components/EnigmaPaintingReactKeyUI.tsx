// app/components/EnigmaPaintingReactKeyUI.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RefreshCcw, Download, Beaker, Image as ImageIcon } from "lucide-react";
import { Delaunay } from "d3-delaunay";

const W = 800, H = 800;

/** Deterministic RNG */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Marching Squares for binary image → closed contours */
function marchingSquares(data: Uint8ClampedArray, width: number, height: number, threshold: number): number[][][] {
  const val = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    return brightness < threshold ? 1 : 0;
  };
  const edges: number[][][] = [];
  const visited = new Set<string>();

  const key = (x: number, y: number) => `${x},${y}`;

  // Trace a single contour starting from cell (sx, sy)
  const trace = (sx: number, sy: number) => {
    const pts: number[][] = [];
    let x = sx, y = sy, dir = 0; // 0:right,1:down,2:left,3:up
    const startKey = key(x, y);
    let first = true;

    while (first || (x !== sx || y !== sy || dir !== 0)) {
      first = false;

      const tl = val(x, y);
      const tr = val(x + 1, y);
      const bl = val(x, y + 1);
      const br = val(x + 1, y + 1);
      const idx = (tl << 3) | (tr << 2) | (bl << 1) | br;

      // Minimal cases to maintain closed paths. Ambiguities resolved by favoring clockwise.
      switch (idx) {
        case 0:
        case 15:
          // move forward
          if (dir === 0) x++;
          else if (dir === 1) y++;
          else if (dir === 2) x--;
          else y--;
          break;
        case 1: case 5: case 13:
          if (dir === 0) { pts.push([x + 1, y + 1]); dir = 3; }
          else if (dir === 1) { pts.push([x + 1, y + 1]); dir = 0; x++; }
          else if (dir === 2) { pts.push([x + 1, y + 1]); dir = 1; y++; }
          else { pts.push([x + 1, y + 1]); dir = 2; x--; }
          break;
        case 8: case 10: case 11:
          if (dir === 0) { pts.push([x + 1, y]); dir = 1; y++; }
          else if (dir === 1) { pts.push([x + 1, y]); dir = 2; x--; }
          else if (dir === 2) { pts.push([x + 1, y]); dir = 3; y--; }
          else { pts.push([x + 1, y]); dir = 0; x++; }
          break;
        case 4: case 12: case 14:
          if (dir === 0) { pts.push([x, y]); dir = 1; y++; }
          else if (dir === 1) { pts.push([x, y]); dir = 2; x--; }
          else if (dir === 2) { pts.push([x, y]); dir = 3; y--; }
          else { pts.push([x, y]); dir = 0; x++; }
          break;
        case 2: case 3: case 7:
          if (dir === 0) { pts.push([x + 1, y]); dir = 3; }
          else if (dir === 1) { pts.push([x + 1, y]); dir = 0; x++; }
          else if (dir === 2) { pts.push([x + 1, y]); dir = 1; y++; }
          else { pts.push([x + 1, y]); dir = 2; x--; }
          break;
        case 6: case 9:
          // Saddle; follow clockwise
          if (dir === 0) { pts.push([x + 1, y]); dir = 1; y++; }
          else if (dir === 1) { pts.push([x + 1, y + 1]); dir = 0; x++; }
          else if (dir === 2) { pts.push([x, y + 1]); dir = 3; y--; }
          else { pts.push([x, y]); dir = 2; x--; }
          break;
        default:
          // Fallback forward step
          if (dir === 0) x++;
          else if (dir === 1) y++;
          else if (dir === 2) x--;
          else y--;
      }

      visited.add(key(x, y));
      if (pts.length > 200000) break; // safeguard
    }

    if (pts.length >= 3) edges.push(pts);
  };

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const tl = (data[(y * width + x) * 4] * 0.299) + (data[(y * width + x) * 4 + 1] * 0.587) + (data[(y * width + x) * 4 + 2] * 0.114);
      const br = (data[((y + 1) * width + (x + 1)) * 4] * 0.299) + (data[((y + 1) * width + (x + 1)) * 4 + 1] * 0.587) + (data[((y + 1) * width + (x + 1)) * 4 + 2] * 0.114);
      const onEdge = (tl < threshold) !== (br < threshold);
      if (onEdge && !visited.has(key(x, y))) trace(x, y);
    }
  }
  return edges;
}

/** Convert polyline to SVG path string */
function polyToPath(poly: number[][]): string {
  if (!poly.length) return "";
  const m = `M ${poly[0][0]} ${poly[0][1]}`;
  const rest = poly.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ");
  return `${m} ${rest} Z`;
}

/** Rasterize image to key silhouette paths */
async function extractKeyPaths(imageUrl: string, threshold: number): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve([]);
      ctx.drawImage(img, 0, 0, W, H);
      const imageData = ctx.getImageData(0, 0, W, H);
      const contours = marchingSquares(imageData.data, W, H, threshold);
      const paths = contours.map(polyToPath).filter(Boolean);
      resolve(paths);
    };
    img.src = imageUrl;
  });
}

type ShapeOut = {
  id: number;
  path: string;
  center: [number, number];
  number: number;
  key_region: boolean;
  regionId: number;
};

export default function EnigmaPaintingReactKeyUI() {
  const [seed, setSeed] = useState<number>(7);
  const [complexity, setComplexity] = useState<number>(150);
  const [threshold, setThreshold] = useState<number>(130);
  const [colorMode, setColorMode] = useState<boolean>(true);
  const [showKeyOutline, setShowKeyOutline] = useState<boolean>(true);
  const [showNumbers, setShowNumbers] = useState<boolean>(true);
  const [imageUrl, setImageUrl] = useState<string>("/mnt/data/Key.png"); // default
  const [keyPaths, setKeyPaths] = useState<string[]>([]);
  const testCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Build a canvas/context used solely for isPointInPath tests
  useEffect(() => {
    if (!testCanvasRef.current) {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      testCanvasRef.current = c as HTMLCanvasElement;
    }
  }, []);

  // Load & extract key silhouette whenever image/threshold changes
  useEffect(() => {
    let cancelled = false;
    extractKeyPaths(imageUrl, threshold).then((paths) => {
      if (!cancelled) setKeyPaths(paths);
    });
    return () => { cancelled = true; };
  }, [imageUrl, threshold]);

  const { shapes, svgData, jsonData } = useMemo(() => {
    if (!keyPaths.length) return { shapes: [] as ShapeOut[], svgData: "", jsonData: "" };

    const rand = mulberry32(seed);
    const n = Math.max(1, complexity);
    const points: [number, number][] = [];
    for (let i = 0; i < n; i++) points.push([rand() * W, rand() * H]);

    const delaunay = Delaunay.from(points);
    const vor = delaunay.voronoi([0, 0, W, H]);

    // Prepare key Path2D union
    const ctx = testCanvasRef.current?.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const keyP2DList = keyPaths.map((d) => new Path2D(d));

    const shapes: ShapeOut[] = [];
    for (let i = 0; i < points.length; i++) {
      const cell = vor.cellPolygon(i);
      if (!cell || cell.length < 3) continue;
      const path = `M ${cell.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ")} Z`;
      const cx = cell.reduce((a, p) => a + p[0], 0) / cell.length;
      const cy = cell.reduce((a, p) => a + p[1], 0) / cell.length;

      let inside = false;
      for (const p2d of keyP2DList) {
        if (ctx.isPointInPath(p2d, cx, cy)) { inside = true; break; }
      }
      shapes.push({
        id: i,
        path,
        center: [cx, cy],
        number: i + 1,
        key_region: inside,
        regionId: inside ? 1 : 0,
      });
    }

    // SVG export
    const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    const clipDefs = `<defs><clipPath id="keyClip">${keyPaths.map((d, idx) => `<path d="${d}" />`).join("")}</clipPath></defs>`;
    const brass = (i: number) => `hsl(${45 + (i % 5)},80%,${45 + (i % 4) * 2}%)`;
    const svgCells = shapes.map((s) => {
      const fill = colorMode ? brass(s.id) : "none";
      const stroke = colorMode ? "#9a7b00" : "#000";
      return `<path d="${s.path}" fill="${fill}" stroke="${stroke}" stroke-width="${colorMode ? 0.5 : 1}" clip-path="url(#keyClip)"/>`;
    }).join("\n");
    const svgOutline = showKeyOutline ? keyPaths.map(d => `<path d="${d}" fill="none" stroke="darkgoldenrod" stroke-width="1.2"/>`).join("\n") : "";
    const svgNumbers = showNumbers ? shapes.map((s) => `<text x="${s.center[0].toFixed(1)}" y="${s.center[1].toFixed(1)}" font-size="6" text-anchor="middle" dominant-baseline="middle" fill="#111">${s.number}</text>`).join("\n") : "";
    const svgData = `${svgHeader}\n${clipDefs}\n${svgCells}\n${svgOutline}\n${svgNumbers}\n</svg>`;

    // JSON export
    const json = {
      painting_id: `key_${seed}`,
      dimensions: [W, H],
      shapes: shapes.map(s => ({
        id: s.id,
        path: s.path,
        center: s.center,
        number: s.number,
        key_region: s.key_region,
        regionId: s.regionId,
      })),
      silhouette_paths: keyPaths,
      params: { seed, complexity, threshold }
    };
    const jsonData = JSON.stringify(json, null, 2);

    return { shapes, svgData, jsonData };
  }, [seed, complexity, colorMode, showKeyOutline, showNumbers, keyPaths, threshold]);

  const randomizeSeed = () => setSeed(Math.floor(Math.random() * 9999) + 1);

  const download = (filename: string, data: string, mime: string) => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Hidden test canvas (for Path2D hit-testing) */}
      <canvas ref={testCanvasRef} width={W} height={H} style={{ display: "none" }} />

      <Card className="lg:col-span-4">
        <CardHeader><CardTitle>Controls</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 items-center">
            <Label>Seed</Label>
            <div className="flex gap-2">
              <Input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value || '0', 10))} />
              <Button variant="secondary" onClick={randomizeSeed}><RefreshCcw className="w-4 h-4" /></Button>
            </div>

            <Label>Complexity</Label>
            <Input type="number" value={complexity} onChange={(e) => setComplexity(Math.max(1, parseInt(e.target.value || '1', 10)))} />

            <Label>Threshold</Label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value, 10))} className="w-full" />
              <Input className="w-20" type="number" min={0} max={255} value={threshold} onChange={(e) => setThreshold(Math.min(255, Math.max(0, parseInt(e.target.value || '0', 10))))} />
            </div>

            <Label>Color Mode</Label>
            <div className="flex justify-end"><Switch checked={colorMode} onCheckedChange={setColorMode} /></div>

            <Label>Show Key Outline</Label>
            <div className="flex justify-end"><Switch checked={showKeyOutline} onCheckedChange={setShowKeyOutline} /></div>

            <Label>Show Numbers</Label>
            <div className="flex justify-end"><Switch checked={showNumbers} onCheckedChange={setShowNumbers} /></div>

            <Label>Mask Image</Label>
            <div className="flex items-center gap-2">
              <Input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
              <Button type="button" variant="secondary" onClick={() => setImageUrl("/mnt/data/Key.png")} title="Reset to default">
                <ImageIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setSeed((s) => s)}><Beaker className="w-4 h-4 mr-1" />Preview</Button>
            <Button variant="outline" onClick={() => { download('enigma_painting_key_mask.svg', svgData, 'image/svg+xml'); download('enigma_painting_key_mask.json', jsonData, 'application/json'); }}>
              <Download className="w-4 h-4 mr-2" />Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-8">
        <CardHeader><CardTitle>Key Silhouette – From Mask</CardTitle></CardHeader>
        <CardContent>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto border rounded">
            <rect x={0} y={0} width={W} height={H} fill="#fff" />
            <defs>
              <clipPath id="keyClip">{keyPaths.map((d, i) => <path key={i} d={d} />)}</clipPath>
            </defs>
            {/** Cells clipped to key shape */}
            {shapes.map((s) => (
              <path
                key={s.id}
                d={s.path}
                fill={colorMode ? `hsl(${45 + (s.id % 5)},80%,${45 + (s.id % 4) * 2}%)` : 'none'}
                stroke={colorMode ? '#9a7b00' : '#000'}
                strokeWidth={colorMode ? 0.5 : 1}
                clipPath="url(#keyClip)"
              />
            ))}
            {/** Outline */}
            {showKeyOutline && keyPaths.map((d, i) => (
              <path key={`outline-${i}`} d={d} fill="none" stroke="darkgoldenrod" strokeWidth={1.2} />
            ))}
            {/** Numbers */}
            {showNumbers && shapes.map((s) => (
              <text key={`num-${s.id}`} x={s.center[0]} y={s.center[1]} fontSize={6} textAnchor="middle" dominantBaseline="middle" fill="#111">
                {s.number}
              </text>
            ))}
          </svg>
        </CardContent>
      </Card>
    </div>
  );
}
