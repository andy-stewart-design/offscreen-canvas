import CanvasAnimation from "./render";
import type {
  OffscreenCanvasInit,
  OffscreenCanvasMessageEvent,
} from "./send-to-worker";

class OffscreenCanvasRenderer {
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private animation: CanvasAnimation | null = null;
  private rafId = 0;

  public init({ canvas }: OffscreenCanvasInit) {
    console.log("initing offscreen canvas");

    this.canvas = canvas;

    const offscreenCTX = this.canvas.getContext("2d");
    if (!offscreenCTX) {
      throw new Error("Could not get 2d context in web worker");
    }

    this.ctx = offscreenCTX;
    this.animation = new CanvasAnimation(
      this.ctx,
      this.canvas.width,
      this.canvas.height
    );
    this.render(0);
  }

  public onMouseMove(vec: { x: number; y: number }) {
    this.animation?.setMouse(vec.x, vec.y);
  }

  public onPress(nextPress: boolean) {
    this.animation?.setPressed(nextPress);
  }

  public resize(width: number, height: number) {
    if (!this.canvas) return;

    cancelAnimationFrame(this.rafId);
    this.canvas.width = width;
    this.canvas.height = height;
    this.animation?.resize(width, height);

    this.render(0);
  }

  public render(timestamp: number) {
    if (!this.animation) return;
    this.animation.render(timestamp);
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
    renderer.resize(data.width, data.height);
  }
}
