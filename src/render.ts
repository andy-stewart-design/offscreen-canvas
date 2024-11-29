import type { Box, Vec2, Vec3 } from "./types";

type CanvasAnimationContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

class CanvasAnimation {
  private ctx: CanvasAnimationContext;
  private camera: Vec3 = { x: 0, y: 0, z: 1 };
  private canvas: Box;
  private viewport: Box;
  private mouse: { previous: Vec2; current: Vec2 } | null = null;
  private velocity: Vec2 = { x: 0, y: 0 };
  private radius = 80;
  private framerate = 0;
  private prevTime = 0;

  private isOffscreen: boolean;
  private isPressed = false;

  private debugConfig = {
    show: true,
    pos: { x: 10, y: 10 },
    fontSize: 16,
  };

  constructor(ctx: CanvasAnimationContext, width: number, height: number) {
    this.ctx = ctx;
    this.isOffscreen = this.ctx instanceof OffscreenCanvasRenderingContext2D;
    this.debugConfig.fontSize = this.isOffscreen ? 32 : 16;
    this.debugConfig.pos.x = this.isOffscreen ? 20 : 10;
    this.debugConfig.pos.y = this.debugConfig.fontSize;
    this.canvas = {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height,
      width,
      height,
    };
    this.viewport = {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height,
      width,
      height,
    };
  }

  private drawCircle(x: number, y: number, r: number, color = "blue") {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.closePath();
    this.ctx.restore();
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
      this.ctx.font = `${fontSize}px sans-serif`;
      this.ctx.fillStyle = "black";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(`Offscreen: ${this.isOffscreen}`, pos.x, pos.y);
      this.ctx.fillText(`Framerate: ${this.framerate}`, pos.x, pos.y * 2.5);
      this.ctx.fillText(
        `Camera: ${this.camera.x.toFixed(2)}, ${this.camera.y.toFixed(2)}`,
        pos.x,
        pos.y * 4
      );
      this.ctx.fillText(
        `Mouse: ${(this.mouse?.current.x || 0).toFixed(2)}, ${(
          this.mouse?.current.y || 0
        ).toFixed(2)}`,
        pos.x,
        pos.y * 5.5
      );
      this.ctx.fillText(
        `Velocity: ${this.velocity.x.toFixed(2)}, ${this.velocity.y.toFixed(
          2
        )}`,
        pos.x,
        pos.y * 7
      );
      this.ctx.fillText(`Is pressed: ${this.isPressed}`, pos.x, pos.y * 8.5);
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

  public panCamera(dx: number, dy: number) {
    this.camera = {
      x: this.camera.x - dx / this.camera.z,
      y: this.camera.y - dy / this.camera.z,
      z: this.camera.z,
    };
  }

  public render(timestamp: number) {
    this.radius = this.canvas.width / 8;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.animateVelocity();

    this.ctx.save();
    this.ctx.translate(this.camera.x, this.camera.y);
    this.ctx.fillStyle = "lightblue";
    this.ctx.fillRect(
      this.canvas.minX,
      this.canvas.minY,
      this.canvas.width,
      this.canvas.height
    );
    this.drawCircle(this.canvas.width / 2, this.canvas.height / 2, this.radius);
    this.ctx.restore();

    this.drawDebugPanel(timestamp);
  }

  public set(key: "mouse", x: number, y: number): void;
  public set(key: "size", width: number, height: number): void;
  public set(key: "pressed", isPressed: boolean): void;
  public set(
    key: "mouse" | "size" | "pressed",
    ...values: [number, number] | [boolean]
  ): void {
    if (key === "mouse") {
      const [x, y] = values as [number, number];

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
      //   this.mouse = { x, y };
    } else if (key === "size") {
      const [width, height] = values as [number, number];
      this.canvas = {
        ...this.canvas,
        maxX: width,
        maxY: height,
        width,
        height,
      };
    } else if (key === "pressed") {
      const [isPressed] = values as [boolean];
      this.isPressed = isPressed;
    }
  }
}

export default CanvasAnimation;
