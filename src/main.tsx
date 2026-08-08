import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { initializeAnalytics } from "./analytics";
import "./styles.css";

initializeAnalytics();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing application root");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
