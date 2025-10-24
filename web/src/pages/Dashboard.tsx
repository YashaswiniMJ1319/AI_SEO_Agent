import React from "react";
import { useNavigate } from "react-router-dom";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-indigo-900 via-gray-900 to-black text-white relative overflow-hidden">
      {/* 🌟 Top-left corner buttons */}
      <div className="absolute top-6 left-6 flex gap-4">
        <button
          onClick={() => navigate("/login")}
          className="px-5 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition font-semibold shadow-md"
        >
          Login
        </button>

        <button
          onClick={() => navigate("/register")}
          className="px-5 py-2 bg-emerald-600 rounded-lg hover:bg-emerald-700 transition font-semibold shadow-md"
        >
          Register
        </button>
      </div>

      {/* ✨ Center Content */}
      <div className="text-center px-6">
        <h1 className="text-5xl font-extrabold mb-4">
          Welcome to <span className="text-indigo-400">AI Agent</span>
        </h1>
        <p className="text-lg text-gray-300 max-w-xl mx-auto">
          Your intelligent SEO optimization companion powered by AI.
        </p>

        <button
          onClick={() => alert("🚀 Starting AI Assistant...")}
          className="mt-8 px-6 py-3 bg-purple-600 rounded-lg hover:bg-purple-700 transition font-semibold shadow-lg"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
