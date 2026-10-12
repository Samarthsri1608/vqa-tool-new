# 👁️ Visual Question Answering (VQA) & Visual RAG Tool

An interactive web application for **Visual Question Answering (VQA)** and **Visual RAG** powered by Google's **Gemini Multimodal Vision API**.

Upload or paste any image, ask questions about it in natural language, and receive grounded answers backed by visual evidence extracted from the image.

---

## ✨ Features

- **Multi-Modal Visual Question Answering**: Ask questions about photos, receipts, documents, charts, graphs, screenshots, and diagrams.
- **Visual RAG Grounding**: Prompt engineering optimized to ground answers strictly in visual evidence (OCR text, object locations, colors, numbers) and prevent hallucinations.
- **Multiple Input Methods**:
  - Drag-and-drop images
  - File browser
  - Direct clipboard paste (`Ctrl+V` / `Cmd+V`)
  - 1-click built-in test samples (Receipt/OCR, Sales Chart, Architecture Diagram)
- **Multi-Turn Conversation**: Ask follow-up questions about the same image while preserving conversation context.
- **Flexible API Key Setup**:
  - Load your Gemini API key via server `.env` file (`GEMINI_API_KEY=...`)
  - Or input your API key directly in the web UI (stored securely in browser `localStorage`).
- **Model Support**: Defaults to `gemini-3.5-flash-lite` (providing 500 RPD and 15 RPM for high throughput) with options to toggle `gemini-3.8-flash`, `gemini-flash-latest`, and `gemini-pro-latest`.
- **Rich Markdown Formatting**: Answers rendered with bold highlights, tables, code blocks, lists, and copy-to-clipboard functionality.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Gemini API Key (Optional)
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Edit `.env` and add your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```
> *Note: If you don't configure `.env`, you can simply enter your API key directly in the web interface.*

### 3. Start the Server
```bash
npm start
```
Or with hot reload in development:
```bash
npm run dev
```

### 4. Open in Browser
Visit [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🛠️ How It Works (Visual RAG Architecture)

1. **Image Ingestion**: Images are loaded and normalized into standard base64 data payloads.
2. **Visual RAG System Prompt**: The server applies strict grounding instructions:
   - Extracted OCR text must be transcribed verbatim.
   - Spatial relationships and visual positions must be referenced (e.g. "top-right", "in the table header").
   - If the visual evidence is insufficient or ambiguous, the model states so explicitly rather than hallucinating.
3. **Multimodal Gemini Execution**: The Gemini API processes image tokens and prompt tokens simultaneously using its multimodal encoder.
4. **Answer Rendering**: The response is streamed/returned with latency metrics, token consumption, and Markdown formatting.

---

## 📂 Project Structure

```
vqa-tool/
├── server.js           # Express server & Gemini multimodal /api/ask route
├── package.json        # Dependencies (express, cors, dotenv)
├── .env.example        # Environment variable template
├── public/
│   ├── index.html      # Accessible web UI with upload & QA panels
│   ├── style.css       # Modern dark theme responsive styling
│   └── app.js          # Client-side image handling, canvas samples, and QA flow
└── README.md           # Documentation
```
