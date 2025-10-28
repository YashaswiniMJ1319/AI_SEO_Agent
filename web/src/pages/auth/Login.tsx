// File: src/pages/auth/Login.tsx

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient.ts";
import { Eye, EyeOff } from "lucide-react";

interface LoginProps {
  vscodeCallbackUri?: string | null;
  vscodeNonce?: string | null;
}

const Login: React.FC<LoginProps> = ({ vscodeCallbackUri, vscodeNonce }) => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  const isVSCodeLogin = !!vscodeCallbackUri; // Detect VSCode login mode

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axiosClient.post("/login", formData);
      if (res.status === 200) {
        if (isVSCodeLogin) {
          window.location.href = `${vscodeCallbackUri}?nonce=${vscodeNonce}&token=${res.data.token}`;
        } else {
          navigate("/dashboard");
        }
      }
    } catch (err) {
      console.error("Login failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`relative z-10 flex flex-col justify-center items-center min-h-[400px] rounded-3xl p-8 w-full
        ${isVSCodeLogin
          ? "bg-transparent backdrop-blur-2xl border border-white/20 shadow-[0_0_25px_rgba(150,150,255,0.2)]"
          : "bg-white/10 backdrop-blur-xl border border-white/30 shadow-lg"
        }`}
    >
      <h2 className="text-2xl font-semibold mb-6 text-indigo-300">
        {isVSCodeLogin ? "Login to Continue" : "Welcome Back"}
      </h2>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
        <div>
          <label className="block text-gray-300 mb-2 text-sm">Username</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="relative">
          <label className="block text-gray-300 mb-2 text-sm">Password</label>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="button"
            className="absolute right-3 top-[38px] text-gray-400"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-4 bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      {!isVSCodeLogin && (
        <p className="text-gray-400 text-sm mt-4">
          Don’t have an account?{" "}
          <Link to="/register" className="text-indigo-400 hover:underline">
            Register
          </Link>
        </p>
      )}
    </div>
  );
};

export default Login;
