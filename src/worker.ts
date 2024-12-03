import OffscreenCanvasRenderer from "./offscreen-canvas";
import type { OffscreenCanvasMessageEvent } from "./types";

const renderer = new OffscreenCanvasRenderer();
self.onmessage = handleOffscreenCanvasMessage;

function handleOffscreenCanvasMessage({ data }: OffscreenCanvasMessageEvent) {
  if (data.type === "init") {
    renderer.init(data);
  } else if (data.type === "mouseMove") {
    renderer.onMouseMove(data);
  } else if (data.type === "pressStart" || data.type === "pressEnd") {
    renderer.onPress(data.isPressed, data.x, data.y);
  } else if (data.type === "click") {
    renderer.onClick({ x: data.x, y: data.y });
  } else if (data.type === "wheel") {
    renderer.onWheel(data.deltaX, data.deltaY);
  } else if (data.type === "resize") {
    renderer.resize(data.width, data.height);
  } else if (data.type === "image") {
    renderer.onImageLoaded(data.images);
  } else if (data.type === "activeIndexChange") {
    renderer.onActiveIndexChange(data.index);
  } else if (data.type === "focus") {
    renderer.onFocus(data.isFocused, data.focusIndex);
  }
}
