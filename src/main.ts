import CanvasAnimation from "./render";
import { sendToWorker } from "./send-to-worker";
import { getPressPoint } from "./utils/get-press-point";
import "./main.css";
import { getDpr } from "./utils/device-pixel-ratio";

class HTMLCanvasRenderer {
  private canvasEl: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private useOffscreenCanvas: boolean;
  private animation: CanvasAnimation | null = null;

  private dpr: number;
  private rafId = 0;

  private resizeObserver: ResizeObserver;
  private boundHandlePressStart: () => void;
  private boundHandleMove: (e: MouseEvent | TouchEvent) => void;
  private boundHandlePressEnd: () => void;
  private boundHandleClick: (e: MouseEvent | TouchEvent) => void;
  private boundHandleMouseOut: () => void;
  private boundHandleWheel: (e: WheelEvent) => void;

  constructor(defaultWidth: number, defaultHeight: number) {
    this.useOffscreenCanvas = typeof window.OffscreenCanvas === "function";
    // this.useOffscreenCanvas = false;
    this.canvasEl = document.createElement("canvas");
    this.dpr = getDpr();
    this.init(defaultWidth, defaultHeight);

    this.resizeObserver = this.createResizeObserver();
    this.boundHandlePressStart = this.handlePressStart.bind(this);
    this.boundHandleMove = this.handleMove.bind(this);
    this.boundHandlePressEnd = this.handlePressEnd.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
    this.boundHandleMouseOut = this.handleMouseOut.bind(this);
    this.boundHandleWheel = this.handleWheel.bind(this);
    this.addEventListeners();

    if (this.useOffscreenCanvas) {
      this.ctx = null;
      const offscreen = this.canvasEl.transferControlToOffscreen();
      sendToWorker({
        type: "init",
        canvas: offscreen,
        dpr: this.dpr,
      });
    } else {
      const ctx = this.canvasEl.getContext("2d");
      if (!ctx) throw new Error("Could not get 2d context in html canvas");
      this.ctx = ctx;
      this.animation = new CanvasAnimation(
        this.ctx,
        defaultWidth,
        defaultHeight,
        this.dpr
      );

      this.render(0);
    }
  }

  private init(width: number, height: number) {
    this.canvasEl.width = width * this.dpr;
    this.canvasEl.height = height * this.dpr;
    this.canvasEl.style.width = `100%`;
    this.canvasEl.style.height = `100%`;
    this.ctx?.scale(this.dpr, this.dpr);
  }

  private handlePressStart() {
    if (this.useOffscreenCanvas) {
      sendToWorker({
        type: "pressStart",
        isPressed: true,
      });
    } else {
      this.animation?.onPress(true);
    }
  }

  private handlePressEnd() {
    if (this.useOffscreenCanvas) {
      sendToWorker({
        type: "pressEnd",
        isPressed: false,
      });
    } else {
      this.animation?.onPress(false);
    }
  }

  private handleClick(e: MouseEvent | TouchEvent) {
    const { x, y } = getPressPoint(e);
    if (this.useOffscreenCanvas) {
      sendToWorker({ type: "click", x, y });
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = "https://picsum.photos/200/300";
      image.onload = async () => {
        const bitmap = await createImageBitmap(image); // Resolve the promise
        sendToWorker({ type: "image", image: bitmap });
      };
    } else {
      this.animation?.onClick(x, y);
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = "https://picsum.photos/200/300";
      image.onload = () => {
        this.animation?.onImageLoaded(image);
      };
    }
  }

  private handleMove(e: MouseEvent | TouchEvent) {
    const { x, y } = getPressPoint(e);
    if (this.useOffscreenCanvas) {
      sendToWorker({ type: "mouseMove", x, y });
    } else {
      this.animation?.onMove(x, y);
    }
  }

  private handleMouseOut() {
    if (this.useOffscreenCanvas) {
      sendToWorker({
        type: "pressEnd",
        isPressed: false,
      });
    } else {
      this.animation?.onPress(false);
    }
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (this.useOffscreenCanvas) {
      sendToWorker({
        type: "wheel",
        deltaX: e.deltaX,
        deltaY: e.deltaY,
      });
    } else {
      this.animation?.onWheel(e.deltaX, e.deltaY);
    }
  }

  private createResizeObserver() {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;

      if (this.useOffscreenCanvas) {
        sendToWorker({
          type: "resize",
          width: width * this.dpr,
          height: height * this.dpr,
        });
      } else {
        cancelAnimationFrame(this.rafId);
        this.init(width, height);
        this.animation?.onResize(width, height);
        this.render(0);
      }
    });

    observer.observe(this.canvasEl);
    return observer;
  }

  private addEventListeners() {
    this.canvasEl.addEventListener("mousedown", this.boundHandlePressStart);
    this.canvasEl.addEventListener("mousemove", this.boundHandleMove);
    this.canvasEl.addEventListener("mouseup", this.boundHandlePressEnd);
    this.canvasEl.addEventListener("mouseout", this.boundHandleMouseOut);
    this.canvasEl.addEventListener("touchstart", this.boundHandlePressStart);
    this.canvasEl.addEventListener("touchmove", this.boundHandleMove);
    this.canvasEl.addEventListener("touchend", this.boundHandlePressEnd);
    this.canvasEl.addEventListener("click", this.boundHandleClick);
    this.canvasEl.addEventListener("wheel", this.boundHandleWheel);
  }

  private removeEventListeners() {
    this.canvasEl.removeEventListener("mousedown", this.boundHandlePressStart);
    this.canvasEl.removeEventListener("mousemove", this.boundHandleMove);
    this.canvasEl.removeEventListener("mouseup", this.boundHandlePressEnd);
    this.canvasEl.removeEventListener("mouseout", this.boundHandleMouseOut);
    this.canvasEl.removeEventListener("touchstart", this.boundHandlePressStart);
    this.canvasEl.removeEventListener("touchmove", this.boundHandleMove);
    this.canvasEl.removeEventListener("touchend", this.boundHandlePressEnd);
    this.canvasEl.removeEventListener("click", this.boundHandleClick);
    this.canvasEl.removeEventListener("wheel", this.boundHandleWheel);
  }

  private render(timestamp: number) {
    if (!this.animation) return;
    this.animation.render(timestamp);
    this.rafId = requestAnimationFrame((t) => this.render(t));
  }

  public appendTo(node: Element) {
    const { width, height } = node.getBoundingClientRect();
    node.appendChild(this.canvasEl);
    this.animation?.onResize(width, height);
  }

  public destroy() {
    this.removeEventListeners();
    this.resizeObserver.unobserve(this.canvasEl);
    this.resizeObserver.disconnect();
  }
}

const app = document.querySelector("#root");
if (!app) throw new Error("Could not find root element.");
const canvasRenderer = new HTMLCanvasRenderer(
  window.innerWidth,
  window.innerHeight
);
canvasRenderer.appendTo(app);
