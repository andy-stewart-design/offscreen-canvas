import HTMLCanvasRenderer from "./html-canvas";
import "./main.css";

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

const button = document.querySelector("button");
button!.textContent = "Pause";
button?.addEventListener("click", () => {
  if (canvasRenderer.isPaused) {
    canvasRenderer.play();
    button.textContent = "Pause";
  } else {
    canvasRenderer.pause();
    button.textContent = "Play";
  }
});
