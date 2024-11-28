import { render } from "./render";
import { sendToWorker } from "./send-to-worker";
import { getPressPoint } from "./utils/get-press-point";
import "./main.css";

interface Vec2 {
  x: number;
  y: number;
}

class OffscreenCanvasRenderer {
  private canvasEl: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private useOffscreenCanvas: boolean;

  private dpr: number;
  private rafId = 0;
  private isPressed = false;
  private mouse: Vec2 = { x: 0, y: 0 };

  private resizeObserver: ResizeObserver;
  private boundHandlePressStart: () => void;
  private boundHandleMove: (e: MouseEvent | TouchEvent) => void;
  private boundHandlePressEnd: () => void;
  private boundHandleMouseOut: () => void;

  constructor() {
    this.useOffscreenCanvas = typeof window.OffscreenCanvas === "function";
    // this.useOffscreenCanvas = false;
    this.canvasEl = document.createElement("canvas");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.init(window.innerWidth, window.innerHeight);

    this.resizeObserver = this.createResizeObserver();
    this.boundHandlePressStart = this.handlePressStart.bind(this);
    this.boundHandleMove = this.handleMove.bind(this);
    this.boundHandlePressEnd = this.handlePressEnd.bind(this);
    this.boundHandleMouseOut = this.handleMouseOut.bind(this);
    this.addEventListeners();

    if (this.useOffscreenCanvas) {
      console.log("using offscreen canvas");

      this.ctx = null;
      const offscreen = this.canvasEl.transferControlToOffscreen();
      sendToWorker({
        type: "init",
        canvas: offscreen,
      });
    } else {
      console.log("using html canvas");

      const ctx = this.canvasEl.getContext("2d");
      if (!ctx) throw new Error("Could not get 2d context in html canvas");
      this.ctx = ctx;

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
      this.isPressed = true;
    }
  }

  private handlePressEnd() {
    if (this.useOffscreenCanvas) {
      sendToWorker({
        type: "pressEnd",
        isPressed: false,
      });
    } else {
      this.isPressed = false;
    }
  }

  private handleMove(e: MouseEvent | TouchEvent) {
    const { x, y } = getPressPoint(e);
    if (this.useOffscreenCanvas) {
      sendToWorker({
        type: "mouseMove",
        x: x * this.dpr,
        y: y * this.dpr,
      });
    } else {
      this.mouse = { x, y };
    }
  }

  private handleMouseOut() {
    if (this.useOffscreenCanvas) {
      sendToWorker({
        type: "pressEnd",
        isPressed: false,
      });
    } else {
      this.isPressed = false;
    }
  }

  private createResizeObserver() {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (this.useOffscreenCanvas) {
        sendToWorker({
          type: "resize",
          width: entry.contentRect.width * this.dpr,
          height: entry.contentRect.height * this.dpr,
        });
      } else {
        cancelAnimationFrame(this.rafId);
        this.init(entry.contentRect.width, entry.contentRect.height);
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
  }

  private removeEventListeners() {
    this.canvasEl.removeEventListener("mousedown", this.boundHandlePressStart);
    this.canvasEl.removeEventListener("mousemove", this.boundHandleMove);
    this.canvasEl.removeEventListener("mouseup", this.boundHandlePressEnd);
    this.canvasEl.removeEventListener("mouseout", this.boundHandleMouseOut);
    this.canvasEl.removeEventListener("touchstart", this.boundHandlePressStart);
    this.canvasEl.removeEventListener("touchmove", this.boundHandleMove);
    this.canvasEl.removeEventListener("touchend", this.boundHandlePressEnd);
  }

  private render(timestamp: number) {
    if (!this.ctx) return;
    const width = this.canvasEl.width / this.dpr;
    const height = this.canvasEl.height / this.dpr;
    render(
      this.ctx,
      width,
      height,
      this.mouse.x,
      this.mouse.y,
      this.isPressed,
      timestamp
    );
    this.rafId = requestAnimationFrame((t) => this.render(t));
  }

  public appendTo(node: Element) {
    node.appendChild(this.canvasEl);
  }

  public destroy() {
    this.removeEventListeners();
    this.resizeObserver.unobserve(this.canvasEl);
    this.resizeObserver.disconnect();
  }
}

const app = document.querySelector("#root");
if (!app) throw new Error("Could not find root element.");
const occanvas = new OffscreenCanvasRenderer();
occanvas.appendTo(app);
