import type { GridItem } from "./types";

interface OffscreenCanvasInit {
  type: "init";
  canvas: OffscreenCanvas;
  dpr: number;
}

interface OffscreenCanvasMoveEvent {
  type: "mouseMove";
  x: number;
  y: number;
}

interface OffscreenCanvasPressEvent {
  type: "pressStart" | "pressEnd";
  isPressed: boolean;
  x?: number;
  y?: number;
}

interface OffscreenCanvasClickEvent {
  type: "click";
  x: number;
  y: number;
}

interface OffscreenCanvasWheelEvent {
  type: "wheel";
  deltaX: number;
  deltaY: number;
}

interface OffscreenCanvasResizeEvent {
  type: "resize";
  width: number;
  height: number;
}

interface OffscreenCanvasResizeEvent {
  type: "resize";
  width: number;
  height: number;
}

interface OffscreenCanvasImageEvent {
  type: "image";
  images: Array<GridItem>;
}

type OffscreenCanvasMessage =
  | OffscreenCanvasInit
  | OffscreenCanvasMoveEvent
  | OffscreenCanvasPressEvent
  | OffscreenCanvasClickEvent
  | OffscreenCanvasWheelEvent
  | OffscreenCanvasResizeEvent
  | OffscreenCanvasImageEvent;

type OffscreenCanvasMessageEvent = MessageEvent<OffscreenCanvasMessage>;

export {
  type OffscreenCanvasInit,
  type OffscreenCanvasMessage,
  type OffscreenCanvasMessageEvent,
  type OffscreenCanvasMoveEvent,
  type OffscreenCanvasPressEvent,
  type OffscreenCanvasResizeEvent,
};
