import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, useMotionValue, useTransform } from "framer-motion";
import Lottie from "lottie-react";
import aiBackground from "../../assets/ai-animation.json"; // same as dashboard
import Login from "./Login.tsx";

const VSCodeLoginPage: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const callbackUri = queryParams.get("callback");
  const nonce = queryParams.get("nonce");

  console.log("VSCode Login Page - Callback:", callbackUri);
  console.log("VSCode Login Page - Nonce:", nonce);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [15, -15]);
  const rotateY = useTransform(x, [-100, 100], [-15, 15]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const offsetX = (e.clientX - innerWidth / 2) / 30;
      const offsetY = (e.clientY - innerHeight / 2) / 30;
      x.set(offsetX);
      y.set(offsetY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [x, y]);

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-[#030014] via-[#080826] to-black text-white">
      {/* 🌌 Animated AI Background */}
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

      {/* 🪩 Glassmorphic Login Container */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 w-[95%] max-w-md rounded-3xl bg-white/10 backdrop-blur-2xl p-10 border border-white/20 shadow-[0_0_40px_rgba(150,150,255,0.15)]"
      >
        <h2 className="text-2xl font-semibold mb-4 text-center text-indigo-300">
          VS Code Authentication
        </h2>
        <p className="text-sm text-gray-400 mb-6 text-center">
          Redirecting to VS Code after login...
        </p>

        {/* 👇 Use your same Login component with VSCode props */}
        <Login vscodeCallbackUri={callbackUri ?? undefined} vscodeNonce={nonce ?? undefined} />
      </motion.div>
    </div>
  );
};

export default VSCodeLoginPage;
