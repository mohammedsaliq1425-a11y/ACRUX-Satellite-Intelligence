import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { PreferencesProvider } from "./hooks/usePreferences";
import { SelectionProvider } from "./hooks/useSelection";
import { WorkspaceProvider } from "./hooks/useWorkspace";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <PreferencesProvider>
        <SelectionProvider>
          <WorkspaceProvider>
            <App />
          </WorkspaceProvider>
        </SelectionProvider>
      </PreferencesProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Remove the static boot screen once React has mounted.
document.getElementById("boot")?.remove();
