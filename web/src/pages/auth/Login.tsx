import React, { useState } from "react";
import axios from "axios";
import axiosClient from "../../api/axiosClient.ts";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

// 🌐 Environment-based API configuration
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

interface LoginProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
  vscodeCallbackUri?: string | null;
  vscodeNonce?: string | null;
}

const Login: React.FC<LoginProps> = ({
  onSuccess,
  onSwitchToRegister,
  vscodeCallbackUri,
  vscodeNonce,
}) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isVSCodeFlow = !!(vscodeCallbackUri && vscodeNonce);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const payload = {
        email,
        password,
        ...(isVSCodeFlow && {
          callback: vscodeCallbackUri,
          nonce: vscodeNonce,
        }),
      };

      // ✅ Dynamic API base — works both locally & inside Docker
      const response = isVSCodeFlow
        ? await axiosClient.post("/auth/login", payload)
        : await axios.post(`${API_BASE_URL}/auth/login`, payload);

      console.log("✅ Login Response:", response.data);

      if (isVSCodeFlow) {
        if (response.data?.token) {
          localStorage.setItem("token", response.data.token);
          setErrorMsg(
            "Login succeeded, but redirect to VS Code may have failed."
          );
        } else if (
          !response.request?.responseURL?.startsWith("vscode:")
        ) {
          setErrorMsg(
            response.data?.message ||
              "Login succeeded but failed to return to VS Code."
          );
        }
      } else {
        // ✅ Normal web login
        localStorage.setItem("token", response.data.token);
        onSuccess?.();
        alert("Login successful!");
        navigate("/");
      }
    } catch (err: any) {
      console.error("❌ Login failed:", err);
      setErrorMsg(
        err.response?.data?.message ||
          err.message ||
          "Invalid credentials or server error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`${
        isVSCodeFlow
          ? "min-h-screen flex items-center justify-center bg-gray-50 p-4"
          : "w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-lg shadow-indigo-900/30 px-8 py-10"
      }`}
    >
      <div
        className={`${
          isVSCodeFlow
            ? "bg-white shadow-xl rounded-2xl p-8 w-full max-w-md"
            : "w-full"
        }`}
      >
        <h3
          className={`text-3xl font-semibold mb-8 text-center ${
            isVSCodeFlow ? "text-gray-800" : "text-indigo-300"
          }`}
        >
          {isVSCodeFlow ? "Login via VS Code" : "Welcome Back"}
        </h3>

        {errorMsg && (
          <p
            className={`text-sm text-center mb-4 ${
              isVSCodeFlow ? "text-red-600" : "text-red-400"
            }`}
          >
            {errorMsg}
          </p>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email */}
          <div>
            <label
              className={`block text-sm mb-2 ${
                isVSCodeFlow ? "text-gray-700" : "text-gray-300"
              }`}
            >
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              className={`w-full px-4 py-3 rounded-lg border outline-none transition ${
                isVSCodeFlow
                  ? "border-gray-300 focus:ring-2 focus:ring-indigo-500"
                  : "bg-white/10 text-gray-100 border-white/20 focus:border-indigo-400 placeholder-gray-400"
              }`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="relative">
            <label
              className={`block text-sm mb-2 ${
                isVSCodeFlow ? "text-gray-700" : "text-gray-300"
              }`}
            >
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className={`w-full px-4 py-3 rounded-lg border outline-none pr-10 transition ${
                isVSCodeFlow
                  ? "border-gray-300 focus:ring-2 focus:ring-indigo-500"
                  : "bg-white/10 text-gray-100 border-white/20 focus:border-indigo-400 placeholder-gray-400"
              }`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className={`absolute right-3 top-[42px] ${
                isVSCodeFlow
                  ? "text-gray-500 hover:text-indigo-500"
                  : "text-gray-400 hover:text-indigo-300"
              }`}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 mt-4 rounded-lg font-semibold flex items-center justify-center transition ${
              isVSCodeFlow
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-900/30"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        {!isVSCodeFlow ? (
          <p className="mt-6 text-center text-gray-300 text-sm">
            Don’t have an account?{" "}
            <button
              onClick={onSwitchToRegister}
              className="text-indigo-400 hover:underline hover:text-indigo-300 transition"
            >
              Register
            </button>
          </p>
        ) : (
          <p className="text-center text-sm text-gray-500 mt-4">
            You will be redirected back to VS Code after successful login.
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
