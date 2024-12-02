interface Vec2 {
  x: number;
  y: number;
}

interface Vec3 extends Vec2 {
  z: number;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

interface GridItemSource {
  type: "product" | "influencer";
  title: string;
  src: string;
}

type GridImage = ImageBitmap | HTMLImageElement;

interface GridItem {
  type: "product" | "influencer";
  title: string;
  element: GridImage;
}

export type { Vec2, Vec3, Box, GridImage, GridItem, GridItemSource };
