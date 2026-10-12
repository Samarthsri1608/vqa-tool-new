const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gemini-3.5-flash-lite';

// Support large image payloads up to 30MB
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));
app.use(cors());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Configuration status endpoint
app.get('/api/config', (req, res) => {
  res.json({
    hasEnvKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
    defaultModel: DEFAULT_MODEL,
    supportedModels: [
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Recommended • 500 RPD / 15 RPM)' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash (Latest Alias)' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
      { id: 'gemini-pro-latest', name: 'Gemini Pro (Deep Reasoning)' }
    ]
  });
});

// Helper: Normalize base64 image data and detect mime type
function normalizeImagePayload(rawImage, explicitMimeType) {
  if (!rawImage || typeof rawImage !== 'string') {
    throw new Error('Image data is missing or invalid.');
  }

  let mimeType = explicitMimeType || 'image/jpeg';
  let base64Data = rawImage;

  // Handle data URL format: data:image/png;base64,iVBOR...
  const dataUrlMatch = rawImage.match(/^data:([^;]+);base64,(.+)$/s);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1];
    base64Data = dataUrlMatch[2];
  }

  // Remove any remaining newlines/whitespace
  base64Data = base64Data.replace(/\s+/g, '');

  return { mimeType, base64Data };
}

// Visual RAG & Question Answering Endpoint
app.post('/api/ask', async (req, res) => {
  try {
    const { image, mimeType: userMimeType, question, apiKey: clientApiKey, model: requestedModel, history } = req.body;

    // Resolve API key (Client UI key takes precedence if supplied, else fallback to .env)
    const apiKey = (clientApiKey && clientApiKey.trim()) ||
                   (req.headers['x-api-key'] && req.headers['x-api-key'].trim()) ||
                   (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());

    if (!apiKey) {
      return res.status(400).json({
        error: 'Gemini API Key is missing.',
        details: 'Please configure GEMINI_API_KEY in your .env file or enter your API key in the UI settings.'
      });
    }

    if (!image) {
      return res.status(400).json({
        error: 'Image is required.',
        details: 'Please upload or drop an image to analyze.'
      });
    }

    if (!question || !question.trim()) {
      return res.status(400).json({
        error: 'Question is required.',
        details: 'Please provide a question or instruction about the image.'
      });
    }

    const { mimeType, base64Data } = normalizeImagePayload(image, userMimeType);
    const model = requestedModel || DEFAULT_MODEL;

    // System instruction for strict Visual Grounding / Visual RAG
    const systemInstruction = {
      parts: [
        {
          text: `You are an expert Visual Question Answering (VQA) and Visual RAG (Retrieval-Augmented Generation) assistant.
Your goal is to answer the user's question accurately by carefully analyzing and retrieving evidence from the provided image.

Follow these strict rules:
1. Grounding: Every answer must be strictly grounded in the visual evidence present in the image (objects, texts, numbers, labels, diagrams, people, colors, positions, actions).
2. Spatial Reference: Where applicable, point out the exact visual location of the evidence (e.g., "in the top-right corner", "in the center foreground", "on the red banner at the bottom").
3. OCR / Text Extraction: If the query asks about text, labels, numbers, or code in the image, transcribe it accurately with high fidelity.
4. Transparency & Hallucination Prevention: If the image does not provide enough evidence to answer the question, explicitly state: "The provided image does not contain enough information to determine this," and state what can actually be observed.
5. Formatting: Output clear, structured Markdown with bold highlights, bullet points, and code blocks or tables when presenting structured information.`
        }
      ]
    };

    // Build the contents array
    const contents = [];

    // If there is prior multi-turn conversation history for this image, add it
    if (Array.isArray(history) && history.length > 0) {
      // First turn includes image + initial question
      const firstTurn = history[0];
      contents.push({
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          {
            text: firstTurn.question
          }
        ]
      });

      if (firstTurn.answer) {
        contents.push({
          role: 'model',
          parts: [{ text: firstTurn.answer }]
        });
      }

      // Add intermediate turns (text only, image is already in context)
      for (let i = 1; i < history.length; i++) {
        const turn = history[i];
        if (turn.question) {
          contents.push({
            role: 'user',
            parts: [{ text: turn.question }]
          });
        }
        if (turn.answer) {
          contents.push({
            role: 'model',
            parts: [{ text: turn.answer }]
          });
        }
      }

      // Current question
      contents.push({
        role: 'user',
        parts: [{ text: question.trim() }]
      });
    } else {
      // Single turn with image + question
      contents.push({
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          {
            text: question.trim()
          }
        ]
      });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiPayload = {
      contents,
      systemInstruction,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2500
      }
    };

    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(geminiPayload)
    });

    const elapsedMs = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.error?.message || `Gemini API returned status ${response.status}`;
      return res.status(response.status).json({
        error: 'Gemini API Error',
        details: errorMessage,
        code: data?.error?.status || response.status
      });
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      return res.status(500).json({
        error: 'No response candidate returned by Gemini.',
        details: 'The model did not generate content, possibly due to safety filters.'
      });
    }

    const answer = candidate.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';

    return res.json({
      answer,
      model,
      elapsedMs,
      usageMetadata: data.usageMetadata || null,
      finishReason: candidate.finishReason || null
    });
  } catch (err) {
    console.error('Error in /api/ask:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message || 'An unexpected error occurred while processing the request.'
    });
  }
});

// Fallback to index.html for single-page routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Gemini VQA Server is running at http://localhost:${PORT}`);
  console.log(`📡 Default model: ${DEFAULT_MODEL}`);
  console.log(`🔑 Environment GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Configured ✅' : 'Not set (can enter in UI) ⚠️'}\n`);
});
