import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { ProtectedRoutesWrapper } from "@calimero-network/calimero-client";

const APPLICATION_ID = "5VLU9d7DokArGns7Z6asyiCEqAjEJwNiHRVQxP9djmdN";
const APPLICATION_PATH =
  "https://calimero-only-peers-dev.s3.amazonaws.com/uploads/2d43628b3b8b279c8fff8b5649525a45.wasm";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ProtectedRoutesWrapper
        permissions={["context:execute", "application", "blob"]}
        applicationId={APPLICATION_ID}
        clientApplicationPath={APPLICATION_PATH}
      >
        <App />
      </ProtectedRoutesWrapper>
    </BrowserRouter>
  </StrictMode>
);
