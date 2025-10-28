import React, { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, useScroll } from "framer-motion";
import Lottie from "lottie-react";
import aiBackground from "../assets/ai-animation.json";
import Login from "./auth/Login";
import Register from "./auth/Register";

const Dashboard: React.FC = () => {
  const [activeForm, setActiveForm] = useState<"login" | "register" | null>(null);
  const [activeService, setActiveService] = useState<number | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [15, -15]);
  const rotateY = useTransform(x, [-100, 100], [-15, 15]);

  const heroRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const authRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

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

  const { scrollYProgress } = useScroll({
    target: aboutRef,
    offset: ["start end", "end start"],
  });
  const aboutOpacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.3]);
  const aboutScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.95]);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-[#030014] via-[#080826] to-black text-white"
      style={{ fontFamily: "'Playfair Display', serif" }}
    >
      {/* 🧭 Navbar */}
      <header className="fixed top-0 right-0 w-full z-50 bg-transparent backdrop-blur-md py-4 px-10 flex justify-end">
        <nav className="flex space-x-8 text-lg font-medium">
          {[
            { name: "Home", ref: heroRef },
            { name: "About Us", ref: aboutRef },
            { name: "Services", ref: servicesRef },
          ].map((item, index) => (
            <button
              key={index}
              onClick={() => scrollTo(item.ref)}
              className="relative text-gray-300 hover:text-indigo-400 transition duration-300 group tracking-wide"
            >
              {item.name}
              <span className="absolute left-0 -bottom-1 w-0 h-[2px] bg-indigo-400 group-hover:w-full transition-all duration-300" />
            </button>
          ))}
        </nav>
      </header>

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
          className="w-[500px] h-[390px] md:w-[700px] md:h-[490px] opacity-25 md:opacity-30"
        />
      </motion.div>

      {/* 🏠 Hero */}
      <section
        ref={heroRef}
        className="relative h-screen flex flex-col items-center justify-center z-40 text-center space-y-6 px-4"
      >
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-5xl md:text-6xl font-bold leading-tight"
        >
          <span className="text-gray-100">Welcome to </span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-400">
            AI Agent
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 1 }}
          className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed"
        >
          Empower your SEO strategy with intelligent automation and real-time insights powered by AI.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 1 }}
        >
          <button
            onClick={() => scrollTo(authRef)}
            className="px-8 py-3 md:px-10 md:py-4 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-indigo-700 hover:to-purple-700 transition font-semibold shadow-lg shadow-indigo-800/40 text-lg"
          >
            Get Started
          </button>
        </motion.div>
      </section>

      {/* 🌟 About Section */}
      <section
        ref={aboutRef}
        className="relative min-h-[90vh] flex items-center justify-center z-40 px-6 py-24"
      >
        <motion.div
          style={{ opacity: aboutOpacity, scale: aboutScale }}
          className="w-full max-w-3xl rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-10 shadow-[0_0_40px_rgba(255,255,255,0.05)] hover:shadow-[0_0_50px_rgba(150,150,255,0.2)] transition-all text-center"
        >
          <h2 className="text-4xl md:text-5xl font-semibold mb-6 text-indigo-300">About Us</h2>
          <p className="text-gray-300 mb-4 leading-relaxed">
            We blend technology and intelligence to revolutionize how businesses handle SEO and automation.
            Our mission is to make your digital strategy smarter, faster, and more efficient through AI-driven innovation.
          </p>
          <p className="text-gray-300 leading-relaxed">
            Our AI SEO Agent automates keyword research, content optimization, and performance tracking — 
            empowering creators and brands to scale intelligently with precision and creativity.
          </p>
        </motion.div>
      </section>

      {/* 🚀 Auth Section */}
      <section
        ref={authRef}
        className="relative min-h-screen flex flex-col items-center justify-start z-40 px-6 pt-28 pb-16"
      >
        <div className="w-full max-w-3xl text-center">
          <h2 className="text-4xl font-semibold mb-3 text-indigo-300">
            Get Started with AI Agent
          </h2>

          <div className="flex justify-center gap-6 mb-4">
            <button
              onClick={() => setActiveForm("login")}
              className={`px-8 py-3 rounded-2xl border border-white/20 backdrop-blur-sm transition text-lg ${
                activeForm === "login"
                  ? "bg-indigo-600 text-white"
                  : "bg-white/10 hover:bg-indigo-600/30"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setActiveForm("register")}
              className={`px-8 py-3 rounded-2xl border border-white/20 backdrop-blur-sm transition text-lg ${
                activeForm === "register"
                  ? "bg-emerald-600 text-white"
                  : "bg-white/10 hover:bg-emerald-600/30"
              }`}
            >
              Register
            </button>
          </div>

          <div className="relative flex items-center justify-center h-[420px] overflow-hidden -mt-2">
            <motion.div
              key={activeForm}
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-full max-w-md">
                {activeForm === "login" && (
                  <Login
                    onSuccess={() => setActiveForm(null)}
                    onSwitchToRegister={() => setActiveForm("register")}
                  />
                )}
                {activeForm === "register" && (
                  <Register
                    onSuccess={() => setActiveForm("login")}
                    onSwitchToLogin={() => setActiveForm("login")}
                  />
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 💎 Services */}
      <section
        ref={servicesRef}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24 bg-gradient-to-br from-[#0b001a] to-[#13002b]"
      >
        <h2 className="text-4xl font-semibold mb-12 text-center text-indigo-300">
          Our Services
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl">
          {[
            {
              title: "AI SEO Optimization",
              desc: "Leverage AI to automatically research keywords, analyze backlinks, and optimize your SEO strategy for better visibility and traffic growth.",
              img: "https://cdn-icons-png.flaticon.com/512/9424/9424806.png",
            },
            {
              title: "Content Intelligence",
              desc: "Generate and refine SEO-optimized content powered by AI. Our model adapts to your brand tone and enhances readability, ranking, and engagement.",
              img: "https://cdn-icons-png.flaticon.com/512/11236/11236371.png",
            },
            {
              title: "Performance Analytics",
              desc: "Monitor real-time SEO data with AI dashboards — from ranking insights to competitor trends, all visualized in one intelligent interface.",
              img: "https://cdn-icons-png.flaticon.com/512/9692/9692062.png",
            },
          ].map((service, index) => (
            <div
              key={index}
              onMouseEnter={() => setActiveService(index)}
              onMouseLeave={() => setActiveService(null)}
              className={`cursor-pointer p-8 rounded-3xl border border-white/10 backdrop-blur-xl transition-all duration-500 shadow-md text-center ${
                activeService === index
                  ? "bg-gradient-to-r from-[#1b0f3a] to-[#30185b] scale-105 shadow-indigo-800/40"
                  : "bg-[rgba(255,255,255,0.05)] hover:bg-gradient-to-r hover:from-[#24124b]/60 hover:to-[#3a1b5f]/60 hover:scale-105"
              }`}
            >
              <img
                src={service.img}
                alt={service.title}
                className="w-24 h-24 mx-auto mb-4 rounded-lg object-contain opacity-90"
              />
              <h3 className="text-2xl font-semibold mb-3 text-white">
                {service.title}
              </h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                {service.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
