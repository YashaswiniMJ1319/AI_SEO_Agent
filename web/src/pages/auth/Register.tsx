import React, { useState } from "react";
import axiosClient from "../../api/axiosClient";
import { Eye, EyeOff } from "lucide-react";

export interface RegisterProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

const Register: React.FC<RegisterProps> = ({ onSuccess, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ general: "", phone: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    level: "",
    color: "",
    percent: 0,
  });

  // ✅ Password strength checker
  const checkPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;

    if (strength <= 2)
      return { level: "Weak", color: "bg-red-500", percent: 33 };
    if (strength === 3)
      return { level: "Medium", color: "bg-yellow-500", percent: 66 };
    if (strength >= 4)
      return { level: "Strong", color: "bg-green-500", percent: 100 };
    return { level: "", color: "", percent: 0 };
  };

  // ✅ Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // 🔹 Restrict phone input to numbers only
    if (name === "phone") {
      if (!/^\d*$/.test(value)) return; // Block non-numeric input
      if (value.length > 10) {
        setErrors({ ...errors, phone: "Phone number cannot exceed 10 digits." });
        return;
      } else {
        setErrors({ ...errors, phone: "" });
      }
    }

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "password") {
      setPasswordStrength(checkPasswordStrength(value));
    }
  };

  // ✅ Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({ general: "", phone: "" });

    // 🔹 Phone number validation
    if (formData.phone.length !== 10) {
      setErrors({ ...errors, phone: "Phone number must be exactly 10 digits." });
      alert("⚠️ Phone number must be exactly 10 digits.");
      setLoading(false);
      return;
    }

    // 🔹 Password validation
    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPassword.test(formData.password)) {
      setErrors({
        ...errors,
        general:
          "Password must be at least 8 chars, include uppercase, lowercase, number & special char.",
      });
      setLoading(false);
      return;
    }

    try {
      const res = await axiosClient.post("/auth/register", formData);
      alert("🎉 Registration successful! Please log in.");
      onSuccess?.();
      onSwitchToLogin?.();
    } catch (error: any) {
      setErrors({
        ...errors,
        general:
          error.response?.data?.message || "Something went wrong. Try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-white">
      <h2 className="text-2xl font-bold text-center mb-6">Create Account</h2>

      {errors.general && (
        <div className="text-red-400 text-center mb-3">{errors.general}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <input
          type="text"
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          placeholder="Full Name"
          className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
        />

        {/* Email */}
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email (Gmail only)"
          className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
        />

        {/* Phone */}
        <div>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="Phone (10 digits)"
            className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
          />
          {errors.phone && (
            <p className="text-red-400 text-sm mt-1">{errors.phone}</p>
          )}
        </div>

        {/* Password */}
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleChange}
            onFocus={() => setShowPasswordRules(true)}
            onBlur={() => setShowPasswordRules(false)}
            placeholder="Password"
            className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>

          {/* Password Strength Bar */}
          {formData.password && (
            <div className="mt-2">
              <div className="w-full bg-white/10 h-2 rounded-full">
                <div
                  className={`h-2 rounded-full ${passwordStrength.color} transition-all duration-500`}
                  style={{ width: `${passwordStrength.percent}%` }}
                ></div>
              </div>
              <p
                className={`text-sm mt-1 ${
                  passwordStrength.level === "Weak"
                    ? "text-red-400"
                    : passwordStrength.level === "Medium"
                    ? "text-yellow-400"
                    : "text-green-400"
                }`}
              >
                {passwordStrength.level} password
              </p>
            </div>
          )}

          {/* Password Rules */}
          {showPasswordRules && (
            <div className="mt-2 text-xs text-gray-300 bg-white/10 border border-white/20 rounded-md p-2">
              <p className="font-medium text-gray-200 mb-1">
                Password must contain:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-400">
                <li>At least 8 characters</li>
                <li>One uppercase letter</li>
                <li>One lowercase letter</li>
                <li>One number</li>
                <li>One special character (@$!%*?&)</li>
              </ul>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-all shadow-lg hover:shadow-blue-500/50"
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      {/* Switch to Login */}
      <p className="text-center text-sm mt-4 text-gray-300">
        Already have an account?{" "}
        <button
          onClick={onSwitchToLogin}
          className="text-indigo-400 hover:underline"
        >
          Login
        </button>
      </p>
    </div>
  );
};

export default Register;
