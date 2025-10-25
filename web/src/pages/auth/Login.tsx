// File: web/src/pages/auth/Login.tsx

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient.ts";
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  vscodeCallbackUri?: string | null;
  vscodeNonce?: string | null;
}

const Login: React.FC<LoginProps> = ({ vscodeCallbackUri, vscodeNonce }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isVSCodeFlow = !!(vscodeCallbackUri && vscodeNonce);
  const [showPassword, setShowPassword] = useState(false);
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    const payload = {
      email,
      password,
      ...(isVSCodeFlow && { callback: vscodeCallbackUri, nonce: vscodeNonce }),
    };

    console.log("Sending login payload:", payload);

    if (isVSCodeFlow) {
      // Submit via real form so 302->vscode:// redirect works
      const form = document.createElement("form");
      form.method = "POST";
      form.action = `${axiosClient.defaults.baseURL}/auth/login`;

      Object.entries(payload).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value as string;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      return; // stop here, browser will handle redirect
    }

    // Standard web login flow
    const res = await axiosClient.post("/auth/login", payload);
    console.log("✅ Login response:", res);
    localStorage.setItem("token", res.data.token);
    alert("Login successful!");
    navigate("/");
  } catch (err: any) {
    console.error("❌ Login error:", err);
    setError(err.response?.data?.message || err.message || "Login failed");
  } finally {
    setLoading(false);
  }
};


  // ... (rest of the component JSX remains the same) ...

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          {isVSCodeFlow ? "Login via VS Code" : "Login"}
        </h2>
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
          {/* Password Field */}
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
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-7 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md p-1"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-2 px-4 rounded-lg transition duration-150 ease-in-out font-medium ${
              loading
                ? 'bg-indigo-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            }`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        {!isVSCodeFlow && (
          <p className="text-center text-sm text-gray-600 mt-4">
            Don’t have an account?{" "}
            <Link to="/register" className="text-indigo-600 hover:text-indigo-500 font-medium">
              Register
            </Link>
          </p>
        )}
         {isVSCodeFlow && (
            <p className="text-center text-sm text-gray-500 mt-4">
                You will be redirected back to VS Code after successful login.
            </p>
         )}
      </div>
    </div>
  );
};

export default Login;