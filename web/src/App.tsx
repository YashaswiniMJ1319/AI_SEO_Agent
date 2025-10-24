import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
// --- Add .tsx extension to imports ---
import Register from "./pages/auth/Register.tsx";
import Login from "./pages/auth/Login.tsx";
import VSCodeLoginPage from "./pages/auth/VSCodeLoginPage.tsx"; // Also ensure this file exists
// ------------------------------------

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} /> {/* Or maybe a dashboard later */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        {/* --- Add this new route --- */}
        <Route path="/auth/vscode-login" element={<VSCodeLoginPage />} />
        {/* ------------------------- */}
        {/* Add other application routes here later */}
      </Routes>
    </Router>
  );
}

export default App;

