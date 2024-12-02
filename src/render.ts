import { getGridDimensions } from "./utils/grid-dimensions";
import type { Box, GridItem, Vec2, Vec3 } from "./types";

type CanvasAnimationContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

class CanvasAnimation {
  private ctx: CanvasAnimationContext;
  private camera: Vec3 = { x: 0, y: 0, z: 1 };
  private canvas: Box;
  private viewport: Box;
  private grid: { cols: number; rows: number };
  private cell = { width: 0, height: 0, outerPadding: 0, innerPadding: 0 };
  private mouse: { previous: Vec2; current: Vec2 } | null = null;

  private pressStartPoint: Vec2 = { x: 0, y: 0 };
  private velocity: Vec2 = { x: 0, y: 0 };
  private activeCell = { index: 0, col: 0, row: 0 };
  private hoveredCell = { index: 0, col: 0, row: 0 };
  private images: Array<GridItem> | null = null;

  private framerate = 0;
  private prevTime = 0;

  private isOffscreen: boolean;
  private isPressed = false;

  private debugConfig = {
    show: true,
    pos: { x: 10, y: 16 },
    fontSize: 16,
  };

  constructor(
    ctx: CanvasAnimationContext,
    width: number,
    height: number,
    numItems: number
  ) {
    this.ctx = ctx;
    this.isOffscreen = this.ctx instanceof OffscreenCanvasRenderingContext2D;
    this.resize(width, height);
    const [cols, rows] = getGridDimensions(numItems);
    this.grid = { cols, rows };
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
    if (-this.camera.x < 0) this.camera.x = -this.canvas.width;
    else if (-this.camera.x > this.canvas.width) this.camera.x = 0;
    else this.camera.x = this.camera.x - dx / this.camera.z;

    if (-this.camera.y < 0) this.camera.y = -this.canvas.height;
    else if (-this.camera.y > this.canvas.height) this.camera.y = 0;
    else this.camera.y = this.camera.y - dy / this.camera.z;
    // this.camera = {
    //   x: this.camera.x - dx / this.camera.z,
    //   y: this.camera.y - dy / this.camera.z,
    //   z: this.camera.z,
    // };
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

  private resize(width: number, height: number) {
    if (!this.grid) return;
    this.viewport = {
      minX: -this.camera.x,
      minY: -this.camera.y,
      maxX: -this.camera.x + width,
      maxY: -this.camera.y + height,
      width: width,
      height: height,
    };
    const cellWidth = Math.max(
      this.viewport.width / 3.5,
      this.viewport.height / 3.5
    );
    this.cell = {
      width: cellWidth,
      height: (cellWidth / 4) * 5,
      outerPadding: cellWidth * 0.125,
      innerPadding: cellWidth * 0.25,
    };
    this.canvas = {
      minX: 0,
      minY: 0,
      maxX: this.cell.width * this.grid.cols,
      maxY: this.cell.height * this.grid.rows,
      width: this.cell.width * this.grid.cols,
      height: this.cell.height * this.grid.rows,
    };
  }

  private renderImage(
    image: ImageBitmap | HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const imgAspectRatio = image.width / image.height;
    const containerAspectRatio = width / height;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.width;
    let sourceHeight = image.height;

    if (imgAspectRatio > containerAspectRatio) {
      // Image is wider relative to container - crop horizontally
      sourceWidth = image.height * containerAspectRatio;
      sourceX = (image.width - sourceWidth) / 2;
    } else {
      // Image is taller relative to container - crop vertically
      sourceHeight = image.width / containerAspectRatio;
      sourceY = (image.height - sourceHeight) / 2;
    }

    this.ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x,
      y,
      width,
      height
    );
  }

  public render(timestamp: number) {
    if (!this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#FFF";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.animateVelocity();

    this.ctx.save();
    this.ctx.translate(this.camera.x, this.camera.y);

    for (let i = 0; i < this.grid.cols * this.grid.rows; i++) {
      const image = this.images?.[i];
      const rowIndex = i % this.grid.cols;
      const colIndex = Math.floor(i / this.grid.cols);
      const { width, height } = this.cell;

      //  MARK: Virtualize rendering ---------------------------------------------
      const cellMinX = this.camera.x + rowIndex * width;
      const cellMinY = this.camera.y + colIndex * height;
      const shiftX =
        cellMinX + width < 0
          ? this.canvas.width
          : cellMinX > this.viewport.width + this.cell.width
          ? -this.canvas.width
          : 0;
      const shiftY =
        cellMinY + height < 0
          ? this.canvas.height
          : cellMinY > this.viewport.height + this.cell.height
          ? -this.canvas.height
          : 0;

      const isVisibleX =
        shiftX + cellMinX + width < this.viewport.width + this.cell.width;
      const isVisibleY =
        shiftY + cellMinY + height < this.viewport.height + this.cell.height;

      if (!isVisibleX || !isVisibleY) continue;

      //  MARK: Render visible cells ---------------------------------------------
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.fillStyle = "#EFEFEF";
      this.ctx.roundRect(
        rowIndex * width + shiftX + this.cell.outerPadding,
        colIndex * height + shiftY + this.cell.outerPadding,
        this.cell.width - this.cell.outerPadding * 2,
        this.cell.height - this.cell.outerPadding * 2,
        24
      );
      if (!image || image.type === "product") this.ctx.fill();
      this.ctx.closePath();
      if (image) {
        if (image.type === "influencer") {
          this.ctx.clip();
          this.renderImage(
            image.element,
            rowIndex * width + shiftX + this.cell.outerPadding,
            colIndex * height + shiftY + this.cell.outerPadding,
            this.cell.width - this.cell.outerPadding * 2,
            this.cell.height - this.cell.outerPadding * 2
          );
        } else {
          const containerWidth = this.cell.width - this.cell.innerPadding * 2;
          const containerHeight =
            image.element.height * (containerWidth / image.element.width);
          const posY =
            colIndex * height +
            shiftY +
            (this.cell.height - containerHeight) / 2;

          this.ctx.beginPath();
          this.ctx.fillStyle = "#EFEFEF";
          this.ctx.roundRect(
            rowIndex * width + shiftX + this.cell.innerPadding,
            posY,
            containerWidth,
            containerHeight,
            8
          );
          this.ctx.closePath();
          this.ctx.clip();
          this.renderImage(
            image.element,
            rowIndex * width + shiftX + this.cell.innerPadding,
            posY,
            containerWidth,
            containerHeight
          );
        }
      }
      this.ctx.restore();

      if (this.debugConfig.show) {
        this.ctx.fillStyle = "rgb(0 0 0 / 0.5)";
        this.ctx.beginPath();
        this.ctx.ellipse(
          rowIndex * width + shiftX + this.cell.innerPadding,
          colIndex * height + shiftY + this.cell.innerPadding,
          20,
          20,
          0,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
        this.ctx.closePath();
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = "white";
        this.ctx.fillText(
          i.toString(),
          rowIndex * width + shiftX + this.cell.innerPadding,
          colIndex * height + shiftY + this.cell.innerPadding
        );
      }
    }

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
    this.resize(width, height);
  }

  public onImagesLoaded(images: Array<GridItem>) {
    this.images = images;
  }
}

export default CanvasAnimation;
