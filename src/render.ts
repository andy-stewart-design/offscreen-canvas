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
