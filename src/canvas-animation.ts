import ObservableValue from "./observable";
import { easeOutCubic, easeOutQuart, lerp } from "./utils/easings";
import type { Box, GridItem, Vec2, Vec3 } from "./types";

type CanvasAnimationContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

interface StyledGridItem extends GridItem {
  opacity: number;
  scale: number;
}

const DEFAULT_BOX: Box = {
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0,
  width: 0,
  height: 0,
};

class CanvasAnimation {
  private ctx: CanvasAnimationContext;
  private camera: Vec3 = { x: 0, y: 0, z: 1 };
  private canvas = DEFAULT_BOX;
  private viewport = DEFAULT_BOX;
  private grid: { cols: number; rows: number };
  private cell = { width: 0, height: 0, outerPadding: 0, innerPadding: 0 };
  private mouse: { previous: Vec2; current: Vec2 } | null = null;
  private images: Array<StyledGridItem> | null = null;

  private pressStartPoint: Vec2 = { x: 0, y: 0 };
  private velocity: Vec2 = { x: 0, y: 0 };
  private hasResized = false;
  private isFocused = false;
  private focusedIndex = 0;
  public activeIndex = new ObservableValue<number | null>(null);
  public hoveredIndex = new ObservableValue<number | null>(null);

  private framerate = 0;
  private prevTime = 0;

  private isOffscreen: boolean;
  private isPressed = false;

  private debugConfig = {
    show: true,
    offset: 12,
    fontSize: 13,
  };

  constructor(
    ctx: CanvasAnimationContext,
    width: number,
    height: number,
    cols: number,
    rows: number
  ) {
    this.ctx = ctx;
    this.isOffscreen = this.ctx instanceof OffscreenCanvasRenderingContext2D;
    this.resize(width, height);
    this.grid = { cols, rows };
  }

