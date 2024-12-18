// MARK: Generic types ---------------------------------------------------------
interface Vec2 {
  x: number;
  y: number;
}

interface Vec3 extends Vec2 {
  z: number;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

// MARK: Grid types -----------------------------------------------------
interface GridItemSource {
  type: "product" | "influencer";
  title: string;
  url: string;
}

type GridImage = ImageBitmap | HTMLImageElement;

interface GridItem {
  type: "product" | "influencer";
  title: string;
  element: GridImage;
}

// MARK: Offscreen Canvas types -----------------------------------------------------
interface OffscreenCanvasInit {
  type: "init";
  canvas: OffscreenCanvas;
  cols: number;
  rows: number;
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

interface OffscreenCanvasFocusEvent {
  type: "focus";
  isFocused: boolean;
  focusIndex: number;
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

interface OffscreenCanvasPlaybackChangeEvent {
  type: "playbackChange";
  paused: boolean;
}

interface OffscreenCanvasActiveIndexChangeEvent {
  type: "activeIndexChange";
  index: number | null;
}

interface OffscreenCanvasDebugChangeEvent {
  type: "debug";
}

type OffscreenCanvasMessage =
  | OffscreenCanvasInit
  | OffscreenCanvasMoveEvent
  | OffscreenCanvasPressEvent
  | OffscreenCanvasClickEvent
  | OffscreenCanvasWheelEvent
  | OffscreenCanvasFocusEvent
  | OffscreenCanvasResizeEvent
  | OffscreenCanvasImageEvent
  | OffscreenCanvasActiveIndexChangeEvent
  | OffscreenCanvasPlaybackChangeEvent
  | OffscreenCanvasDebugChangeEvent;

type OffscreenCanvasMessageEvent = MessageEvent<OffscreenCanvasMessage>;

export type {
  Vec2,
  Vec3,
  Box,
  GridImage,
  GridItem,
  GridItemSource,
  OffscreenCanvasInit,
  OffscreenCanvasMessageEvent,
  OffscreenCanvasMessage,
};
