import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/seo/analyze", async (req, res) => {
  try {
   const response = await axios.post(
  process.env.AI_SERVICE_URL || "http://ai_seo_brain:8000/analyze", // <-- CORRECTED URL
  req.body,
  { timeout: 20000 }
);

    res.json(response.data);
  } catch (error: any) {
    console.error("AI Service Error:", error.message);
    res.status(500).json({ error: "AI SEO Service not reachable" });
  }
});

export default router;
