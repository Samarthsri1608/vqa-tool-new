# Visual QA Tool (`vqa-tool-new`)

A clean, minimalist web application for **Visual Question Answering (VQA)** and **Visual RAG** powered by Google's **Gemini 3.5 Flash Lite** multimodal API.

Upload or paste any image, submit your query, and receive grounded answers backed by visual evidence extracted from the image.

---

## Features

- **Grounded Visual RAG**: System prompts ensure answers are strictly backed by visible image details (OCR text transcription, object recognition, chart numbers, and spatial layout), preventing hallucinations.
- **High-Quota Multimodal Backend**: Defaults to `gemini-3.5-flash-lite`, offering **500 Requests Per Day (RPD)** and **15 Requests Per Minute (RPM)** with fast response times (~1.5s - 2s).
- **Streamlined User Interface**:
  - Drag-and-drop image upload
  - File picker browse button
  - Clipboard paste support (`Ctrl+V` / `Cmd+V`)
  - Built-in canvas test samples (Receipt/OCR, Sales Chart, Architecture Diagram)
  - Quick query prompts (OCR text extraction, image description, chart analysis, object detection)
  - Keyboard shortcut (`Ctrl/⌘ + Enter`) to submit
- **Multi-Turn QA History**: Ask follow-up questions about the same image while preserving conversation context.
- **Rich Markdown Output**: Responses formatted with bold highlights, tables, lists, code blocks, and one-click copy.
- **Secure Backend Integration**: Gemini API key managed securely on the server via `.env`.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Your Gemini API Key
Create your `.env` file from the provided template:
```bash
cp .env.example .env
```

Add your Gemini API key to `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
DEFAULT_MODEL=gemini-3.5-flash-lite
```

### 3. Start the Server
```bash
npm start
```
For automatic reload during development:
```bash
npm run dev
```

### 4. Open the Web App
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Visual RAG Architecture

1. **Image Ingestion**: Images are loaded, previewed with dimensions/file size, and normalized into standard base64 payloads.
2. **Visual Grounding Prompt**: Queries are framed with strict grounding rules:
   - Visible text and numerical values must be transcribed with high fidelity.
   - Spatial cues (e.g. "top-right", "in the table header") are cited.
   - If evidence is not present in the image, the model explicitly notes the limitation rather than speculating.
3. **Multimodal Inference**: Gemini processes the image parts (`inlineData`) and text instructions in a single multimodal pass.
4. **Answer Display**: Response is rendered in Markdown with latency tracking and token consumption metrics.

---

## Project Structure

```
vqa-tool-new/
├── server.js           # Express backend with /api/ask and Gemini integration
├── package.json        # Dependencies and scripts
├── .env.example        # Environment configuration template
├── public/
│   ├── index.html      # Minimalist web UI
│   ├── style.css       # Clean dark-mode responsive design
│   └── app.js          # Image loading, canvas samples, and QA flow
└── README.md           # Documentation
```
