// State management
const state = {
  currentImage: null, // { dataUrl, mimeType, name, size, width, height }
  hasServerKey: false,
  apiKey: localStorage.getItem('gemini_api_key') || '',
  selectedModel: 'gemini-3.5-flash-lite',
  history: [], // [{ question, answer }]
  isLoading: false,
  timerInterval: null,
  timerStart: 0
};

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const previewCard = document.getElementById('previewCard');
const previewImage = document.getElementById('previewImage');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileDimensions = document.getElementById('fileDimensions');
const removeImageBtn = document.getElementById('removeImageBtn');

const qaForm = document.getElementById('qaForm');
const questionInput = document.getElementById('questionInput');
const submitBtn = document.getElementById('submitBtn');
const modelSelect = document.getElementById('modelSelect');

const answerSection = document.getElementById('answerSection');
const answerBody = document.getElementById('answerBody');
const answerTimer = document.getElementById('answerTimer');
const answerMeta = document.getElementById('answerMeta');
const copyAnswerBtn = document.getElementById('copyAnswerBtn');
const newQuestionBtn = document.getElementById('newQuestionBtn');
const conversationThread = document.getElementById('conversationThread');
const conversationCount = document.getElementById('conversationCount');

const loadingState = document.getElementById('loadingState');
const errorAlert = document.getElementById('errorAlert');
const errorTitle = document.getElementById('errorTitle');
const errorMessage = document.getElementById('errorMessage');
const dismissErrorBtn = document.getElementById('dismissErrorBtn');

// API Key Elements
const apiKeyToggleBtn = document.getElementById('apiKeyToggleBtn');
const apiKeyDrawer = document.getElementById('apiKeyDrawer');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
const keyNotice = document.getElementById('keyNotice');
const keyStatusDot = document.getElementById('keyStatusDot');
const keyStatusText = document.getElementById('keyStatusText');

// Initialize Application
async function init() {
  setupEventListeners();
  await checkServerConfig();
  updateKeyUI();
}

// 1. Server Configuration & Key Management
async function checkServerConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      state.hasServerKey = Boolean(data.hasEnvKey);
      if (data.defaultModel && !modelSelect.value) {
        state.selectedModel = data.defaultModel;
        modelSelect.value = data.defaultModel;
      }
    }
  } catch (err) {
    console.warn('Could not fetch server config:', err);
  }
}

function updateKeyUI() {
  const hasLocal = Boolean(state.apiKey);
  const active = state.hasServerKey || hasLocal;

  if (active) {
    keyStatusDot.classList.add('active');
    keyStatusText.textContent = hasLocal ? 'UI Key Saved' : 'Env Key Active';
    keyNotice.className = 'key-notice success';
    keyNotice.textContent = hasLocal
      ? '✓ Using custom API key saved in browser storage.'
      : '✓ Server .env key detected and ready.';
  } else {
    keyStatusDot.classList.remove('active');
    keyStatusText.textContent = 'API Key Needed';
    keyNotice.className = 'key-notice';
    keyNotice.textContent = '⚠️ No API key found. Enter one above or add GEMINI_API_KEY to your .env file.';
  }

  if (hasLocal) {
    apiKeyInput.value = state.apiKey;
  }
}

