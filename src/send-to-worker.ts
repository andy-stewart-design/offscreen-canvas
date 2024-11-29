import OffscreenCanvasWorker from "./worker?worker";

interface OffscreenCanvasInit {
  type: "init";
  canvas: OffscreenCanvas;
}

interface OffscreenCanvasMoveEvent {
  type: "mouseMove";
  x: number;
  y: number;
}

interface OffscreenCanvasPressEvent {
  type: "pressStart" | "pressEnd";
  isPressed: boolean;
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

type OffscreenCanvasMessage =
  | OffscreenCanvasInit
  | OffscreenCanvasMoveEvent
  | OffscreenCanvasPressEvent
  | OffscreenCanvasWheelEvent
  | OffscreenCanvasResizeEvent;
type OffscreenCanvasMessageEvent = MessageEvent<OffscreenCanvasMessage>;

const worker = new OffscreenCanvasWorker();

function sendToWorker(msg: OffscreenCanvasMessage) {
  if (msg.type === "init") {
    const { type, canvas } = msg;
    worker.postMessage({ type, canvas }, [canvas]);
  } else {
    worker.postMessage(msg);
  }
}

export {
  sendToWorker,
  type OffscreenCanvasInit,
  type OffscreenCanvasMessageEvent,
  type OffscreenCanvasMoveEvent,
  type OffscreenCanvasPressEvent,
  type OffscreenCanvasResizeEvent,
};
