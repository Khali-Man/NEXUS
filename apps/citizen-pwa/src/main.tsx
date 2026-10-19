import React from "react";
import { createRoot } from "react-dom/client";
import { CitizenApp } from "../../../packages/ui/src/citizen";
import "../../../packages/ui/src/styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CitizenApp />
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  void navigator.serviceWorker.register("/sw.js");
