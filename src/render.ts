import type { Box, Vec2, Vec3 } from "./types";

type CanvasAnimationContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

class CanvasAnimation {
  private ctx: CanvasAnimationContext;
  private camera: Vec3 = { x: 0, y: 0, z: 1 };
  private canvas: Box;
  private viewport: Box;
  private grid = { rows: 6, cols: 6 };
  private cell = { width: 0, height: 0 };
  private mouse: { previous: Vec2; current: Vec2 } | null = null;

  private pressStartPoint: Vec2 = { x: 0, y: 0 };
  private velocity: Vec2 = { x: 0, y: 0 };
  private activeCell = { index: 0, col: 0, row: 0 };
  private hoveredCell = { index: 0, col: 0, row: 0 };
  private image: ImageBitmap | HTMLImageElement | null = null;

  private framerate = 0;
  private prevTime = 0;

  private isOffscreen: boolean;
  private isPressed = false;

  private debugConfig = {
    show: true,
    pos: { x: 10, y: 16 },
    fontSize: 16,
  };

  constructor(ctx: CanvasAnimationContext, width: number, height: number) {
    this.ctx = ctx;
    this.isOffscreen = this.ctx instanceof OffscreenCanvasRenderingContext2D;
    this.viewport = {
      minX: -this.camera.x,
      minY: -this.camera.y,
      maxX: -this.camera.x + width,
      maxY: -this.camera.y + height,
      width: width,
      height: height,
    };
    this.cell = {
      width: this.viewport.width / 3,
      height: this.viewport.height / 3,
    };
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
      this.ctx.save();
      this.ctx.font = `300 ${fontSize}px system-ui`;
      this.ctx.fillStyle = "rgb(0 0 0 / 0.75)";
      this.ctx.fillRect(0, 0, 312, 232);
      this.ctx.fillStyle = "#efefef";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(`Offscreen: ${this.isOffscreen}`, pos.x, pos.y);
      this.ctx.fillText(`Framerate: ${this.framerate}`, pos.x, pos.y * 2.5);
      this.ctx.fillText(
        `Camera: ${this.camera.x.toFixed(2)}, ${this.camera.y.toFixed(2)}`,
        pos.x,
        pos.y * 4
      );
      this.ctx.fillText(
        `Viewport: ${this.viewport.minX.toFixed(
          1
        )}, ${this.viewport.minY.toFixed(1)}, ${this.viewport.maxX.toFixed(
          1
        )}, ${this.viewport.maxY.toFixed(1)}`,
        pos.x,
        pos.y * 5.5
      );
      this.ctx.fillText(
        `Mouse: ${this.mouse?.current.x.toFixed(
          2
        )}, ${this.mouse?.current.y.toFixed(2)}`,
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
      this.ctx.restore;
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
    return {
      x: point.x / this.camera.z - this.camera.x,
      y: point.y / this.camera.z - this.camera.y,
    };
  }

  private panCamera(dx: number, dy: number) {
    this.camera = {
      x: this.camera.x - dx / this.camera.z,
      y: this.camera.y - dy / this.camera.z,
      z: this.camera.z,
    };
    this.viewport = {
      minX: -this.camera.x,
      minY: -this.camera.y,
      maxX: -this.camera.x + this.viewport.width,
      maxY: -this.camera.y + this.viewport.height,
      width: this.viewport.width,
      height: this.viewport.height,
    };
  }

  private getCellIndexFromPoint(x: number, y: number) {
    const canvasPoint = this.screenToCanvas({ x, y });
    const col = Math.floor(canvasPoint.x / this.cell.width) % this.grid.cols;
    const row = Math.floor(canvasPoint.y / this.cell.height) % this.grid.rows;
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

    for (let i = 0; i < this.grid.cols * this.grid.rows; i++) {
      const rowIndex = i % this.grid.cols;
      const colIndex = Math.floor(i / this.grid.cols);
      const { width, height } = this.cell;

      //  MARK: Virtualize rendering ---------------------------------------------
      const cellMinX = this.camera.x + rowIndex * width;
      const cellMinY = this.camera.y + colIndex * height;
      const cellMaxX = cellMinX + width;
      const cellMaxY = cellMinY + height;
      const isVisibleX = cellMaxX >= 0 && cellMinX <= this.viewport.width;
      const isVisibleY = cellMaxY >= 0 && cellMinY <= this.viewport.height;
      if (!isVisibleX || !isVisibleY) continue;

      this.ctx.fillStyle = "#1a1a1a";
      this.ctx.strokeStyle = "#3a3a3a";
      this.ctx.beginPath();
      this.ctx.rect(rowIndex * width, colIndex * height, width, height);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.closePath();

      this.ctx.textAlign = "center";
      this.ctx.fillStyle = "white";
      this.ctx.fillText(
        i.toString(),
        rowIndex * width + this.cell.width / 2,
        colIndex * height + this.cell.height / 2
      );
    }

    // if (this.image) {
    //   this.ctx.drawImage(
    //     this.image,
    //     this.cell.width / 2 - this.image.width / 2,
    //     this.cell.height / 2 - this.image.height / 2
    //   );
    // }

    this.ctx.restore();

    this.drawDebugPanel(timestamp);
  }

  public onMove(x: number, y: number) {
    if (!this.mouse) {
      this.mouse = {
        previous: { x, y },
        current: { x, y },
      };
    } else {
      const { x: prevX, y: prevY } = this.mouse.current;
      this.mouse = {
        previous: { x: prevX, y: prevY },
        current: { x, y },
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

  public onPress(
    isPressed: boolean,
    x: number | undefined = undefined,
    y: number | undefined = undefined
  ) {
    this.isPressed = isPressed;

    if (isPressed) {
      this.velocity = { x: 0, y: 0 };
      if (x !== undefined && y !== undefined) {
        this.pressStartPoint = { x, y };
      }
    } else if (x !== undefined && y !== undefined) {
      if (Math.abs(this.pressStartPoint.x - x) < 10) {
        this.velocity = { x: 0, y: 0 };
      }
    }
  }

  public onClick(x: number, y: number) {
    if (Math.abs(this.pressStartPoint.x - x) > 10) return;
    this.activeCell = this.getCellIndexFromPoint(x, y);
  }

  public onWheel(deltaX: number, deltaY: number) {
    this.panCamera(-deltaX, -deltaY);
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
    this.viewport = {
      minX: -this.camera.x,
      minY: -this.camera.y,
      maxX: -this.camera.x + width,
      maxY: -this.camera.y + height,
      width: width,
      height: height,
    };
  }

  public onImageLoaded(bitmap: ImageBitmap | HTMLImageElement) {
    this.image = bitmap;
  }
}

export default CanvasAnimation;
