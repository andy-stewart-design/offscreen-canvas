import CanvasAnimation from "./canvas-animation";
import OffscreenCanvasWorker from "./worker?worker";
import ObservableValue from "./observable";
import { getPressPoint } from "./utils/get-press-point";
import { getDpr } from "./utils/device-pixel-ratio";
import { IMAGE_SOURCES } from "./images";
import { createArray } from "./utils/array";
import { isNonNullArray } from "./utils/null-check";
import { getGridDimensions } from "./utils/grid-dimensions";
import type { GridItem, GridItemSource, OffscreenCanvasMessage } from "./types";

class HTMLCanvasRenderer {
  public canvasEl: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private worker: Worker | null;
  private animation: CanvasAnimation | null;
  private isOffscreen: boolean;
  private grid: { cols: number; rows: number };

  private isFocused = false;
  private focusedIndex = 0;
  private globalShiftKey = false;
  private globalTabKey = false;

  private imageSources: Array<GridItemSource>;
  private images: Array<GridItem | null> = createArray(
    null,
    IMAGE_SOURCES.length
  );

  private dpr: number;
  private rafId = 0;

  private paused = new ObservableValue(false);
  public isLoaded = new ObservableValue(false);
  public activeIndex = new ObservableValue<number | null>(null);

  private resizeObserver: ResizeObserver;
  private boundHandlePressStart: (e: MouseEvent | TouchEvent) => void;
  private boundHandleMove: (e: MouseEvent | TouchEvent) => void;
  private boundHandlePressEnd: (e: MouseEvent | TouchEvent) => void;
  private boundHandleClick: (e: MouseEvent | TouchEvent) => void;
  private boundHandleMouseOut: () => void;
  private boundHandleWheel: (e: WheelEvent) => void;
  private boundHandleKeyDown: (e: KeyboardEvent) => void;
  private boundHandleFocus: () => void;
  private boundHandleGlobalKeyEvent: (e: KeyboardEvent) => void;
  private boundHandleGlobalVisChangeEvent: () => void;

