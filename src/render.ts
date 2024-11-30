import type { Box, Vec2, Vec3 } from "./types";

type CanvasAnimationContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

class CanvasAnimation {
  private ctx: CanvasAnimationContext;
  private camera: Vec3 = { x: 0, y: 0, z: 1 };
  private canvas: Box;
  private viewport = { width: 0, height: 0 };
  private grid = { rows: 3, cols: 3 };
  private cell = { width: 0, height: 0 };
  private mouse: { previous: Vec2; current: Vec2 } | null = null;
  private velocity: Vec2 = { x: 0, y: 0 };
  private activeCell = { index: 0, col: 0, row: 0 };
  private hoveredCell = { index: 0, col: 0, row: 0 };

  private image: ImageBitmap | HTMLImageElement | null = null;

  private dpr: number;
  private framerate = 0;
  private prevTime = 0;

  private isOffscreen: boolean;
  private isPressed = false;

  private debugConfig = {
    show: true,
    pos: { x: 10, y: 10 },
    fontSize: 16,
  };

  constructor(
    ctx: CanvasAnimationContext,
    width: number,
    height: number,
    dpr: number
  ) {
    this.ctx = ctx;
    this.isOffscreen = this.ctx instanceof OffscreenCanvasRenderingContext2D;
    this.debugConfig.fontSize = this.isOffscreen ? 16 * dpr : 16;
    this.debugConfig.pos.x = this.isOffscreen ? 10 * dpr : 10;
    this.debugConfig.pos.y = this.debugConfig.fontSize;
    this.dpr = dpr;
    this.viewport = { height, width };
    this.cell = { width: width / 3, height: height / 3 };
    this.canvas = {
      minX: 0,
      minY: 0,
      maxX: width * this.grid.cols,
      maxY: height * this.grid.rows,
      width: width * this.grid.cols,
      height: height * this.grid.rows,
    };
  }

  private drawDebugPanel(timestamp: number) {
    // update the current framerate of the animation
    const dTime = timestamp - this.prevTime;
    const prevDec = (this.prevTime / 1000).toString().split(".")[1] ?? 0;
    const currDec = (timestamp / 1000).toString().split(".")[1] ?? 0;
    this.prevTime = timestamp;

    if (currDec < prevDec) {
      const nextFramerate = Math.floor(1000 / dTime);
      this.framerate = nextFramerate > 0 ? nextFramerate : 0;
    }

    // render debug panel
    const { show, fontSize, pos } = this.debugConfig;
    if (show) {
      const camera = this.getScaledCamera();
      const mouse = this.getScaledMouse();
      const viewport = this.getScaledViewport();
      this.ctx.font = `${fontSize}px sans-serif`;
      this.ctx.fillStyle = "black";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(`Offscreen: ${this.isOffscreen}`, pos.x, pos.y);
      this.ctx.fillText(`Framerate: ${this.framerate}`, pos.x, pos.y * 2.5);
      this.ctx.fillText(
        `Camera: ${camera.x.toFixed(2)}, ${camera.y.toFixed(2)}`,
        pos.x,
        pos.y * 4
      );
      this.ctx.fillText(
        `Viewport: ${viewport.minX.toFixed(1)}, ${viewport.minY.toFixed(
          1
        )}, ${viewport.maxX.toFixed(1)}, ${viewport.maxY.toFixed(1)}`,
        pos.x,
        pos.y * 5.5
      );
      this.ctx.fillText(
        `Mouse: ${mouse.x.toFixed(2)}, ${mouse.y.toFixed(2)}`,
        pos.x,
        pos.y * 7
      );
      this.ctx.fillText(
        `Velocity: ${this.velocity.x.toFixed(2)}, ${this.velocity.y.toFixed(
          2
        )}`,
        pos.x,
        pos.y * 8.5
      );
      this.ctx.fillText(`Is pressed: ${this.isPressed}`, pos.x, pos.y * 10);
      this.ctx.fillText(
        `Active Cell: ${this.activeCell.index}, ${this.activeCell.col}, ${this.activeCell.row}`,
        pos.x,
        pos.y * 11.5
      );
      this.ctx.fillText(
        `Hovered Cell: ${this.hoveredCell.index}, ${this.hoveredCell.col}, ${this.hoveredCell.row}`,
        pos.x,
        pos.y * 13
      );
    }
  }

  private animateVelocity() {
    if (this.isPressed) return;
    if (this.velocity.x === 0 && this.velocity.y === 0) return;

    if (Math.abs(this.velocity.x) < 0.1 && Math.abs(this.velocity.y) < 0.1) {
      this.velocity = { x: 0, y: 0 };
    } else {
      this.panCamera(this.velocity.x, this.velocity.y);
      this.velocity = {
        x: this.velocity.x * 0.9,
        y: this.velocity.y * 0.9,
      };
    }
  }

