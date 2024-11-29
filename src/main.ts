import CanvasAnimation from "./render";
import { sendToWorker } from "./send-to-worker";
import { getPressPoint } from "./utils/get-press-point";
import "./main.css";

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
  private boundHandleMouseOut: () => void;
  private boundHandleWheel: (e: WheelEvent) => void;

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
    this.boundHandleWheel = this.handleWheel.bind(this);
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
      this.animation = new CanvasAnimation(
        this.ctx,
        window.innerWidth,
        window.innerHeight
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
      this.animation?.set("pressed", true);
    }
  }

  private handlePressEnd() {
    if (this.useOffscreenCanvas) {
      sendToWorker({
        type: "pressEnd",
        isPressed: false,
      });
    } else {
      this.animation?.set("pressed", false);
    }
  }

  private handleMove(e: MouseEvent | TouchEvent) {
    const { x, y } = getPressPoint(e);
    console.log("setting mouse");
    if (this.useOffscreenCanvas) {
      sendToWorker({
        type: "mouseMove",
        x: x * this.dpr,
        y: y * this.dpr,
      });
    } else {
      this.animation?.set("mouse", x, y);
    }
  }

  private handleMouseOut() {
    if (this.useOffscreenCanvas) {
      sendToWorker({
        type: "pressEnd",
        isPressed: false,
      });
    } else {
      this.animation?.set("pressed", false);
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
      this.animation?.panCamera(-e.deltaX, -e.deltaY);
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
        this.animation?.set("size", width, height);
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
    this.animation?.set("size", width, height);
  }

  public destroy() {
    this.removeEventListeners();
    this.resizeObserver.unobserve(this.canvasEl);
    this.resizeObserver.disconnect();
  }
}

const app = document.querySelector("#root");
if (!app) throw new Error("Could not find root element.");
const occanvas = new HTMLCanvasRenderer();
occanvas.appendTo(app);
