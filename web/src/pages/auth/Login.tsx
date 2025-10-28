// File: web/src/pages/auth/Login.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient.ts";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import Lottie from "lottie-react";
import aiBackground from "../../assets/ai-animation.json";

interface LoginProps {
  vscodeCallbackUri?: string | null;
  vscodeNonce?: string | null;
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

const Login: React.FC<LoginProps> = ({
  vscodeCallbackUri,
  vscodeNonce,
  onSuccess,
  onSwitchToRegister,
}) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isVSCodeFlow = !!(vscodeCallbackUri && vscodeNonce);

  // === Keep your exact logic ===
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
        setTimeout(() => form.submit(), 700);
        return;
      }

      const res = await axiosClient.post("/auth/login", payload);
      localStorage.setItem("token", res.data.token);
      alert("Login successful!");
      onSuccess?.();
      navigate("/");
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.response?.data?.message || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // === Framer-motion background setup ===
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [15, -15]);
  const rotateY = useTransform(x, [-100, 100], [-15, 15]);

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-[#030014] via-[#080826] to-black text-white">
      {/* 🌌 Animated Background */}
      <motion.div
        style={{ rotateX, rotateY }}
        className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none"
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      >
        <Lottie
          animationData={aiBackground}
          loop
          autoplay
          className="w-[600px] h-[500px] md:w-[800px] md:h-[600px] opacity-25 md:opacity-30"
        />
      </motion.div>

      {/* 🪩 Glassmorphic Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 w-[95%] max-w-md rounded-3xl bg-white/10 backdrop-blur-2xl p-10 border border-white/20 shadow-[0_0_40px_rgba(150,150,255,0.15)]"
      >
        <h3 className="text-2xl font-semibold mb-6 text-center text-indigo-300">
          {isVSCodeFlow ? "VS Code Authentication" : "Welcome Back"}
        </h3>

        {error && (
          <p className="text-sm text-center text-red-400 mb-4">{error}</p>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm mb-2 text-gray-300">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg bg-white/10 text-gray-100 border border-white/20 focus:border-indigo-400 outline-none placeholder-gray-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="relative">
            <label className="block text-sm mb-2 text-gray-300">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className="w-full px-4 py-3 pr-10 rounded-lg bg-white/10 text-gray-100 border border-white/20 focus:border-indigo-400 outline-none placeholder-gray-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-[42px] text-gray-400 hover:text-indigo-300"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 rounded-lg font-semibold flex items-center justify-center bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-900/30"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                {isVSCodeFlow ? "Redirecting..." : "Logging in..."}
              </>
            ) : (
              "Login"
            )}
          </button>

          {/* Redirecting Message */}
          {loading && isVSCodeFlow && (
            <div className="text-blue-400 text-center mt-4 animate-pulse">
              Redirecting to VS Code...
            </div>
          )}
        </form>

        {!isVSCodeFlow && (
          <p className="mt-6 text-center text-gray-300 text-sm">
            Don’t have an account?{" "}
            <button
              onClick={onSwitchToRegister}
              className="text-indigo-400 hover:underline hover:text-indigo-300 transition"
            >
              Register
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
