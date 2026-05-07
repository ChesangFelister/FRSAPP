import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  urls: string[];
  startIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PhotoLightbox({ urls, startIndex, open, onOpenChange }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => { if (open) { setIndex(startIndex); setZoom(1); setPan({ x: 0, y: 0 }); } }, [open, startIndex]);

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const prev = useCallback(() => { setIndex(i => (i - 1 + urls.length) % urls.length); reset(); }, [urls.length]);
  const next = useCallback(() => { setIndex(i => (i + 1) % urls.length); reset(); }, [urls.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onOpenChange(false);
      else if (e.key === "+" || e.key === "=") setZoom(z => Math.min(z + 0.25, 5));
      else if (e.key === "-") setZoom(z => Math.max(z - 0.25, 1));
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next, onOpenChange]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(5, Math.max(1, z + (e.deltaY < 0 ? 0.2 : -0.2))));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setDragging({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragging.x, y: e.clientY - dragging.y });
  };
  const onMouseUp = () => setDragging(null);

  if (!urls.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 bg-background border-border overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card z-10">
          <span className="text-sm text-muted-foreground tabular-nums">
            {index + 1} / {urls.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(1, z - 0.25))} disabled={zoom <= 1} title="Zoom out (-)">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(5, z + 0.25))} disabled={zoom >= 5} title="Zoom in (+)">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={reset} disabled={zoom === 1 && pan.x === 0 && pan.y === 0} title="Reset (0)">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} title="Close (Esc)">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          className="relative flex-1 overflow-hidden bg-black/95 select-none"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
        >
          <img
            src={urls[index]}
            alt={`Photo ${index + 1}`}
            draggable={false}
            className="absolute inset-0 m-auto max-w-full max-h-full object-contain transition-transform duration-100"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            onDoubleClick={() => (zoom === 1 ? setZoom(2) : reset())}
          />

          {urls.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background flex items-center justify-center border border-border"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background flex items-center justify-center border border-border"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {urls.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-2 border-t border-border bg-card">
            {urls.map((u, i) => (
              <button
                key={u + i}
                onClick={() => { setIndex(i); reset(); }}
                className={`shrink-0 h-14 w-14 overflow-hidden border-2 rounded-sm ${i === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
              >
                <img src={u} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
