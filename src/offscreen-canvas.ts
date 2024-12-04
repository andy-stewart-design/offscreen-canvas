import CanvasAnimation from "./canvas-animation";
import type { GridItem, Vec2, OffscreenCanvasInit } from "./types";

class OffscreenCanvasRenderer {
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private animation: CanvasAnimation | null = null;
  private rafId = 0;
  private dpr = 1;

  private play(timestamp = 0) {
    if (!this.animation) return;
    this.animation.render(timestamp);
    this.rafId = requestAnimationFrame((t) => this.play(t));
  }

  private pause() {
    cancelAnimationFrame(this.rafId);
  }

  public init({ canvas, cols, rows, dpr }: OffscreenCanvasInit) {
    this.canvas = canvas;
    this.dpr = dpr;

    const offscreenCTX = this.canvas.getContext("2d");
    if (!offscreenCTX) {
      throw new Error("Could not get 2d context in web worker");
    }

    this.ctx = offscreenCTX;
    this.ctx.scale(this.dpr, this.dpr);
    this.animation = new CanvasAnimation(
      this.ctx,
      this.canvas.width,
      this.canvas.height,
      cols,
      rows
    );

    this.animation.activeIndex.subscribe((index) =>
      self.postMessage({ type: "activeIndex", index })
    );

    this.animation.hoveredIndex.subscribe((index) => {
      self.postMessage({ type: "hoveredIndex", index });
    });
  }

  public onMouseMove(vec: Vec2) {
    this.animation?.onMove(vec.x, vec.y);
  }

  public onPress(isPressed: boolean, x?: number, y?: number) {
    this.animation?.onPress(isPressed, x, y);
  }

  public onClick(vec: Vec2) {
    this.animation?.onClick(vec.x, vec.y);
  }

  public onWheel(deltaX: number, deltaY: number) {
    this.animation?.onWheel(deltaX, deltaY);
  }

  public onFocus(isFocused: boolean, focusIndex: number) {
    this.animation?.onFocus(isFocused, focusIndex);
  }

  public onImageLoaded(images: Array<GridItem>) {
    this.animation?.onImagesLoaded(images);
  }

  public onActiveIndexChange(index: number | null) {
    this.animation?.setActiveIndex(index);
  }

  public onPlaybackChange(paused: boolean) {
    if (paused) this.pause();
    else this.play();
  }

  public onDebugChange() {
    this.animation?.debug();
  }

  public resize(width: number, height: number) {
    if (!this.canvas || !this.ctx) return;

    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    this.animation?.onResize(width, height);
  }

  public destroy() {
    cancelAnimationFrame(this.rafId);
    this.animation?.activeIndex.unsubscribeAll();
  }
}

export default OffscreenCanvasRenderer;
