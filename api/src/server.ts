import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import aiRoutes from "./routes/aiRoutes";

const app = express();


const corsOptions = {
  origin: [
    "http://localhost:5173",                 // Frontend (Vite dev)
    "vscode://yashaswinimj1319.ai-seo-agent-vscode", // VS Code extension
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());

// Parse URL-encoded bodies (for HTML form POST)
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api", aiRoutes);

app.get("/api/health", (_, res) =>
  res.json({ status: "ok", message: "Backend is running 🚀" })
);

app.listen(4000, () => console.log("✅ Server running on http://localhost:4000"));