// 2. Event Listeners Setup
function setupEventListeners() {
  // Key drawer
  apiKeyToggleBtn.addEventListener('click', () => {
    apiKeyDrawer.classList.toggle('hidden');
    if (!apiKeyDrawer.classList.contains('hidden')) {
      apiKeyInput.focus();
    }
  });

  closeDrawerBtn.addEventListener('click', () => {
    apiKeyDrawer.classList.add('hidden');
  });

  saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      state.apiKey = key;
      localStorage.setItem('gemini_api_key', key);
      updateKeyUI();
      apiKeyDrawer.classList.add('hidden');
    }
  });

  clearApiKeyBtn.addEventListener('click', () => {
    state.apiKey = '';
    localStorage.removeItem('gemini_api_key');
    apiKeyInput.value = '';
    updateKeyUI();
  });

  // Model selection
  modelSelect.addEventListener('change', (e) => {
    state.selectedModel = e.target.value;
  });

  // File browse & click
  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files[0] && files[0].type.startsWith('image/')) {
      handleFileSelected(files[0]);
    } else {
      showError('Invalid file type', 'Please drop a valid image file (PNG, JPG, WEBP, etc.).');
    }
  });

  // Clipboard paste support (Ctrl+V / Cmd+V)
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
    if (!items) return;

    for (let item of items) {
      if (item.type.indexOf('image') === 0) {
        const blob = item.getAsFile();
        if (blob) {
          handleFileSelected(blob, 'pasted-image.png');
          break;
        }
      }
    }
  });

  // Remove current image
  removeImageBtn.addEventListener('click', resetImage);

  // Quick prompt chips
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      questionInput.value = btn.getAttribute('data-prompt');
      questionInput.focus();
    });
  });

  // Sample images
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sampleType = btn.getAttribute('data-sample');
      loadSampleImage(sampleType);
    });
  });

  // Keyboard shortcut: Cmd/Ctrl + Enter to submit
  questionInput.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      qaForm.requestSubmit();
    }
  });

  // Form submission
  qaForm.addEventListener('submit', handleFormSubmit);

  // Copy answer
  copyAnswerBtn.addEventListener('click', () => {
    const textToCopy = answerBody.innerText || answerBody.textContent;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        const orig = copyAnswerBtn.innerHTML;
        copyAnswerBtn.innerHTML = '✓ Copied!';
        setTimeout(() => { copyAnswerBtn.innerHTML = orig; }, 1800);
      });
    }
  });

  // Follow-up question
  newQuestionBtn.addEventListener('click', () => {
    questionInput.value = '';
    questionInput.focus();
    questionInput.scrollIntoView({ behavior: 'smooth' });
  });

  // Dismiss error
  dismissErrorBtn.addEventListener('click', () => {
    errorAlert.classList.add('hidden');
  });
}