  private screenToCanvas(point: Vec2) {
    const camera = this.getScaledCamera();
    return {
      x: point.x / camera.z - camera.x,
      y: point.y / camera.z - camera.y,
    };
  }

  private getScaledCamera() {
    return {
      x: this.isOffscreen ? this.camera.x / this.dpr : this.camera.x,
      y: this.isOffscreen ? this.camera.y / this.dpr : this.camera.y,
      z: this.camera.z,
    };
  }

  private getScaledMouse() {
    const mouseX = this.mouse?.current.x || 0;
    const mouseY = this.mouse?.current.y || 0;
    return {
      x: this.isOffscreen ? mouseX / this.dpr : mouseX,
      y: this.isOffscreen ? mouseY / this.dpr : mouseY,
    };
  }

  private getScaledViewport(): Box {
    const camera = this.getScaledCamera();
    const width = this.isOffscreen
      ? this.viewport.width / this.dpr
      : this.viewport.width;
    const height = this.isOffscreen
      ? this.viewport.height / this.dpr
      : this.viewport.height;
    return {
      minX: -camera.x,
      minY: -camera.y,
      maxX: -camera.x + width,
      maxY: -camera.y + height,
      width,
      height,
    };
  }

  private panCamera(dx: number, dy: number) {
    this.camera = {
      x: this.camera.x - dx / this.camera.z,
      y: this.camera.y - dy / this.camera.z,
      z: this.camera.z,
    };
  }

  private getCellIndexFromPoint(x: number, y: number) {
    const rel = this.screenToCanvas({ x, y });
    const scale = this.isOffscreen ? this.dpr : 1;
    const col = Math.floor((rel.x / this.cell.width) * scale) % this.grid.cols;
    const row = Math.floor((rel.y / this.cell.height) * scale) % this.grid.rows;
    const nCol = col >= 0 ? col : this.grid.cols + col;
    const nRow = row >= 0 ? row : this.grid.rows + row;
    return {
      index: nCol + nRow * this.grid.cols,
      col: nCol,
      row: nRow,
    };
  }

  public render(timestamp: number) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.animateVelocity();

    this.ctx.save();
    this.ctx.translate(this.camera.x, this.camera.y);
    this.ctx.fillStyle = "lightcoral";
    this.ctx.lineWidth = this.isOffscreen ? this.dpr : 1;
    this.ctx.strokeStyle = "white";

    for (let i = 0; i < this.grid.cols * this.grid.rows; i++) {
      const rowIndex = i % this.grid.cols;
      const colIndex = Math.floor(i / this.grid.cols);
      const { width, height } = this.cell;
      this.ctx.beginPath();
      this.ctx.rect(rowIndex * width, colIndex * height, width, height);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.closePath();
    }

    if (this.image)
      this.ctx.drawImage(
        this.image,
        this.cell.width / 2 - this.image.width / 2,
        this.cell.height / 2 - this.image.height / 2
      );

    this.ctx.restore();

    this.drawDebugPanel(timestamp);
  }

  public onMove(x: number, y: number) {
    const scaledX = this.isOffscreen ? x * this.dpr : x;
    const scaledY = this.isOffscreen ? y * this.dpr : y;

    if (!this.mouse) {
      this.mouse = {
        previous: { x: scaledX, y: scaledY },
        current: { x: scaledX, y: scaledY },
      };
    } else {
      const { x: prevX, y: prevY } = this.mouse.current;
      this.mouse = {
        previous: { x: prevX, y: prevY },
        current: { x: scaledX, y: scaledY },
      };
    }

    if (this.isPressed) {
      this.velocity = {
        x: this.mouse.previous.x - this.mouse.current.x,
        y: this.mouse.previous.y - this.mouse.current.y,
      };
      this.panCamera(this.velocity.x, this.velocity.y);
    }

    this.hoveredCell = this.getCellIndexFromPoint(x, y);
  }

  public onPress(isPressed: boolean) {
    if (isPressed) this.velocity = { x: 0, y: 0 };
    this.isPressed = isPressed;
  }

  public onClick(x: number, y: number) {
    this.activeCell = this.getCellIndexFromPoint(x, y);
  }

  public onWheel(deltaX: number, deltaY: number) {
    this.panCamera(
      this.isOffscreen ? -deltaX : -deltaX / this.dpr,
      this.isOffscreen ? -deltaY : -deltaY / this.dpr
    );
  }

  public onResize(width: number, height: number) {
    this.cell = { width: width / 3, height: height / 3 };
    this.canvas = {
      ...this.canvas,
      maxX: this.cell.width * this.grid.cols,
      maxY: this.cell.height * this.grid.rows,
      width: this.cell.width * this.grid.cols,
      height: this.cell.height * this.grid.rows,
    };
    this.viewport = { width, height };
  }

  public onImageLoaded(bitmap: ImageBitmap | HTMLImageElement) {
    this.image = bitmap;
  }
}

export default CanvasAnimation;
