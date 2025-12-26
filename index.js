import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

// --------------------
// Load env variables
// --------------------
dotenv.config();

// --------------------
// App setup
// --------------------
const app = express();
app.use(cors());
app.use(express.json());

// --------------------
// Multer setup
// --------------------
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
});

// --------------------
// Gemini client (CORRECT)
// --------------------
const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// --------------------
// Health check
// --------------------
app.get("/", (req, res) => {
  res.send("✅ Gemini backend is running");
});

// --------------------
// Gemini text test (FIXED)
// --------------------
app.get("/test-gemini", async (req, res) => {
  try {
    const result = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: "Say 'Gemini API is working' in one sentence." }],
        },
      ],
    });

    res.json({
      success: true,
      output: result.text,
    });
  } catch (error) {
    console.error("Gemini test error:", error);
    res.status(500).json({
      success: false,
      error: "Gemini API test failed",
    });
  }
});

// --------------------
// Image analysis endpoint (FIXED)
// --------------------
app.post(
  "/analyze-image",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Image is required" });
      }

      const prompt =
        req.body.prompt || "Analyze this image and explain what you see";

      // Read image
      const imageBuffer = fs.readFileSync(req.file.path);
      const base64Image = imageBuffer.toString("base64");

      // Gemini Vision call (CORRECT FORMAT)
      const result = await client.models.generateContent({
        model: "gemini-2.0-flash",
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

      // Cleanup
      fs.unlinkSync(req.file.path);

      res.json({
        output: result.text,
      });
    } catch (error) {
      console.error("Gemini image error:", error);

      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        error: "Image analysis failed",
      });
    }
  }
);

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
