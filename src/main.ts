import CanvasAnimation from "./render";
import OffscreenCanvasWorker from "./worker?worker";
import { getPressPoint } from "./utils/get-press-point";
import { getDpr } from "./utils/device-pixel-ratio";
import { IMAGE_SOURCES } from "./images";
import { createArray } from "./utils/array";
import type { GridItem, GridItemSource, OffscreenCanvasMessage } from "./types";
import { isNonNullArray } from "./utils/null-check";
import ObservableValue from "./observable";
import "./main.css";

class HTMLCanvasRenderer {
  private canvasEl: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private worker: Worker | null;
  private animation: CanvasAnimation | null;
  private isOffscreen: boolean;

  private imageSources: Array<GridItemSource> = IMAGE_SOURCES;
  private images: Array<GridItem | null> = createArray(
    null,
    IMAGE_SOURCES.length
  );

  private dpr: number;
  private rafId = 0;

  public isLoaded: ObservableValue<boolean> = new ObservableValue(false);
  public activeIndex = new ObservableValue<number | null>(null);

  private resizeObserver: ResizeObserver;
  private boundHandlePressStart: (e: MouseEvent | TouchEvent) => void;
  private boundHandleMove: (e: MouseEvent | TouchEvent) => void;
  private boundHandlePressEnd: (e: MouseEvent | TouchEvent) => void;
  private boundHandleClick: (e: MouseEvent | TouchEvent) => void;
  private boundHandleMouseOut: () => void;
  private boundHandleWheel: (e: WheelEvent) => void;

  constructor(defaultWidth: number, defaultHeight: number) {
    this.isOffscreen = typeof window.OffscreenCanvas === "function";
    // this.isOffscreen = false;
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

    if (this.isOffscreen) {
      this.ctx = null;
      this.animation = null;
      this.worker = new OffscreenCanvasWorker();
      this.worker.onmessage = (e) => {
        if (e.data.type === "activeIndex") {
          this.activeIndex.value = e.data.index;
        }
      };

      const offscreen = this.canvasEl.transferControlToOffscreen();
      this.sendToWorker({
        type: "init",
        canvas: offscreen,
        dpr: this.dpr,
      });
    } else {
      this.worker = null;
      const ctx = this.canvasEl.getContext("2d");
      if (!ctx) throw new Error("Could not get 2d context in html canvas");
      this.ctx = ctx;
      this.animation = new CanvasAnimation(
        this.ctx,
        defaultWidth,
        defaultHeight,
        IMAGE_SOURCES.length
      );
      this.animation.activeIndex.subscribe((next) => {
        this.activeIndex.value = next;
      });

      this.render(0);
    }
  }

  private init(width: number, height: number) {
    const scale = this.isOffscreen ? 1 : this.dpr;
    this.canvasEl.width = width * scale;
    this.canvasEl.height = height * scale;
    this.canvasEl.style.width = `100%`;
    this.canvasEl.style.height = `100%`;
    if (!this.isOffscreen && this.ctx) this.ctx.scale(scale, scale);
  }

  private sendToWorker(msg: OffscreenCanvasMessage) {
    if (!this.worker) return;
    if (msg.type === "init") {
      const { canvas, ...props } = msg;
      this.worker.postMessage({ ...props, canvas }, [canvas]);
    } else {
      this.worker.postMessage(msg);
    }
  }

  private loadImages() {
    this.imageSources.forEach((source, i) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = source.src;
      image.onload = async () => {
        if (this.isOffscreen) {
          const bitmap = await createImageBitmap(image);
          this.images[i] = {
            element: bitmap,
            title: source.title,
            type: source.type,
          };
          if (isNonNullArray(this.images)) {
            this.sendToWorker({ type: "image", images: this.images });
            this.isLoaded.value = true;
          }
        } else {
          this.images[i] = {
            element: image,
            title: source.title,
            type: source.type,
          };
          if (isNonNullArray(this.images)) {
            this.animation?.onImagesLoaded(this.images);
            this.isLoaded.value = true;
          }
        }
      };
    });
  }

  private handlePressStart(e: MouseEvent | TouchEvent) {
    const { x, y } = getPressPoint(e);
    if (this.isOffscreen) {
      this.sendToWorker({
        type: "pressStart",
        isPressed: true,
        x,
        y,
      });
    } else {
      this.animation?.onPress(true, x, y);
    }
  }

  private handlePressEnd(e: MouseEvent | TouchEvent) {
    const { x, y } = getPressPoint(e);
    if (this.isOffscreen) {
      this.sendToWorker({
        type: "pressEnd",
        isPressed: false,
        x,
        y,
      });
    } else {
      this.animation?.onPress(false, x, y);
    }
  }

  private handleClick(e: MouseEvent | TouchEvent) {
    const { x, y } = getPressPoint(e);
    if (this.isOffscreen) {
      this.sendToWorker({ type: "click", x, y });
    } else {
      this.animation?.onClick(x, y);
    }
  }

  private handleMove(e: MouseEvent | TouchEvent) {
    const { x, y } = getPressPoint(e);
    if (this.isOffscreen) {
      this.sendToWorker({ type: "mouseMove", x, y });
    } else {
      this.animation?.onMove(x, y);
    }
  }

  private handleMouseOut() {
    if (this.isOffscreen) {
      this.sendToWorker({
        type: "pressEnd",
        isPressed: false,
      });
    } else {
      this.animation?.onPress(false);
    }
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (this.isOffscreen) {
      this.sendToWorker({
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

      if (this.isOffscreen) {
        this.sendToWorker({
          type: "resize",
          width: width,
          height: height,
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
    if (this.images.findIndex((image) => image === null) !== -1) {
      this.loadImages();
    }
    const { width, height } = node.getBoundingClientRect();
    node.appendChild(this.canvasEl);
    this.animation?.onResize(width, height);
  }

  public setActiveIndex(index: number | null) {
    if (this.isOffscreen) {
      this.sendToWorker({ type: "activeIndexChange", index });
    } else {
      this.animation?.setActiveIndex(index);
    }
  }

  public destroy() {
    this.removeEventListeners();
    this.resizeObserver.unobserve(this.canvasEl);
    this.resizeObserver.disconnect();
    this.animation?.activeIndex.unsubscribeAll();
    this.activeIndex.unsubscribeAll();
    this.isLoaded.unsubscribeAll();
    if (this.worker) this.worker.onmessage = null;
  }
}

const app = document.querySelector("#root");
if (!app) throw new Error("Could not find root element.");
const canvasRenderer = new HTMLCanvasRenderer(
  window.innerWidth,
  window.innerHeight
);
canvasRenderer.appendTo(app);
canvasRenderer.isLoaded.subscribe((isLoaded) => {
  console.log("The scene is loaded: ", isLoaded);
});
canvasRenderer.activeIndex.subscribe((index) => {
  console.log("The active index is: ", index);
});

const button = document.querySelector("button");
button?.addEventListener("click", () => {
  canvasRenderer.setActiveIndex(null);
});
