import type Konva from "konva";
import { Check, Copy, Download, Maximize, Plus, Printer, Redo2, Trash2, Undo2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { blobToCanvas, captureScreen, imageFromDataTransfer, readClipboardImage } from "./capture";
import { PropertiesBar } from "./components/PropertiesBar";
import { TOOLS, Toolbox } from "./components/Toolbox";
import { Welcome } from "./components/Welcome";
import { Editor } from "./editor/Editor";
import { canCopyImage, copyToClipboard, download, print } from "./export";
import { cropDoc } from "./model/crop";
import { initHistory, push, redo, undo, type History } from "./model/history";
import { restyleShape } from "./model/shapes";
import type { Doc, Rect, Style, Tool } from "./model/types";

const DEFAULT_STYLE: Style = {
  stroke: "#e53935",
  fill: "",
  strokeWidth: 4,
  fontSize: 24,
  shadow: true,
  highlight: "#ffeb3b",
  obfuscateMode: "pixelate",
};

const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export default function App() {
  const [hist, setHist] = useState<History<Doc> | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit");
  const [fitZoom, setFitZoom] = useState(1);
  const [delay, setDelay] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const doc = hist?.present ?? null;
  const zoom = zoomMode === "fit" ? fitZoom : zoomMode;
  const selected = doc?.shapes.find((s) => s.id === selectedId);

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), error ? 6000 : 2500);
  }, []);

  const open = useCallback(
    (image: HTMLCanvasElement, startCrop = false) => {
      if (hist && hist.past.length > 0 && !window.confirm("Replace the current screenshot? Unsaved changes will be lost.")) return;
      setHist(initHistory({ image, shapes: [] }));
      setSelectedId(null);
      setCropRect(null);
      setZoomMode("fit");
      setTool(startCrop ? "crop" : "select");
    },
    [hist],
  );

  const openBlob = useCallback(
    async (blob: Blob) => {
      try {
        open(await blobToCanvas(blob));
      } catch {
        notify("That file isn't an image this browser can open.", true);
      }
    },
    [open, notify],
  );

  const capture = async () => {
    try {
      const canvas = await captureScreen(delay, setCountdown);
      open(canvas, true);
    } catch (e) {
      setCountdown(0);
      if ((e as DOMException)?.name !== "NotAllowedError") notify(`Capture failed: ${(e as Error).message}`, true);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const canvas = await readClipboardImage();
      if (canvas) open(canvas);
      else notify("There's no image on the clipboard. Copy or snip one first, then press Ctrl+V.", true);
    } catch {
      notify("The browser blocked clipboard access. Press Ctrl+V instead.", true);
    }
  };

  const commit = useCallback((next: Doc) => setHist((h) => (h ? push(h, next) : h)), []);

  const changeStyle = (change: Partial<Style>) => {
    setStyle((s) => ({ ...s, ...change }));
    if (doc && selected && tool === "select") {
      commit({ ...doc, shapes: doc.shapes.map((s) => (s.id === selected.id ? restyleShape(s, change) : s)) });
    }
  };

  const chooseTool = (t: Tool) => {
    setTool(t);
    setCropRect(null);
    if (t !== "select") setSelectedId(null);
  };

  const deleteSelected = () => {
    if (!doc || !selectedId) return;
    commit({ ...doc, shapes: doc.shapes.filter((s) => s.id !== selectedId) });
    setSelectedId(null);
  };

  const applyCrop = () => {
    if (doc && cropRect && cropRect.width >= 3 && cropRect.height >= 3) {
      commit(cropDoc(doc, cropRect));
      setZoomMode("fit");
    }
    setCropRect(null);
    setTool("select");
  };

  const cancelCrop = () => {
    setCropRect(null);
    setTool("select");
  };

  /** The finished screenshot at full resolution, without selection handles. */
  const render = (): HTMLCanvasElement | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const ui = stage.findOne(".ui");
    ui?.hide();
    const canvas = stage.toCanvas({ pixelRatio: 1 / zoom });
    ui?.show();
    return canvas;
  };

  const save = async (format: "png" | "jpg") => {
    const canvas = render();
    if (canvas) await download(canvas, format);
  };

  const copy = async () => {
    const canvas = render();
    if (!canvas) return;
    try {
      await copyToClipboard(canvas);
      notify("Copied to clipboard");
    } catch {
      notify("The browser blocked copying the image. Use Save instead.", true);
    }
  };

  const doPrint = () => {
    const canvas = render();
    if (canvas) print(canvas);
  };

  const zoomBy = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > zoom + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < zoom - 0.001);
    if (next) setZoomMode(next);
  };

  // Fit the screenshot into the window
  useLayoutEffect(() => {
    const area = canvasAreaRef.current;
    if (!area || !doc) return;
    const fit = () => {
      const pad = 48;
      setFitZoom(Math.min(1, (area.clientWidth - pad) / doc.image.width, (area.clientHeight - pad) / doc.image.height));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    return () => observer.disconnect();
  }, [doc?.image]);

  // Paste an image anywhere
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const file = imageFromDataTransfer(e.clipboardData);
      if (file) {
        e.preventDefault();
        openBlob(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [openBlob]);

  // Keyboard shortcuts
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (isTyping(e.target) || !doc) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod) {
      if (key === "z" && !e.shiftKey) setHist((h) => h && undo(h));
      else if (key === "y" || (key === "z" && e.shiftKey)) setHist((h) => h && redo(h));
      else if (key === "s") save("png");
      else if (key === "c" && !window.getSelection()?.toString()) copy();
      else if (key === "p") doPrint();
      else return;
      e.preventDefault();
      return;
    }
    if (e.altKey) return;
    if (key === "delete" || key === "backspace") deleteSelected();
    else if (key === "escape") tool === "crop" ? cancelCrop() : (setSelectedId(null), setTool("select"));
    else if (key === "enter" && tool === "crop") applyCrop();
    else if (key === "+" || key === "=") zoomBy(1);
    else if (key === "-") zoomBy(-1);
    else if (key === "0") setZoomMode("fit");
    else {
      const match = TOOLS.find((t) => t.key.toLowerCase() === key);
      if (!match) return;
      chooseTool(match.tool);
    }
    e.preventDefault();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = imageFromDataTransfer(e.dataTransfer);
      if (file) openBlob(file);
    },
  };

  return (
    <div className={`app${dragOver ? " drag-over" : ""}`} {...dropProps}>
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="" width={28} height={28} />
          <span>Screenshot</span>
        </div>
        {doc && (
          <>
            <button className="btn" onClick={() => (hist!.past.length === 0 || window.confirm("Start over? Unsaved changes will be lost.")) && setHist(null)} title="New screenshot">
              <Plus size={18} /> New
            </button>
            <span className="spacer" />
            <button className="btn" onClick={copy} disabled={!canCopyImage()} title="Copy to clipboard (Ctrl+C)">
              <Copy size={18} /> Copy
            </button>
            <button className="btn primary" onClick={() => save("png")} title="Save as PNG (Ctrl+S)">
              <Download size={18} /> PNG
            </button>
            <button className="btn" onClick={() => save("jpg")} title="Save as JPG">
              <Download size={18} /> JPG
            </button>
            <button className="btn icon" onClick={doPrint} title="Print (Ctrl+P)" aria-label="Print">
              <Printer size={18} />
            </button>
          </>
        )}
      </header>

      {!doc ? (
        <main className="welcome-area">
          <Welcome delay={delay} onDelay={setDelay} onCapture={capture} onPaste={pasteFromClipboard} onFile={openBlob} />
        </main>
      ) : (
        <div className="workspace">
          <Toolbox tool={tool} onTool={chooseTool} />
          <div className="editor-column">
            <PropertiesBar
              tool={tool}
              style={style}
              selected={selected}
              onStyle={changeStyle}
              extra={
                <>
                  {tool === "crop" && (
                    <>
                      <button className="btn primary" onClick={applyCrop} disabled={!cropRect}>
                        <Check size={16} /> Crop
                      </button>
                      <button className="btn" onClick={cancelCrop}>
                        <X size={16} /> Cancel
                      </button>
                      <span className="divider" />
                    </>
                  )}
                  <button className="btn icon" onClick={() => setHist((h) => h && undo(h))} disabled={!hist?.past.length} title="Undo (Ctrl+Z)" aria-label="Undo">
                    <Undo2 size={18} />
                  </button>
                  <button className="btn icon" onClick={() => setHist((h) => h && redo(h))} disabled={!hist?.future.length} title="Redo (Ctrl+Y)" aria-label="Redo">
                    <Redo2 size={18} />
                  </button>
                  <button className="btn icon" onClick={deleteSelected} disabled={!selectedId} title="Delete (Del)" aria-label="Delete">
                    <Trash2 size={18} />
                  </button>
                  <span className="divider" />
                  <button className="btn icon" onClick={() => zoomBy(-1)} title="Zoom out (-)" aria-label="Zoom out">
                    <ZoomOut size={18} />
                  </button>
                  <button className="zoom-label" onClick={() => setZoomMode(zoomMode === "fit" ? 1 : "fit")} title="Toggle fit / 100% (0)">
                    {Math.round(zoom * 100)}%
                  </button>
                  <button className="btn icon" onClick={() => zoomBy(1)} title="Zoom in (+)" aria-label="Zoom in">
                    <ZoomIn size={18} />
                  </button>
                  <button className="btn icon" onClick={() => setZoomMode("fit")} title="Fit to window (0)" aria-label="Fit to window">
                    <Maximize size={18} />
                  </button>
                </>
              }
            />
            <main className={`canvas-area tool-${tool}`} ref={canvasAreaRef}>
              <Editor
                doc={doc}
                tool={tool}
                style={style}
                zoom={zoom}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onCommit={commit}
                cropRect={cropRect}
                onCropRect={setCropRect}
                stageRef={stageRef}
              />
            </main>
            <footer className="statusbar">
              {doc.image.width} × {doc.image.height} px
              {tool === "crop" && <span> · Drag to select the area to keep · Enter to crop · Esc to cancel</span>}
              {tool !== "crop" && tool !== "select" && <span> · Hold Shift for straight lines and squares</span>}
            </footer>
          </div>
        </div>
      )}

      {countdown > 0 && (
        <div className="countdown" aria-live="assertive">
          {countdown}
        </div>
      )}
      {toast && (
        <div className={`toast${toast.error ? " error" : ""}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
