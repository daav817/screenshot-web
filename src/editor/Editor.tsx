import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Arrow, Circle, Ellipse, Group, Image as KImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { obfuscate } from "../model/obfuscate";
import { dragShape, isTooSmall, newId, nextStepNumber, normalizeRect, startShape, translateShape } from "../model/shapes";
import type { Doc, ObfuscateShape, Rect as Box, Shape, Style, TextShape, Tool } from "../model/types";

export interface EditorProps {
  doc: Doc;
  tool: Tool;
  style: Style;
  zoom: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (doc: Doc) => void;
  cropRect: Box | null;
  onCropRect: (rect: Box | null) => void;
  stageRef: RefObject<Konva.Stage>;
}

export const FONT = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const SHADOW = { shadowColor: "black", shadowBlur: 6, shadowOffsetX: 3, shadowOffsetY: 3, shadowOpacity: 0.45 };
const shadowOf = (s: Shape) => (s.shadow ? SHADOW : {});

/** Black or white, whichever reads better on `hex`. */
function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#000" : "#fff";
}

/** Konva props for each kind of shape when it's selected. */
function transformerProps(shape: Shape | undefined) {
  const corners = ["top-left", "top-right", "bottom-left", "bottom-right"];
  switch (shape?.kind) {
    case "line":
    case "arrow":
    case "freehand":
      return { resizeEnabled: false };
    case "text":
    case "step":
      return { resizeEnabled: true, enabledAnchors: corners, keepRatio: true };
    default:
      return { resizeEnabled: true, enabledAnchors: undefined, keepRatio: false };
  }
}

interface ObfuscateNodeProps {
  shape: ObfuscateShape;
  image: HTMLCanvasElement;
  groupProps: Record<string, unknown>;
}

/** Pixelated or blurred copy of the part of the screenshot under the shape, kept in step while it's dragged. */
function ObfuscateNode({ shape, image, groupProps }: ObfuscateNodeProps) {
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const { width, height, mode } = shape;
  const x = dragPos?.x ?? shape.x;
  const y = dragPos?.y ?? shape.y;
  const content = useMemo(
    () => (width >= 1 && height >= 1 ? obfuscate(image, { x, y, width, height }, mode) : null),
    [image, x, y, width, height, mode],
  );

  // The drag position is only needed until the move is committed
  useEffect(() => setDragPos(null), [shape.x, shape.y]);

  return (
    <Group {...groupProps} x={shape.x} y={shape.y} onDragMove={(e: KonvaEventObject<DragEvent>) => setDragPos({ x: e.target.x(), y: e.target.y() })}>
      {content && <KImage image={content} width={width} height={height} />}
    </Group>
  );
}

