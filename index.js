import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(cors()); // ✅ CORS OK

// ❌ DO NOT use express.json() globally

// --------------------
// Multer setup
// --------------------
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// --------------------
// Multer error handler (MUST be BEFORE routes)
// --------------------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("🔥 Multer error:", err.code);
    return res.status(400).json({
      error: "Upload error",
      details: err.code,
    });
  }
  next(err);
});

// --------------------
// Gemini client
// --------------------
const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// --------------------
// Health check
// --------------------
app.get("/", (req, res) => {
  res.send("Gemini backend running ✅");
});

// --------------------
// Gemini text test
// --------------------
app.get("/test-gemini", async (req, res) => {
  const result = await client.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [{ role: "user", parts: [{ text: "Say hello" }] }],
  });

  res.json({ output: result.text });
});

// --------------------
// IMAGE ANALYSIS (IMPORTANT)
// --------------------
app.post(
  "/analyze-image",
  upload.single("image"), // ✅ Multer FIRST
  async (req, res) => {
    try {
      console.log("📤 Image received:", {
        size: req.file.size / 1024 + " KB",
        type: req.file.mimetype,
      });

      const imageBuffer = fs.readFileSync(req.file.path);
      const base64Image = imageBuffer.toString("base64");

      const prompt =
        req.body.prompt || "Analyze this image";

      const result = await client.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: req.file.mimetype,
                  data: base64Image,
                },
              },
            ],
          },
        ],
      });

      fs.unlinkSync(req.file.path);

      res.json({ output: result.text });
    } catch (err) {
      console.error("🔥 Gemini error:", err);

      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        error: "Gemini processing failed",
        details: err.message,
      });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on ${PORT}`)
);

