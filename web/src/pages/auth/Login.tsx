import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// --- Add .ts extension to the import path ---
import axiosClient from "../../api/axiosClient.ts";
// ---------------------------------------------

// --- Define props interface ---
interface LoginProps {
  vscodeCallbackUri?: string | null;
  vscodeNonce?: string | null;
}
// --------------------------

// --- Update component signature to accept props ---
const Login: React.FC<LoginProps> = ({ vscodeCallbackUri, vscodeNonce }) => {
// --------------------------------------------------
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Determine if this is the VS Code flow ---
  const isVSCodeFlow = !!(vscodeCallbackUri && vscodeNonce);
  // ---------------------------------------------
  const [showPassword, setShowPassword] = useState(false); // 👁️ toggle password visibility

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // --- Include callback and nonce if present ---
      const payload = {
        email,
        password,
        ...(isVSCodeFlow && { callback: vscodeCallbackUri, nonce: vscodeNonce }),
      };
      // ----------------------------------------------

      console.log("Sending login payload:", payload); // Debugging

      const res = await axiosClient.post("/auth/login", payload); // Send potentially modified payload

      console.log("✅ Login response:", res); // Log the full response for debugging redirects

      // --- Handle response differently based on flow ---
      if (isVSCodeFlow) {
        // If it's the VS Code flow, the backend *should* have sent a redirect.
        // The browser follows redirects automatically.
        // If the redirect worked, this code might not even execute fully,
        // or the browser might navigate away before the next lines.
        // We might not need explicit handling here if the backend redirect works.
        // However, if the backend fails to redirect and returns JSON instead:
        if (res.data?.token) { // Check if backend mistakenly returned JSON
             console.warn("VS Code flow: Backend returned JSON instead of redirect. Storing token locally (fallback).");
             localStorage.setItem("token", res.data.token); // Fallback storage
             // Attempt to manually trigger callback - THIS IS UNRELIABLE and generally indicates a backend issue.
             if (vscodeCallbackUri && res.data.token && vscodeNonce) {
                const fallbackCallback = new URL(vscodeCallbackUri);
                fallbackCallback.searchParams.set('token', res.data.token);
                fallbackCallback.searchParams.set('nonce', vscodeNonce);
                // window.location.href = fallbackCallback.toString(); // Very unlikely to work correctly
                setError("Login succeeded, but automatic return to VS Code failed. Please check your backend configuration.");
             }
        } else {
             // Handle unexpected JSON response without token during VS Code flow
             setError(res.data?.message || "Login succeeded but failed to return to VS Code.");
        }

      } else {
        // Standard web login flow
        console.log("Standard web flow: Login successful.");
        localStorage.setItem("token", res.data.token);
        // Use alert temporarily as per original code, replace with better UI later
        alert("Login successful!");
        navigate("/"); // Navigate to dashboard or home for standard web login
      }
      // ------------------------------------------------

    } catch (err: any) {
      console.error("❌ Login error:", err);
      // Display error message from backend response if available
      setError(err.response?.data?.message || "Invalid credentials or server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">
        {/* --- Add title specific to flow --- */}
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          {isVSCodeFlow ? "
          Login " : "Login"}
        
        </h2>
        {/* ---------------------------------- */}

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email Field */}
          <div>
            <label htmlFor="emailInput" className="block text-sm mb-1 font-medium text-gray-700">Email</label>
            <input
              id="emailInput"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out"
              required
              autoComplete="email"
            />
          </div>

          {/* Password Field with Show/Hide Toggle */}
          <div className="relative">
            <label htmlFor="passwordInput" className="block text-sm mb-1 font-medium text-gray-700">Password</label>
            <input
              id="passwordInput"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out"
              required
              autoComplete="current-password"
            />

            {/* 👁️ Toggle Button */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition transition duration-150 ease-in-out font-medium ${
              loading
                ? 'bg-indigo-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            }`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* --- Conditionally show Register link --- */}
        {!isVSCodeFlow && (
          <p className="text-center text-sm text-gray-600 mt-4">
            Don’t have an account?{" "}
            <Link to="/register" className="text-indigo-600 hover:text-indigo-500 font-medium">
              Register
            </Link>
          </p>
        )}
         {/* --- Add message for VS Code flow --- */}
         {isVSCodeFlow && (
            <p className="text-center text-sm text-gray-500 mt-4">
                You will be redirected back to VS Code after successful login.
            </p>
         )}
        {/* ------------------------------------- */}
      </div>
    </div>
  );
};

export default Login;

