import HTMLCanvasRenderer from "./html-canvas";

const app = document.querySelector("#root");
if (!app) throw new Error("Could not find root element.");
const canvasRenderer = new HTMLCanvasRenderer(
  window.innerWidth,
  window.innerHeight
);

canvasRenderer.appendTo(app);

// canvasRenderer.isLoaded.subscribe((isLoaded) => {
//   console.log("The scene is loaded: ", isLoaded);
// });

// canvasRenderer.activeIndex.subscribe((index) => {
//   console.log("The active index is: ", index);
// });

// const button = document.querySelector("button");
// button?.addEventListener("click", () => {
//   canvasRenderer.setActiveIndex(null);
// });
