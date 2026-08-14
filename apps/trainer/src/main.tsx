import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CardInspectorProvider } from "./CardInspector";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <CardInspectorProvider>
      <App />
    </CardInspectorProvider>
  </React.StrictMode>,
);
