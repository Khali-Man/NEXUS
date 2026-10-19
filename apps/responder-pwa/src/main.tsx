import React from "react";
import { createRoot } from "react-dom/client";
import { ResponderApp } from "../../../packages/ui/src/responder";
import "../../../packages/ui/src/styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ResponderApp />
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  void navigator.serviceWorker.register("/sw.js");
