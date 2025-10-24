import React from 'react';
import { useLocation } from 'react-router-dom';
// --- Add .tsx extension to the import path ---
import Login from './Login.tsx'; // Import the existing Login component
// ---------------------------------------------

/**
 * A wrapper component for the login page specifically for the VS Code auth flow.
 * It extracts 'callback' and 'nonce' query parameters and passes them to the Login component.
 */
const VSCodeLoginPage: React.FC = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const callbackUri = queryParams.get('callback');
    const nonce = queryParams.get('nonce');

    console.log("VSCode Login Page - Callback:", callbackUri); // For debugging
    console.log("VSCode Login Page - Nonce:", nonce);       // For debugging

    // Render the standard Login component, passing the extracted parameters
    return <Login vscodeCallbackUri={callbackUri} vscodeNonce={nonce} />;
};

export default VSCodeLoginPage;

