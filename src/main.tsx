import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// Sistema desativado temporariamente: todas as páginas mostram o aviso de migração.
// Para reativar o sistema completo, troque para `false`.
const SYSTEM_DISABLED = true;

const root = createRoot(document.getElementById("root")!);

if (SYSTEM_DISABLED) {
  import("./pages/SystemMoved").then(({ default: SystemMoved }) => {
    root.render(
      <React.StrictMode>
        <SystemMoved />
      </React.StrictMode>
    );
  });
} else {
  import("./App").then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
}