  constructor(defaultWidth: number, defaultHeight: number) {
    this.isOffscreen = typeof window.OffscreenCanvas === "function";
    this.canvasEl = document.createElement("canvas");
    this.canvasEl.tabIndex = 1;
    this.dpr = getDpr();
    const [cols, rows] = getGridDimensions(this.images.length);
    this.grid = { cols, rows };
    this.imageSources = IMAGE_SOURCES.slice(0, cols * rows);
    this.init(defaultWidth, defaultHeight);

    this.resizeObserver = this.createResizeObserver();
    this.boundHandlePressStart = this.handlePressStart.bind(this);
    this.boundHandleMove = this.handleMove.bind(this);
    this.boundHandlePressEnd = this.handlePressEnd.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
    this.boundHandleMouseOut = this.handleMouseOut.bind(this);
    this.boundHandleWheel = this.handleWheel.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleGlobalKeyEvent = this.handleGlobalKeyEvent.bind(this);
    this.boundHandleGlobalVisChangeEvent =
      this.handleGlobalVisChange.bind(this);
    this.boundHandleFocus = this.handleFocus.bind(this);
    this.addEventListeners();

    this.paused.subscribe((paused) => {
      console.log("paused changed");
      if (paused) {
        console.log("Pausing");
        this.cancelRender();
      } else {
        console.log("Playing");
        this.render();
      }
    });

    if (this.isOffscreen) {
      this.ctx = null;
      this.animation = null;
      this.worker = new OffscreenCanvasWorker();
      this.worker.onmessage = (e) => {
        if (e.data.type === "activeIndex") {
          this.activeIndex.value = e.data.index;
          if (e.data.index !== null) this.focusedIndex = e.data.index;
        } else if (e.data.type === "hoveredIndex") {
          if (e.data.index === null) this.canvasEl.style.cursor = "default";
          else this.canvasEl.style.cursor = "pointer";
        }
      };

      const offscreen = this.canvasEl.transferControlToOffscreen();
      this.sendToWorker({
        type: "init",
        canvas: offscreen,
        cols,
        rows,
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
        cols,
        rows
      );
      this.animation.activeIndex.subscribe((next) => {
        this.activeIndex.value = next;
        if (next !== null) this.focusedIndex = next;
      });
      this.animation.hoveredIndex.subscribe((next) => {
        if (next === null) this.canvasEl.style.cursor = "default";
        else this.canvasEl.style.cursor = "pointer";
      });
    }

    this.paused.value = false;
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

  private sendFocusToWorker() {
    if (this.isOffscreen) {
      this.sendToWorker({
        type: "focus",
        isFocused: this.isFocused,
        focusIndex: this.focusedIndex,
      });
    } else {
      this.animation?.onFocus(this.isFocused, this.focusedIndex);
    }
  }

  private loadImages() {
    this.imageSources.forEach((source, i) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = source.url;
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
    if (this.isPaused) return;
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
    if (this.isFocused) {
      this.isFocused = false;
      this.sendFocusToWorker();
    }
  }

  private handlePressEnd(e: MouseEvent | TouchEvent) {
    if (this.isPaused) return;
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
    if (this.isPaused) return;
    const { x, y } = getPressPoint(e);
    if (this.isOffscreen) {
      this.sendToWorker({ type: "click", x, y });
    } else {
      this.animation?.onClick(x, y);
    }
  }

  private handleMove(e: MouseEvent | TouchEvent) {
    if (this.isPaused) return;
    const { x, y } = getPressPoint(e);
    if (this.isOffscreen) {
      this.sendToWorker({ type: "mouseMove", x, y });
    } else {
      this.animation?.onMove(x, y);
    }
  }

  private handleMouseOut() {
    if (this.isPaused) return;
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
    if (this.isPaused) return;
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

    if (this.isFocused) {
      this.isFocused = false;
      this.sendFocusToWorker();
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.isPaused) return;
    const maxIndex = this.grid.cols * this.grid.rows - 1;
    if (e.key === "Tab") {
      if (this.globalShiftKey && this.focusedIndex > 0) {
        e.preventDefault();
        this.isFocused = true;
        this.focusedIndex--;
      } else if (!this.globalShiftKey && this.focusedIndex < maxIndex) {
        e.preventDefault();
        this.isFocused = true;
        this.focusedIndex++;
      } else {
        this.isFocused = false;
      }
    } else if (e.key === "ArrowDown") {
      this.focusedIndex =
        (this.focusedIndex + this.grid.cols) %
        (this.grid.cols * this.grid.rows);
    } else if (e.key === "ArrowUp") {
      if (this.focusedIndex - this.grid.cols < 0) {
        const remainder = this.grid.cols - this.focusedIndex - 1;
        this.focusedIndex = maxIndex - remainder;
      } else {
        this.focusedIndex = this.focusedIndex - this.grid.cols;
      }
    } else if (e.key === "ArrowRight") {
      const rowIndex = Math.floor(this.focusedIndex / this.grid.cols);
      const startValue = rowIndex * this.grid.cols;
      const endValue = startValue + this.grid.cols - 1;

      if (this.focusedIndex < endValue) this.focusedIndex++;
      else this.focusedIndex = startValue;
    } else if (e.key === "ArrowLeft") {
      const rowIndex = Math.floor(this.focusedIndex / this.grid.cols);
      const startValue = rowIndex * this.grid.cols;
      const endValue = startValue + this.grid.cols - 1;

      if (this.focusedIndex > startValue) this.focusedIndex--;
      else this.focusedIndex = endValue;
    }
    this.sendFocusToWorker();
  }

  private handleFocus() {
    if (this.isPaused) return;
    this.isFocused = this.canvasEl.matches(":focus-visible");

    if (this.globalShiftKey) {
      this.focusedIndex = this.grid.cols * this.grid.rows - 1;
      this.sendFocusToWorker();
    } else if (this.globalTabKey) {
      this.focusedIndex = 0;
      this.sendFocusToWorker();
    }
  }

  private handleGlobalKeyEvent(e: KeyboardEvent) {
    console.log(e.key, e.metaKey, e.shiftKey);
    if (this.isPaused) return;
    this.globalShiftKey = e.shiftKey;
    this.globalTabKey = e.key === "Tab";

    if (e.key === "d" && e.metaKey && e.shiftKey) {
      if (this.isOffscreen) {
        this.sendToWorker({
          type: "debug",
        });
      } else {
        this.animation?.debug();
      }
    }
  }

  private handleGlobalVisChange() {
    if (this.isPaused) return;
    if (document.hidden) this.globalTabKey = false;
  }

  private createResizeObserver() {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const currentPaused = this.isPaused;
      if (!currentPaused) this.pause();

      if (this.isOffscreen) {
        this.sendToWorker({
          type: "resize",
          width: width,
          height: height,
        });
      } else {
        this.init(width, height);
        this.animation?.onResize(width, height);
      }

      if (!currentPaused) this.play();
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
    this.canvasEl.addEventListener("keydown", this.boundHandleKeyDown);
    this.canvasEl.addEventListener("focus", this.boundHandleFocus);
    window.addEventListener("keydown", this.boundHandleGlobalKeyEvent);
    window.addEventListener("keyup", this.boundHandleGlobalKeyEvent);
    document.addEventListener(
      "visibilitychange",
      this.boundHandleGlobalVisChangeEvent
    );
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
    this.canvasEl.removeEventListener("keydown", this.boundHandleKeyDown);
    this.canvasEl.removeEventListener("focus", this.boundHandleFocus);
    window.removeEventListener("keydown", this.boundHandleGlobalKeyEvent);
    window.removeEventListener("keyup", this.boundHandleGlobalKeyEvent);
    document.removeEventListener(
      "visibilitychange",
      this.boundHandleGlobalVisChangeEvent
    );
  }

  private render(timestamp = 0) {
    if (!this.isOffscreen) {
      if (!this.animation) return;
      this.animation.render(timestamp);
      this.rafId = requestAnimationFrame((t) => this.render(t));
    } else {
      this.sendToWorker({ type: "playbackChange", paused: false });
    }
  }

  private cancelRender() {
    if (!this.isOffscreen) {
      cancelAnimationFrame(this.rafId);
    } else {
      this.sendToWorker({ type: "playbackChange", paused: true });
    }
  }

  get isPaused() {
    return this.paused.value;
  }

  public play() {
    console.log("firing play");
    this.paused.value = false;
  }

  public pause() {
    this.paused.value = true;
  }

  public appendTo(node: Element) {
    if (this.images.findIndex((image) => image === null) !== -1) {
      this.loadImages();
    }
    const { width, height } = node.getBoundingClientRect();
    node.appendChild(this.canvasEl);
    this.animation?.onResize(width, height);
    if (this.isPaused) this.play();
  }

  public setActiveIndex(index: number | null) {
    if (index !== null) this.focusedIndex = index;
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
    this.paused.unsubscribeAll();
    this.animation?.activeIndex.unsubscribeAll();
    this.activeIndex.unsubscribeAll();
    this.isLoaded.unsubscribeAll();
    if (this.worker) this.worker.onmessage = null;
  }
}

export default HTMLCanvasRenderer;
