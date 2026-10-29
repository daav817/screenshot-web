import type { ReactNode } from "react";
import type { Shape, Style, Tool } from "../model/types";

const COLORS = ["#e53935", "#f28c28", "#fdd835", "#43a047", "#1d4e89", "#8e24aa", "#000000", "#ffffff"];
const HIGHLIGHTS = ["#ffeb3b", "#b2ff59", "#ff80ab", "#80d8ff"];

interface SwatchesProps {
  label: string;
  value: string;
  colors: string[];
  allowNone?: boolean;
  onChange: (color: string) => void;
}

function Swatches({ label, value, colors, allowNone, onChange }: SwatchesProps) {
  return (
    <div className="prop" role="group" aria-label={label}>
      <span className="prop-label">{label}</span>
      {allowNone && (
        <button className={`swatch none${value === "" ? " active" : ""}`} title="None" aria-label="None" onClick={() => onChange("")} />
      )}
      {colors.map((c) => (
        <button
          key={c}
          className={`swatch${value.toLowerCase() === c ? " active" : ""}`}
          style={{ background: c }}
          title={c}
          aria-label={c}
          onClick={() => onChange(c)}
        />
      ))}
      <input className="swatch-custom" type="color" value={value || "#ffffff"} title="Custom color" aria-label={`Custom ${label.toLowerCase()}`} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const Divider = () => <span className="divider" />;

interface PropertiesBarProps {
  tool: Tool;
  style: Style;
  selected: Shape | undefined;
  onStyle: (style: Partial<Style>) => void;
  extra?: ReactNode;
}

/** Style controls for the active tool, or for the selected shape when using the select tool. */
export function PropertiesBar({ tool, style, selected, onStyle, extra }: PropertiesBarProps) {
  const kind = tool === "select" ? selected?.kind : tool;

  // Show the selected shape's own values so the controls reflect what's on the canvas
  const shown: Style = { ...style };
  if (tool === "select" && selected) {
    if ("stroke" in selected) shown.stroke = selected.stroke;
    if ("strokeWidth" in selected) shown.strokeWidth = selected.strokeWidth;
    if (selected.kind === "rect" || selected.kind === "ellipse") shown.fill = selected.fill;
    if (selected.kind === "text" || selected.kind === "step") shown.stroke = selected.fill;
    if (selected.kind === "text") shown.fontSize = selected.fontSize;
    if (selected.kind === "highlight") shown.highlight = selected.fill;
    if (selected.kind === "obfuscate") shown.obfuscateMode = selected.mode;
    shown.shadow = selected.shadow;
  }

  const hasStroke = kind && ["rect", "ellipse", "line", "arrow", "freehand", "text", "step"].includes(kind);
  const hasWidth = kind && ["rect", "ellipse", "line", "arrow", "freehand"].includes(kind);
  const hasFill = kind === "rect" || kind === "ellipse";
  const hasShadow = kind && !["highlight", "obfuscate", "crop", "select"].includes(kind);

  return (
    <div className="properties">
      {hasStroke && <Swatches label={kind === "text" || kind === "step" ? "Color" : "Line"} value={shown.stroke} colors={COLORS} onChange={(stroke) => onStyle({ stroke })} />}
      {hasFill && (
        <>
          <Divider />
          <Swatches label="Fill" value={shown.fill} colors={COLORS} allowNone onChange={(fill) => onStyle({ fill })} />
        </>
      )}
      {hasWidth && (
        <>
          <Divider />
          <label className="prop">
            <span className="prop-label">Width</span>
            <input type="range" min={1} max={20} value={shown.strokeWidth} onChange={(e) => onStyle({ strokeWidth: Number(e.target.value) })} />
            <span className="prop-value">{shown.strokeWidth}</span>
          </label>
        </>
      )}
      {(kind === "text" || kind === "step") && (
        <>
          <Divider />
          <label className="prop">
            <span className="prop-label">Size</span>
            <input type="range" min={10} max={96} value={shown.fontSize} onChange={(e) => onStyle({ fontSize: Number(e.target.value) })} />
            <span className="prop-value">{shown.fontSize}</span>
          </label>
        </>
      )}
      {kind === "highlight" && <Swatches label="Highlight" value={shown.highlight} colors={HIGHLIGHTS} onChange={(highlight) => onStyle({ highlight })} />}
      {kind === "obfuscate" && (
        <div className="prop segmented" role="group" aria-label="Obfuscate mode">
          <span className="prop-label">Mode</span>
          {(["pixelate", "blur"] as const).map((m) => (
            <button key={m} className={shown.obfuscateMode === m ? "active" : ""} onClick={() => onStyle({ obfuscateMode: m })}>
              {m === "pixelate" ? "Pixelate" : "Blur"}
            </button>
          ))}
        </div>
      )}
      {hasShadow && (
        <>
          <Divider />
          <label className="prop check">
            <input type="checkbox" checked={shown.shadow} onChange={(e) => onStyle({ shadow: e.target.checked })} />
            Shadow
          </label>
        </>
      )}
      {!kind && <span className="prop-hint">Click a shape to change it, drag to move it, or pick a tool on the left.</span>}
      {kind === "crop" && <span className="prop-hint">Drag over the area to keep.</span>}
      <span className="spacer" />
      {extra}
    </div>
  );
}
