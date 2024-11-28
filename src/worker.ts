import { render } from "./render";
import type {
  OffscreenCanvasInit,
  OffscreenCanvasMessageEvent,
} from "./send-to-worker";

class OffscreenCanvasRenderer {
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;

  private rafId = 0;
  private isPressed = false;
  private mouse = { x: 0, y: 0 };

  public init({ canvas }: OffscreenCanvasInit) {
    console.log("initing offscreen canvas");

    this.canvas = canvas;

    const offscreenCTX = this.canvas.getContext("2d");
    if (!offscreenCTX) {
      throw new Error("Could not get 2d context in web worker");
    }

    this.ctx = offscreenCTX;
    this.render(0);
  }

  public onMouseMove(vec: { x: number; y: number }) {
    this.mouse = vec;
  }

  public onPress(nextPress: boolean) {
    this.isPressed = nextPress;
  }

  public onResize(width: number, height: number) {
    if (!this.canvas) return;

    cancelAnimationFrame(this.rafId);
    this.canvas.width = width;
    this.canvas.height = height;

    this.render(0);
  }

  public render(timestamp: number) {
    if (!this.ctx || !this.canvas) return;
    render(
      this.ctx,
      this.canvas.width,
      this.canvas.height,
      this.mouse.x,
      this.mouse.y,
      this.isPressed,
      timestamp
    );
    this.rafId = requestAnimationFrame((t) => this.render(t));
  }

  public destroy() {
    cancelAnimationFrame(this.rafId);
  }
}

const renderer = new OffscreenCanvasRenderer();
self.onmessage = handleOffscreenCanvasMessage;

function handleOffscreenCanvasMessage({ data }: OffscreenCanvasMessageEvent) {
  if (data.type === "init") {
    renderer.init(data);
  } else if (data.type === "mouseMove") {
    renderer.onMouseMove(data);
  } else if (data.type === "pressStart" || data.type === "pressEnd") {
    renderer.onPress(data.isPressed);
  } else if (data.type === "resize") {
    renderer.onResize(data.width, data.height);
  }
}