  private drawDebugPanel(timestamp: number) {
    // render debug panel
    const { show, fontSize, offset } = this.debugConfig;
    if (show) {
      // update the current framerate of the animation
      const dTime = timestamp - this.prevTime;
      const prevDec = (this.prevTime / 1000).toString().split(".")[1] ?? 0;
      const currDec = (timestamp / 1000).toString().split(".")[1] ?? 0;
      this.prevTime = timestamp;

      if (currDec < prevDec) {
        const nextFramerate = Math.floor(1000 / dTime);
        this.framerate = nextFramerate > 0 ? nextFramerate : 0;
      }

      this.ctx.save();
      this.ctx.font = `300 ${fontSize}px monospace`;
      this.ctx.fillStyle = "rgb(0 0 0 / 0.6)";
      this.ctx.strokeStyle = "rgb(255 255 255 / 0.15)";
      const vpText = `Viewport: ${this.viewport.minX.toFixed(
        1
      )}, ${this.viewport.minY.toFixed(1)}, ${this.viewport.maxX.toFixed(
        1
      )}, ${this.viewport.maxY.toFixed(1)}`;
      const { width: w } = this.ctx.measureText(vpText);
      this.ctx.beginPath();
      this.ctx.roundRect(
        offset,
        offset,
        w + offset + fontSize * 1.25,
        offset + fontSize * 14,
        8
      );
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.closePath();
      this.ctx.fillStyle = "#efefef";
      this.ctx.textBaseline = "middle";

      const posX = offset + fontSize;
      const posY = (n = 1) => offset * 1.625 + fontSize * n;
      this.ctx.fillText(`Offscreen: ${this.isOffscreen}`, posX, posY(1));
      this.ctx.fillText(`Framerate: ${this.framerate}`, posX, posY(2.5));
      this.ctx.fillText(
        `Camera: ${this.camera.x.toFixed(2)}, ${this.camera.y.toFixed(2)}`,
        posX,
        posY(4)
      );
      this.ctx.fillText(vpText, posX, posY(5.5));
      this.ctx.fillText(
        `Mouse: ${this.mouse?.current.x.toFixed(
          2
        )}, ${this.mouse?.current.y.toFixed(2)}`,
        posX,
        posY(7)
      );
      this.ctx.fillText(
        `Velocity: ${this.velocity.x.toFixed(2)}, ${this.velocity.y.toFixed(
          2
        )}`,
        posX,
        posY(8.5)
      );
      this.ctx.fillText(`Is pressed: ${this.isPressed}`, posX, posY(10));
      this.ctx.fillText(
        `Active Cell: ${this.activeIndex.value}`,
        posX,
        posY(11.5)
      );
      this.ctx.fillText(
        `Hovered Cell: ${this.hoveredIndex.value}`,
        posX,
        posY(13)
      );
      this.ctx.restore();
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
      x: (point.x / this.camera.z - this.camera.x) % this.canvas.width,
      y: (point.y / this.camera.z - this.camera.y) % this.canvas.height,
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

  private virtualizeCell(i: number) {
    const { width, height } = this.cell;
    const colIndex = i % this.grid.cols;
    const rowIndex = Math.floor(i / this.grid.cols);

    const cellMinX = this.camera.x + colIndex * width;
    const cellMinY = this.camera.y + rowIndex * height;
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

    return {
      isVisible: isVisibleX && isVisibleY,
      shiftX,
      shiftY,
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
    if (!this.hasResized) {
      this.hasResized = true;
      this.centerCell(this.focusedIndex);
    }
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

  private renderFocusOutline(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    this.ctx.save();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = "#275dc5";
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
    this.ctx.stroke();
    this.ctx.closePath();
    this.ctx.restore();
  }

  private renderCell(
    image: StyledGridItem | undefined,
    i: number,
    shiftX: number,
    shiftY: number
  ) {
    const colIndex = i % this.grid.cols;
    const rowIndex = Math.floor(i / this.grid.cols);
    const cellX = colIndex * this.cell.width + shiftX;
    const cellY = rowIndex * this.cell.height + shiftY;
    const outerW =
      (this.cell.width - this.cell.outerPadding * 2) * (image?.scale ?? 1);
    const outerH =
      (this.cell.height - this.cell.outerPadding * 2) * (image?.scale ?? 1);
    const outerX = cellX + (this.cell.width - outerW) / 2;
    const outerY = cellY + (this.cell.height - outerH) / 2;

    if (this.isFocused && i === this.focusedIndex) {
      this.renderFocusOutline(
        outerX - 4,
        outerY - 4,
        outerW + 4 * 2,
        outerH + 4 * 2,
        24 + 4
      );
    }

    this.ctx.globalAlpha = image?.opacity ?? 1;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.fillStyle = "#F7F7F7";
    this.ctx.roundRect(outerX, outerY, outerW, outerH, 24);
    if (!image || image.type === "product") this.ctx.fill();
    this.ctx.closePath();

    if (image) {
      if (image.type === "influencer") {
        this.ctx.clip();
        this.renderImage(image.element, outerX, outerY, outerW, outerH);
      } else {
        this.ctx.save();
        const imgAspectRatio = image.element.height / image.element.width;
        const maxAspectRatio = (outerH * 1.25) / outerW;
        const finalAspectRatio = Math.min(imgAspectRatio, maxAspectRatio);
        const innerW =
          outerW - (this.cell.innerPadding - this.cell.outerPadding) * 2;
        const innerH = innerW * finalAspectRatio;
        const innerX = outerX + this.cell.innerPadding - this.cell.outerPadding;
        const innerY = outerY + (outerH - innerH) / 2;

        this.ctx.beginPath();
        this.ctx.fillStyle = "#EFEFEF";
        this.ctx.roundRect(innerX, innerY, innerW, innerH, 8);
        this.ctx.closePath();
        this.ctx.clip();
        this.renderImage(image.element, innerX, innerY, innerW, innerH);
        this.ctx.restore();
      }

      const titleOpacity = Number(((1 - image.opacity) * 2).toFixed(2));

      if (titleOpacity > 0.05) {
        this.ctx.font = `${12 * image.scale}px Market Sans`;
        const maxLetters = Math.floor(
          (outerW - 48) / this.ctx.measureText("0").width
        );
        const title =
          image.title.length > maxLetters
            ? `${image.title.slice(0, maxLetters).trim()}…`
            : image.title;
        const { width } = this.ctx.measureText(title);
        this.ctx.globalAlpha = Number(titleOpacity);
        this.ctx.fillStyle = "#FFF";
        this.ctx.beginPath();
        this.ctx.shadowColor =
          image.type === "product" ? "rgb(0 0 0 / 0.05)" : "rgb(0 0 0 / 0.25)";
        this.ctx.shadowBlur = 24;
        this.ctx.shadowOffsetY = 10;
        this.ctx.roundRect(
          outerX + (outerW - width - 40) / 2,
          outerY + outerH - 60,
          width + 40,
          36,
          20
        );
        this.ctx.fill();
        this.ctx.closePath();
        this.ctx.shadowColor = "transparent";
        this.ctx.shadowOffsetY = 0;
        this.ctx.fillStyle = "#8f8f8f";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(title, outerX + outerW / 2, outerY + outerH - 41);
      }

      if (this.debugConfig.show || this.isFocused) {
        this.ctx.globalAlpha = 1;
        this.ctx.fillStyle = this.isFocused ? "#275dc5" : "rgb(0 0 0 / 0.5)";
        this.ctx.beginPath();
        this.ctx.ellipse(outerX + 32, outerY + 32, 16, 16, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.closePath();
        this.ctx.font = `300 13px system-ui`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = "white";
        this.ctx.fillText(i.toString(), outerX + 32, outerY + 32.25);
      }
    }
    this.ctx.restore();
  }

  private setImageStyles(img: StyledGridItem, i: number) {
    if (this.hoveredIndex !== null && i === this.hoveredIndex.value) {
      img.opacity = lerp(img.opacity, 0.5, easeOutCubic(0.1));
      img.scale = lerp(img.scale, 1.1, easeOutQuart(0.1));
    } else if (this.isFocused && i === this.focusedIndex) {
      img.opacity = lerp(img.opacity, 0.5, easeOutCubic(0.1));
      img.scale = lerp(img.scale, 1.1, easeOutQuart(0.1));
    } else {
      if (img.opacity === 1 && img.scale === 1) return;
      img.opacity = lerp(img.opacity, 1.0, easeOutCubic(0.1));
      img.scale = lerp(img.scale, 1.0, easeOutQuart(0.1));
    }
  }

  public centerCell(absIndex: number): void {
    if (!this.canvas || !this.viewport) return;
    const colIndex = absIndex % this.grid.cols;
    const rowIndex = Math.floor(absIndex / this.grid.cols);

    const posX =
      this.canvas.width -
      this.viewport.width / 2 +
      (this.cell.width * (colIndex + 1) - this.cell.width / 2);

    const posY =
      this.canvas.height -
      this.viewport.height / 2 +
      (this.cell.height * (rowIndex + 1) - this.cell.height / 2);

    this.camera = {
      x: -posX % this.canvas.width,
      y: -posY % this.canvas.height,
      z: 1,
    };
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
      if (image) this.setImageStyles(image, i);

      const { isVisible, shiftX, shiftY } = this.virtualizeCell(i);
      if (isVisible) {
        this.renderCell(image, i, shiftX, shiftY);
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

      if (
        Math.abs(this.pressStartPoint.x - x) > 20 ||
        Math.abs(this.pressStartPoint.y - y) > 20
      ) {
        this.setActiveIndex(null);
      }
    }

    const hoveredCell = this.getCellIndexFromPoint(x, y);
    const canvasMousePoint = this.screenToCanvas({ x, y });
    const posX = hoveredCell.col * this.cell.width;
    const posY = hoveredCell.row * this.cell.height;
    const isHoveredX =
      canvasMousePoint.x > posX + this.cell.outerPadding &&
      canvasMousePoint.x < posX + (this.cell.width - this.cell.outerPadding);
    const isHoveredY =
      canvasMousePoint.y > posY + this.cell.outerPadding &&
      canvasMousePoint.y < posY + (this.cell.height - this.cell.outerPadding);

    if (isHoveredX && isHoveredY) this.hoveredIndex.value = hoveredCell.index;
    else if (this.hoveredIndex.value !== null) this.hoveredIndex.value = null;
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
    if (
      Math.abs(this.pressStartPoint.x - x) > 10 ||
      Math.abs(this.pressStartPoint.y - y) > 10
    ) {
      return;
    }

    const hoveredCell = this.getCellIndexFromPoint(x, y);
    const canvasMousePoint = this.screenToCanvas({ x, y });
    const posX = hoveredCell.col * this.cell.width;
    const posY = hoveredCell.row * this.cell.height;
    const isHoveredX =
      canvasMousePoint.x > posX + this.cell.outerPadding &&
      canvasMousePoint.x < posX + (this.cell.width - this.cell.outerPadding);
    const isHoveredY =
      canvasMousePoint.y > posY + this.cell.outerPadding &&
      canvasMousePoint.y < posY + (this.cell.height - this.cell.outerPadding);

    if (isHoveredX && isHoveredY) this.setActiveIndex(hoveredCell.index);
    else this.setActiveIndex(null);
  }

  public onFocus(isFocused: boolean, focusIndex: number) {
    this.isFocused = isFocused;
    this.focusedIndex = focusIndex;

    if (isFocused) this.centerCell(focusIndex);
  }

  public onWheel(deltaX: number, deltaY: number) {
    this.panCamera(-deltaX, -deltaY);
  }

  public onResize(width: number, height: number) {
    this.resize(width, height);
  }

  public onImagesLoaded(images: Array<GridItem>) {
    this.images = images.map((img) => ({
      ...img,
      opacity: 1,
      scale: 1,
    }));
  }

  public setActiveIndex(nextIndex: number | null) {
    this.activeIndex.value = nextIndex;
  }
}

export default CanvasAnimation;
