import React from "react";
import { useLocation } from "react-router-dom";
import Login from "./Login.tsx";

/**
 * VSCodeLoginPage
 * - Extracts callback + nonce from VS Code extension query params.
 * - Renders your existing Login component with same background + styling.
 * - Avoids nested full-screen layouts (so design looks identical to normal login).
 */
const VSCodeLoginPage: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const callbackUri = queryParams.get("callback");
  const nonce = queryParams.get("nonce");

  console.log("VSCode Login Page - Callback:", callbackUri);
  console.log("VSCode Login Page - Nonce:", nonce);

  return (
    // Keep layout simple — Login.tsx handles full-screen + background
    <div className="w-full h-full">
      <Login
        vscodeCallbackUri={callbackUri ?? undefined}
        vscodeNonce={nonce ?? undefined}
      />
    </div>
  );
};

export default VSCodeLoginPage;
