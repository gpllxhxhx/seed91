import "./style.css";
import { renderApp } from "./App";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("App root element was not found.");
}

root.innerHTML = renderApp();

