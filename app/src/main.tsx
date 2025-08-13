import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { AppMode, CalimeroProvider } from "@calimero-network/calimero-client";

const APPLICATION_ID = "EHvEwjwXNLvTNhxBPY3SrSwACuccemCegykzwuNbLcdd";
const APPLICATION_PATH =
  "https://calimero-only-peers-dev.s3.amazonaws.com/uploads/5dee27032eaf84c5d6fe5e4e1e28e412.wasm";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <CalimeroProvider
        clientApplicationId={APPLICATION_ID}
        mode={AppMode.MultiContext}
        applicationPath={APPLICATION_PATH}
      >
        <App />
      </CalimeroProvider>
    </BrowserRouter>
  </StrictMode>
);
