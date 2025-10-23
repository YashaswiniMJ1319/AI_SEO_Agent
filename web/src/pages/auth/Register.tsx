import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { Eye, EyeOff } from "lucide-react";

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    general: "",
  });
  const [passwordStrength, setPasswordStrength] = useState({
    level: "",
    color: "",
    percent: 0,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRules, setShowPasswordRules] = useState(false);

  // 🔹 Password strength checker
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

  // 🔹 Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "phone" && !/^\d*$/.test(value)) return;

    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "", general: "" });

    if (name === "password") {
      setPasswordStrength(checkPasswordStrength(value));
    }
  };

  // 🔹 Validate form
  const validateForm = () => {
    const newErrors: any = {};
    const { fullName, email, phone, password } = formData;

    if (!fullName.trim()) newErrors.fullName = "Full name is required.";

    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email)) {
      newErrors.email = "Please enter a valid Gmail address.";
    }

    if (!/^\d{10}$/.test(phone)) {
      newErrors.phone = "Phone number must be exactly 10 digits.";
    }

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPassword.test(password)) {
      newErrors.password =
        "Password must be 8+ chars with uppercase, lowercase, number, and special character.";
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  // 🔹 Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({ ...errors, general: "" });

    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await axiosClient.post("/auth/register", formData);
      console.log("✅ Register response:", res.data);
      alert("Registration successful!");
      navigate("/login");
    } catch (err: any) {
      console.error("❌ Registration error:", err);
      setErrors({
        ...errors,
        general: err.response?.data?.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-50">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">Create Account</h2>

        {errors.general && (
          <div className="text-red-500 text-center mb-3">{errors.general}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Full Name"
              className="w-full border rounded-lg px-3 py-2"
            />
            {errors.fullName && (
              <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
              className="w-full border rounded-lg px-3 py-2"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Phone"
              maxLength={10}
              className="w-full border rounded-lg px-3 py-2"
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
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
              className="w-full border rounded-lg px-3 py-2 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>

            {/* Password strength bar */}
            {formData.password && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 h-2 rounded-full">
                  <div
                    className={`h-2 rounded-full ${passwordStrength.color}`}
                    style={{ width: `${passwordStrength.percent}%` }}
                  ></div>
                </div>
                <p
                  className={`text-sm mt-1 ${
                    passwordStrength.level === "Weak"
                      ? "text-red-500"
                      : passwordStrength.level === "Medium"
                      ? "text-yellow-600"
                      : "text-green-600"
                  }`}
                >
                  {passwordStrength.level} password
                </p>
              </div>
            )}

            {/* Password rule message */}
            {showPasswordRules && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-md p-2">
                <p className="font-medium text-gray-700 mb-1">
                  Password must contain:
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>At least 8 characters</li>
                  <li>One uppercase letter</li>
                  <li>One lowercase letter</li>
                  <li>One number</li>
                  <li>One special character (@$!%*?&)</li>
                </ul>
              </div>
            )}

            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <p className="text-center text-sm mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;

