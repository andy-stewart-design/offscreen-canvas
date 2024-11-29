type CanvasAnimationContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

class CanvasAnimation {
  private ctx: CanvasAnimationContext;
  private canvas: { width: number; height: number };
  private mouse = { x: 0, y: 0 };
  private radius = 80;
  private framerate = 0;
  private prevTime = 0;

  private isOffscreen: boolean;
  private isPressed = false;

  constructor(ctx: CanvasAnimationContext, width: number, height: number) {
    this.ctx = ctx;
    this.isOffscreen = this.ctx instanceof OffscreenCanvasRenderingContext2D;
    this.canvas = { width, height };
  }

  drawCircle(x: number, y: number, r: number, color = "blue") {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.closePath();
    this.ctx.restore();
  }

  render(timestamp: number) {
    // update the current framerate of the animation
    const dTime = timestamp - this.prevTime;
    const prevDec = (this.prevTime / 1000).toString().split(".")[1] ?? 0;
    const currDec = (timestamp / 1000).toString().split(".")[1] ?? 0;
    this.prevTime = timestamp;

    if (currDec < prevDec) {
      const nextFramerate = Math.floor(1000 / dTime);
      this.framerate = nextFramerate > 0 ? nextFramerate : 0;
    }

    // render shape
    this.radius = this.canvas.width / 8;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.isPressed) {
      this.drawCircle(this.mouse.x, this.mouse.y, this.radius);
    } else {
      this.drawCircle(
        this.canvas.width / 2,
        this.canvas.height / 2,
        this.radius
      );
    }

    // render debug text
    const fontSize =
      this.ctx instanceof OffscreenCanvasRenderingContext2D ? 32 : 16;
    const posX =
      this.ctx instanceof OffscreenCanvasRenderingContext2D ? 20 : 10;
    this.ctx.font = `${fontSize}px sans-serif`;
    this.ctx.fillStyle = "black";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(`Offscreen: ${this.isOffscreen}`, posX, fontSize);
    this.ctx.fillText(`Framerate: ${this.framerate}`, posX, fontSize * 2.5);
  }

  public setMouse(x: number, y: number) {
    this.mouse = { x, y };
  }

  public resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  public setPressed(isPressed: boolean) {
    this.isPressed = isPressed;
  }
}

export default CanvasAnimation;

let size = 80;
let angle = 0;
let radius = 40;
let increasing = true;
let framerate = 0;
let prevTime = 0;

const drawRect = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
) => {
  ctx.fillStyle = "blue";
  ctx.beginPath();
  ctx.roundRect(-size, -size, size * 2, size * 2, radius);
  ctx.fill();
};

export const render = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  x: number,
  y: number,
  isPressed: boolean,
  timestamp: number
) => {
  const dTime = timestamp - prevTime;
  const prevDec = (prevTime / 1000).toString().split(".")[1] ?? 0;
  const currDec = (timestamp / 1000).toString().split(".")[1] ?? 0;
  prevTime = timestamp;

  if (currDec < prevDec) {
    framerate = Math.floor(1000 / dTime) < 0 ? 0 : Math.floor(1000 / dTime);
  }

  size = width / 8;
  ctx.clearRect(0, 0, width, height);
  ctx.save();

  if (isPressed) ctx.translate(x, y);
  else ctx.translate(width / 2, height / 2);

  ctx.rotate(angle);
  drawRect(ctx);
  ctx.restore();
  angle += Math.PI / 90;
  radius = increasing ? radius + 1 : radius - 1;
  if (radius >= size) increasing = false;
  else if (radius <= 1) increasing = true;

  const isOffscreen = ctx instanceof OffscreenCanvasRenderingContext2D;
  const fontSize = ctx instanceof OffscreenCanvasRenderingContext2D ? 32 : 16;
  const posX = ctx instanceof OffscreenCanvasRenderingContext2D ? 20 : 10;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = "black";
  ctx.textBaseline = "middle";
  ctx.fillText(`Offscreen: ${isOffscreen}`, posX, fontSize);
  ctx.fillText(`Framerate: ${framerate}`, posX, fontSize * 2.5);
};
