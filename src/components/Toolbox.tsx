import { Circle, Crop, EyeOff, Hash, Highlighter, Minus, MousePointer2, MoveUpRight, Pencil, Square, Type, type LucideIcon } from "lucide-react";
import type { Tool } from "../model/types";

export const TOOLS: { tool: Tool; label: string; key: string; icon: LucideIcon }[] = [
  { tool: "select", label: "Select and move", key: "V", icon: MousePointer2 },
  { tool: "rect", label: "Rectangle", key: "R", icon: Square },
  { tool: "ellipse", label: "Ellipse", key: "E", icon: Circle },
  { tool: "line", label: "Line", key: "L", icon: Minus },
  { tool: "arrow", label: "Arrow", key: "A", icon: MoveUpRight },
  { tool: "freehand", label: "Freehand", key: "F", icon: Pencil },
  { tool: "text", label: "Text", key: "T", icon: Type },
  { tool: "highlight", label: "Highlight", key: "H", icon: Highlighter },
  { tool: "obfuscate", label: "Obfuscate (pixelate / blur)", key: "O", icon: EyeOff },
  { tool: "step", label: "Step number", key: "S", icon: Hash },
  { tool: "crop", label: "Crop", key: "C", icon: Crop },
];

interface ToolboxProps {
  tool: Tool;
  onTool: (tool: Tool) => void;
}

export function Toolbox({ tool, onTool }: ToolboxProps) {
  return (
    <nav className="toolbox" aria-label="Tools">
      {TOOLS.map(({ tool: t, label, key, icon: Icon }) => (
        <button
          key={t}
          className={`tool${t === tool ? " active" : ""}`}
          title={`${label} (${key})`}
          aria-label={label}
          aria-pressed={t === tool}
          onClick={() => onTool(t)}
        >
          <Icon size={20} />
        </button>
      ))}
    </nav>
  );
}