export function Editor({ doc, tool, style, zoom, selectedId, onSelect, onCommit, cropRect, onCropRect, stageRef }: EditorProps) {
  const [draft, setDraftState] = useState<Shape | null>(null);
  const draftRef = useRef<Shape | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<TextShape | null>(null);
  const editDone = useRef(false);
  const transformerRef = useRef<Konva.Transformer>(null);
  const { width, height } = doc.image;
  const selectedShape = doc.shapes.find((s) => s.id === selectedId);

  const setDraft = (shape: Shape | null) => {
    draftRef.current = shape;
    setDraftState(shape);
  };

  const replace = (shape: Shape) => onCommit({ ...doc, shapes: doc.shapes.map((s) => (s.id === shape.id ? shape : s)) });

  // Keep the selection handles on the selected shape
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const node = tool === "select" && selectedId && editing?.id !== selectedId ? stage.findOne(`#${selectedId}`) : undefined;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  });

  const pointer = () => stageRef.current!.getRelativePointerPosition()!;

  const onPointerDown = (e: KonvaEventObject<PointerEvent>) => {
    if (e.evt.button !== 0 || editing) return;
    const p = pointer();
    const onEmpty = e.target === e.target.getStage() || e.target.name() === "background";
    switch (tool) {
      case "select":
        if (onEmpty) onSelect(null);
        return;
      case "text":
        // The text box opens on release: opening it now would lose the focus to the mousedown that follows
        start.current = p;
        return;
      case "step":
        onCommit({
          ...doc,
          shapes: [
            ...doc.shapes,
            { id: newId(), kind: "step", x: p.x, y: p.y, number: nextStepNumber(doc.shapes), fill: style.stroke, radius: Math.round(style.fontSize * 0.75), shadow: style.shadow },
          ],
        });
        return;
      case "crop":
        start.current = p;
        onCropRect({ x: p.x, y: p.y, width: 0, height: 0 });
        return;
      default:
        start.current = p;
        setDraft(startShape(tool, p.x, p.y, style));
    }
  };

  const onPointerMove = (e: KonvaEventObject<PointerEvent>) => {
    const s = start.current;
    if (!s) return;
    const p = pointer();
    if (tool === "crop") {
      onCropRect(normalizeRect(s.x, s.y, p.x, p.y));
    } else if (draftRef.current) {
      setDraft(dragShape(draftRef.current, s.x, s.y, p.x, p.y, e.evt.shiftKey));
    }
  };

  // Finish drawing even when the pointer is released outside the canvas
  const finishRef = useRef<() => void>(() => {});
  finishRef.current = () => {
    const s = start.current;
    if (!s) return;
    start.current = null;
    if (tool === "text") {
      editDone.current = false;
      setEditing({ id: newId(), kind: "text", x: s.x, y: s.y, text: "", fontSize: style.fontSize, fill: style.stroke, shadow: style.shadow });
      return;
    }
    if (tool === "crop") {
      if (cropRect && (cropRect.width < 3 || cropRect.height < 3)) onCropRect(null);
      return;
    }
    const shape = draftRef.current;
    setDraft(null);
    if (shape && !isTooSmall(shape)) onCommit({ ...doc, shapes: [...doc.shapes, shape] });
  };
  useEffect(() => {
    const up = () => finishRef.current();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const finishText = (value: string) => {
    if (!editing || editDone.current) return;
    editDone.current = true;
    const exists = doc.shapes.some((s) => s.id === editing.id);
    setEditing(null);
    if (!value.trim()) {
      if (exists) onCommit({ ...doc, shapes: doc.shapes.filter((s) => s.id !== editing.id) });
      return;
    }
    const shape = { ...editing, text: value };
    onCommit({ ...doc, shapes: exists ? doc.shapes.map((s) => (s.id === shape.id ? shape : s)) : [...doc.shapes, shape] });
  };

  // Konva doesn't refresh its hit canvas when shapes change listening or are re-created, so clicks would miss them
  const shapesLayerRef = useRef<Konva.Layer>(null);
  useEffect(() => {
    shapesLayerRef.current?.drawHit();
  }, [doc, tool, zoom]);

  // Shapes always listen (toggling it leaves the hit canvas stale), the tool decides what a click does
  const groupProps = (s: Shape, interactive: boolean) => ({
    id: interactive ? s.id : undefined,
    listening: interactive,
    draggable: interactive && tool === "select",
    onPointerDown: () => tool === "select" && onSelect(s.id),
    onDragStart: () => onSelect(s.id),
    onDragEnd: (e: KonvaEventObject<DragEvent>) => {
      const node = e.target;
      if ("points" in s) {
        const moved = translateShape(s, node.x(), node.y());
        node.position({ x: 0, y: 0 });
        replace(moved);
      } else {
        replace({ ...s, x: node.x(), y: node.y() });
      }
    },
    onTransformEnd: (e: KonvaEventObject<Event>) => {
      const node = e.target;
      const sx = node.scaleX();
      const sy = node.scaleY();
      node.scale({ x: 1, y: 1 });
      switch (s.kind) {
        case "rect":
        case "ellipse":
        case "highlight":
        case "obfuscate":
          replace({ ...s, x: node.x(), y: node.y(), width: Math.max(2, s.width * sx), height: Math.max(2, s.height * sy) });
          break;
        case "text":
          replace({ ...s, x: node.x(), y: node.y(), fontSize: Math.max(6, Math.round(s.fontSize * sy)) });
          break;
        case "step":
          replace({ ...s, x: node.x(), y: node.y(), radius: Math.max(6, s.radius * sx) });
          break;
      }
    },
  });

  const renderShape = (s: Shape, interactive = true) => {
    const g = groupProps(s, interactive);
    const k = interactive ? s.id : `draft-${s.id}`;
    switch (s.kind) {
      case "rect":
        return (
          <Group key={k} {...g} x={s.x} y={s.y}>
            <Rect width={s.width} height={s.height} stroke={s.stroke} strokeWidth={s.strokeWidth} fill={s.fill || undefined} hitStrokeWidth={Math.max(12, s.strokeWidth)} {...shadowOf(s)} />
          </Group>
        );
      case "ellipse":
        return (
          <Group key={k} {...g} x={s.x} y={s.y}>
            <Ellipse
              x={s.width / 2}
              y={s.height / 2}
              radiusX={s.width / 2}
              radiusY={s.height / 2}
              stroke={s.stroke}
              strokeWidth={s.strokeWidth}
              fill={s.fill || undefined}
              hitStrokeWidth={Math.max(12, s.strokeWidth)}
              {...shadowOf(s)}
            />
          </Group>
        );
      case "highlight":
        return (
          <Group key={k} {...g} x={s.x} y={s.y}>
            <Rect width={s.width} height={s.height} fill={s.fill} globalCompositeOperation="multiply" />
          </Group>
        );
      case "obfuscate":
        return <ObfuscateNode key={k} shape={s} image={doc.image} groupProps={g} />;
      case "line":
      case "freehand":
        return (
          <Group key={k} {...g}>
            <Line
              points={s.points}
              stroke={s.stroke}
              strokeWidth={s.strokeWidth}
              lineCap="round"
              lineJoin="round"
              tension={s.kind === "freehand" ? 0.4 : 0}
              hitStrokeWidth={Math.max(12, s.strokeWidth)}
              {...shadowOf(s)}
            />
          </Group>
        );
      case "arrow":
        return (
          <Group key={k} {...g}>
            <Arrow
              points={s.points}
              stroke={s.stroke}
              fill={s.stroke}
              strokeWidth={s.strokeWidth}
              pointerLength={s.strokeWidth * 3 + 8}
              pointerWidth={s.strokeWidth * 3 + 8}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={Math.max(12, s.strokeWidth)}
              {...shadowOf(s)}
            />
          </Group>
        );
      case "text":
        return (
          <Group
            key={k}
            {...g}
            x={s.x}
            y={s.y}
            visible={editing?.id !== s.id}
            onDblClick={() => {
              editDone.current = false;
              setEditing(s);
            }}
          >
            <Text text={s.text} fontSize={s.fontSize} fontFamily={FONT} lineHeight={1.2} padding={4} fill={s.fill} {...shadowOf(s)} />
          </Group>
        );
      case "step":
        return (
          <Group key={k} {...g} x={s.x} y={s.y}>
            <Circle radius={s.radius} fill={s.fill} {...shadowOf(s)} />
            <Text
              text={String(s.number)}
              fontSize={s.radius * 1.1}
              fontFamily={FONT}
              fontStyle="bold"
              fill={contrastText(s.fill)}
              width={s.radius * 2}
              height={s.radius * 2}
              offsetX={s.radius}
              offsetY={s.radius - 1}
              align="center"
              verticalAlign="middle"
            />
          </Group>
        );
    }
  };

  const shade = "rgba(0,0,0,0.55)";

  return (
    <div className="stage-wrap" style={{ width: width * zoom, height: height * zoom }}>
      <Stage
        ref={stageRef}
        width={width * zoom}
        height={height * zoom}
        scaleX={zoom}
        scaleY={zoom}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <Layer ref={shapesLayerRef}>
          <KImage name="background" image={doc.image} />
          {doc.shapes.map((s) => renderShape(s))}
          {draft && renderShape(draft, false)}
        </Layer>
        <Layer name="ui">
          {tool === "crop" && cropRect && (
            <Group listening={false}>
              <Rect x={0} y={0} width={width} height={cropRect.y} fill={shade} />
              <Rect x={0} y={cropRect.y + cropRect.height} width={width} height={height - cropRect.y - cropRect.height} fill={shade} />
              <Rect x={0} y={cropRect.y} width={cropRect.x} height={cropRect.height} fill={shade} />
              <Rect x={cropRect.x + cropRect.width} y={cropRect.y} width={width - cropRect.x - cropRect.width} height={cropRect.height} fill={shade} />
              <Rect {...cropRect} stroke="#fff" strokeWidth={1 / zoom} dash={[6 / zoom, 4 / zoom]} />
            </Group>
          )}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            flipEnabled={false}
            borderStroke="#f28c28"
            anchorStroke="#f28c28"
            anchorSize={9}
            ignoreStroke
            {...transformerProps(selectedShape)}
          />
        </Layer>
      </Stage>
      {editing && (
        <textarea
          className="text-editor"
          autoFocus
          defaultValue={editing.text}
          placeholder="Type… (Ctrl+Enter to finish)"
          style={{
            left: editing.x * zoom,
            top: editing.y * zoom,
            fontSize: editing.fontSize * zoom,
            color: editing.fill,
            fontFamily: FONT,
            padding: 4 * zoom,
          }}
          onBlur={(e) => finishText(e.currentTarget.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
              e.preventDefault();
              finishText(e.currentTarget.value);
            }
          }}
        />
      )}
    </div>
  );
}
