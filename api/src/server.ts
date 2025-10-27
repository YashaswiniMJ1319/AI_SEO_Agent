import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import aiRoutes from "./routes/aiRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api", aiRoutes);

app.get("/api/health", (_, res) => res.json({ status: "ok", message: "Backend is running 🚀" }));

app.listen(4000, () => console.log("✅ Server running on http://localhost:4000"));