// 3. File Processing & Image Loading
function handleFileSelected(file, customName) {
  if (!file.type.startsWith('image/')) {
    showError('Unsupported file type', 'Please select a valid image file.');
    return;
  }

  // 25MB safety check
  if (file.size > 25 * 1024 * 1024) {
    showError('Image too large', 'Please choose an image under 25MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const tempImg = new Image();
    tempImg.onload = () => {
      state.currentImage = {
        dataUrl,
        mimeType: file.type || 'image/jpeg',
        name: customName || file.name || 'image.png',
        size: formatBytes(file.size),
        width: tempImg.naturalWidth,
        height: tempImg.naturalHeight
      };

      // Reset conversation history for new image
      state.history = [];
      updateConversationThreadUI();

      renderImagePreview();
      hideError();
    };
    tempImg.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function renderImagePreview() {
  if (!state.currentImage) return;

  previewImage.src = state.currentImage.dataUrl;
  fileName.textContent = state.currentImage.name;
  fileSize.textContent = state.currentImage.size;
  fileDimensions.textContent = `${state.currentImage.width} × ${state.currentImage.height}px`;

  dropZone.classList.add('hidden');
  previewCard.classList.remove('hidden');
}

function resetImage() {
  state.currentImage = null;
  state.history = [];
  fileInput.value = '';
  previewImage.src = '';
  previewCard.classList.add('hidden');
  dropZone.classList.remove('hidden');
  answerSection.classList.add('hidden');
  updateConversationThreadUI();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 4. Built-in Canvas Sample Generators (Self-contained, Zero external dependencies)
function loadSampleImage(type) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (type === 'receipt') {
    canvas.width = 600;
    canvas.height = 700;
    
    // Receipt background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Receipt borders / decorative tear line
    ctx.strokeStyle = '#e0ded8';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 560, 660);

    // Text details
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('STARLIGHT CAFE & BAKERY', 300, 70);
    ctx.font = '14px monospace';
    ctx.fillText('104 Innovation Blvd, Suite 400', 300, 95);
    ctx.fillText('Tel: (555) 019-2834 • VAT #US-984210', 300, 115);
    ctx.fillText('Date: 2026-10-12   Time: 14:32:05', 300, 135);
    ctx.fillText('Receipt #RCP-90214', 300, 155);

    // Divider
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.moveTo(40, 175);
    ctx.lineTo(560, 175);
    ctx.stroke();
    ctx.setLineDash([]);

    // Items table
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('ITEM                      QTY   PRICE    TOTAL', 40, 205);

    const items = [
      ['Double Shot Espresso', '2', '$4.50', '$9.00'],
      ['Avocado Sourdough Toast', '1', '$12.50', '$12.50'],
      ['Almond Croissant', '2', '$4.25', '$8.50'],
      ['Fresh Orange Juice 16oz', '1', '$6.00', '$6.00'],
      ['Matcha Green Tea Latte', '1', '$5.50', '$5.50']
    ];

    ctx.font = '14px monospace';
    let y = 240;
    items.forEach(([name, qty, price, tot]) => {
      ctx.fillText(name.padEnd(25, ' ') + qty.padStart(3, ' ') + price.padStart(8, ' ') + tot.padStart(9, ' '), 40, y);
      y += 28;
    });

    // Divider
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.moveTo(40, y + 10);
    ctx.lineTo(560, y + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // Totals
    y += 45;
    ctx.font = '15px monospace';
    ctx.fillText('Subtotal:                               $41.50', 40, y);
    ctx.fillText('State Tax (8.25%):                       $3.42', 40, y + 25);
    ctx.fillText('Tip (18%):                               $7.47', 40, y + 50);
    ctx.font = 'bold 20px monospace';
    ctx.fillText('TOTAL DUE:                              $52.39', 40, y + 90);
    ctx.font = '13px monospace';
    ctx.fillText('Payment: VISA ending in *4892 (APPROVED)', 40, y + 120);
    ctx.fillText('Thank you for dining with us!', 300, y + 155);

    finishLoadingCanvas(canvas, 'sample-receipt.png');

  } else if (type === 'chart') {
    canvas.width = 720;
    canvas.height = 480;

    // Background
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#f0f6fc';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Q1-Q4 Enterprise Cloud Revenue & Profit (2026)', 40, 45);

    // Chart Area
    const barWidth = 60;
    const spacing = 140;
    const startX = 100;
    const baselineY = 380;

    const data = [
      { quarter: 'Q1 2026', rev: 180, profit: 80, colorR: '#1f6feb', colorP: '#238636' },
      { quarter: 'Q2 2026', rev: 230, profit: 110, colorR: '#1f6feb', colorP: '#238636' },
      { quarter: 'Q3 2026', rev: 290, profit: 155, colorR: '#1f6feb', colorP: '#238636' },
      { quarter: 'Q4 2026', rev: 350, profit: 195, colorR: '#1f6feb', colorP: '#238636' }
    ];

    // Grid lines
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    for (let h = 0; h <= 400; h += 100) {
      const lineY = baselineY - h * 0.7;
      ctx.beginPath();
      ctx.moveTo(80, lineY);
      ctx.lineTo(660, lineY);
      ctx.stroke();

      ctx.fillStyle = '#8b949e';
      ctx.font = '11px sans-serif';
      ctx.fillText(`$${h}M`, 45, lineY + 4);
    }

    // Draw bars
    data.forEach((d, index) => {
      const x = startX + index * spacing;
      const revH = d.rev * 0.7;
      const profH = d.profit * 0.7;

      // Revenue bar
      ctx.fillStyle = d.colorR;
      ctx.fillRect(x, baselineY - revH, barWidth / 2, revH);

      // Profit bar
      ctx.fillStyle = d.colorP;
      ctx.fillRect(x + barWidth / 2 + 4, baselineY - profH, barWidth / 2, profH);

      // Labels
      ctx.fillStyle = '#f0f6fc';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.quarter, x + barWidth / 2, baselineY + 25);

      // Values above bars
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#58a6ff';
      ctx.fillText(`$${d.rev}M`, x + 15, baselineY - revH - 8);
      ctx.fillStyle = '#3fb950';
      ctx.fillText(`$${d.profit}M`, x + 45, baselineY - profH - 8);
    });

    // Legend
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1f6feb';
    ctx.fillRect(480, 75, 14, 14);
    ctx.fillStyle = '#f0f6fc';
    ctx.font = '12px sans-serif';
    ctx.fillText('Gross Revenue', 502, 87);

    ctx.fillStyle = '#238636';
    ctx.fillRect(480, 98, 14, 14);
    ctx.fillStyle = '#f0f6fc';
    ctx.fillText('Net Profit', 502, 110);

    finishLoadingCanvas(canvas, 'sample-sales-chart.png');

  } else if (type === 'diagram') {
    canvas.width = 720;
    canvas.height = 420;

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f0f6fc';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('System Architecture: Multimodal Visual RAG Service', 40, 40);

    // Draw boxes
    function drawBox(x, y, w, h, title, sub, color) {
      ctx.fillStyle = '#161b22';
      ctx.strokeStyle = color || '#30363d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color || '#f0f6fc';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(title, x + 16, y + 30);

      ctx.fillStyle = '#8b949e';
      ctx.font = '12px sans-serif';
      ctx.fillText(sub, x + 16, y + 54);
    }

    drawBox(40, 90, 160, 80, 'Client Web UI', 'HTML / CSS / JS', '#58a6ff');
    drawBox(270, 90, 170, 80, 'API Gateway', 'Express / Node.js', '#a371f7');
    drawBox(510, 90, 170, 80, 'Gemini 2.5 Flash', 'Multimodal Vision', '#3fb950');

    drawBox(270, 240, 170, 80, 'Visual Grounding', 'RAG System Prompt', '#d29922');
    drawBox(510, 240, 170, 80, 'Response Parser', 'Token Usage & MD', '#f0883e');

    // Arrows
    function drawArrow(x1, y1, x2, y2) {
      ctx.strokeStyle = '#58a6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.fillStyle = '#58a6ff';
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 10 * Math.cos(angle - Math.PI / 6), y2 - 10 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - 10 * Math.cos(angle + Math.PI / 6), y2 - 10 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    drawArrow(200, 130, 265, 130);
    drawArrow(440, 130, 505, 130);
    drawArrow(355, 170, 355, 235);
    drawArrow(440, 280, 505, 280);

    finishLoadingCanvas(canvas, 'sample-architecture-diagram.png');
  }
}

function finishLoadingCanvas(canvas, filename) {
  const dataUrl = canvas.toDataURL('image/png');
  state.currentImage = {
    dataUrl,
    mimeType: 'image/png',
    name: filename,
    size: '150 KB',
    width: canvas.width,
    height: canvas.height
  };
  state.history = [];
  updateConversationThreadUI();
  renderImagePreview();
  hideError();
}

// 5. Form Submission & API Call
async function handleFormSubmit(e) {
  e.preventDefault();

  if (state.isLoading) return;

  const question = questionInput.value.trim();
  if (!question) {
    showError('Empty Question', 'Please enter a question to ask about the image.');
    return;
  }

  if (!state.currentImage) {
    showError('No Image Provided', 'Please upload or drop an image before asking questions.');
    return;
  }

  const hasKey = Boolean(state.apiKey || state.hasServerKey);
  if (!hasKey) {
    apiKeyDrawer.classList.remove('hidden');
    apiKeyInput.focus();
    showError('Gemini API Key Required', 'Please enter your Gemini API key in the settings drawer or add GEMINI_API_KEY to your server .env file.');
    return;
  }

  hideError();
  setLoading(true);

  try {
    const payload = {
      image: state.currentImage.dataUrl,
      mimeType: state.currentImage.mimeType,
      question: question,
      apiKey: state.apiKey || undefined,
      model: state.selectedModel,
      history: state.history
    };

    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.details || data.error || `HTTP error ${res.status}`);
    }

    // Display answer
    renderAnswer(question, data);

    // Save turn to history
    state.history.push({
      question,
      answer: data.answer
    });
    updateConversationThreadUI();

  } catch (err) {
    console.error('Error during VQA request:', err);
    showError('Gemini Analysis Failed', err.message || 'Failed to communicate with Gemini API.');
  } finally {
    setLoading(false);
  }
}

// 6. Answer & Metadata Rendering
function renderAnswer(question, data) {
  const answerMarkdown = data.answer || 'No answer generated.';

  // Render markdown safely
  if (window.marked && typeof window.marked.parse === 'function') {
    answerBody.innerHTML = window.marked.parse(answerMarkdown);
  } else {
    answerBody.innerText = answerMarkdown;
  }

  // Elapsed time badge
  const elapsedSec = (data.elapsedMs / 1000).toFixed(2);
  answerTimer.textContent = `⚡ ${elapsedSec}s`;

  // Footer metadata
  let metaHtml = `<span>Model: <strong>${data.model || state.selectedModel}</strong></span>`;
  if (data.usageMetadata) {
    const totalTokens = data.usageMetadata.totalTokenCount || 0;
    metaHtml += `<span>Tokens: <strong>${totalTokens}</strong></span>`;
  }
  if (data.finishReason) {
    metaHtml += `<span>Status: <strong>${data.finishReason}</strong></span>`;
  }
  answerMeta.innerHTML = metaHtml;

  answerSection.classList.remove('hidden');
  answerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateConversationThreadUI() {
  if (state.history.length === 0) {
    conversationThread.classList.add('hidden');
    conversationCount.classList.add('hidden');
    conversationThread.innerHTML = '';
    return;
  }

  conversationCount.classList.remove('hidden');
  conversationCount.textContent = `History: ${state.history.length} turn${state.history.length > 1 ? 's' : ''}`;
  conversationThread.classList.remove('hidden');

  conversationThread.innerHTML = state.history.map((turn, i) => `
    <div class="thread-turn">
      <div class="thread-turn-question">Q${i + 1}: ${escapeHtml(turn.question)}</div>
      <div class="thread-turn-answer">${escapeHtml(turn.answer.substring(0, 140))}${turn.answer.length > 140 ? '...' : ''}</div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

// 7. Loading & UI State Helpers
function setLoading(loading) {
  state.isLoading = loading;
  submitBtn.disabled = loading;

  const spinner = submitBtn.querySelector('.submit-spinner');
  const arrow = submitBtn.querySelector('.submit-arrow');
  const submitText = submitBtn.querySelector('.submit-text');

  if (loading) {
    spinner.classList.remove('hidden');
    arrow.classList.add('hidden');
    submitText.textContent = 'Analyzing...';
    loadingState.classList.remove('hidden');

    state.timerStart = Date.now();
    state.timerInterval = setInterval(() => {
      const sec = ((Date.now() - state.timerStart) / 1000).toFixed(1);
      answerTimer.textContent = `⏱️ ${sec}s`;
    }, 100);
  } else {
    spinner.classList.add('hidden');
    arrow.classList.remove('hidden');
    submitText.textContent = 'Ask Gemini';
    loadingState.classList.add('hidden');

    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }
}

function showError(title, msg) {
  errorTitle.textContent = title;
  errorMessage.textContent = msg;
  errorAlert.classList.remove('hidden');
  errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  errorAlert.classList.add('hidden');
}

// Start
document.addEventListener('DOMContentLoaded', init);
