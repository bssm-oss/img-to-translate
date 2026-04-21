let overlay;
let selectionBox;
let isOverlayActive = false;
let isDragging = false;
let startX, startY;

function init() {
  console.log("[OCR Translator] Initializing content script. Ready for hotkeys.");
  overlay = document.createElement('div');
  overlay.id = 'ocr-translator-overlay';
  document.body.appendChild(overlay);

  selectionBox = document.createElement('div');
  selectionBox.id = 'ocr-translator-selection';
  overlay.appendChild(selectionBox);

  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('mouseup', onMouseUp);

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
}

function onKeyDown(e) {
  // Use either Meta (Cmd on Mac) or Ctrl.
  const isCmdOrCtrl = e.metaKey || e.ctrlKey;
  if (isCmdOrCtrl && e.shiftKey && !isOverlayActive) {
    activateOverlay();
  }
}

function onKeyUp(e) {
  const isCmdOrCtrl = e.metaKey || e.ctrlKey;
  if (isOverlayActive && (!e.shiftKey || !isCmdOrCtrl)) {
    if (!isDragging) {
      deactivateOverlay();
    }
  }
}

function activateOverlay() {
  console.log("[OCR Translator] Overlay activated.");
  isOverlayActive = true;
  overlay.style.display = 'block';
  document.body.style.userSelect = 'none';
}

function deactivateOverlay() {
  isOverlayActive = false;
  overlay.style.display = 'none';
  selectionBox.style.display = 'none';
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
  document.body.style.userSelect = '';
}

function onMouseDown(e) {
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  
  selectionBox.style.left = startX + 'px';
  selectionBox.style.top = startY + 'px';
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
  selectionBox.style.display = 'block';
}

function onMouseMove(e) {
  if (!isDragging) return;
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  
  selectionBox.style.left = Math.min(currentX, startX) + 'px';
  selectionBox.style.top = Math.min(currentY, startY) + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
}

function onMouseUp(e) {
  if (!isDragging) return;
  isDragging = false;
  
  const rect = selectionBox.getBoundingClientRect();
  
  // Ignore tiny selections
  if (rect.width < 10 || rect.height < 10) {
    deactivateOverlay();
    return;
  }
  
  // Hide overlay immediately before capture
  overlay.style.display = 'none';
  
  // Ask background to capture screen
  chrome.runtime.sendMessage({ action: 'captureScreen' }, response => {
    // Show comment box with loading state
    const commentBox = createCommentBox(rect.left, rect.top, rect.width, rect.height);
    
    if (chrome.runtime.lastError || !response || response.error) {
       updateCommentBox(commentBox, null, "Failed to capture screen.");
       deactivateOverlay();
       return;
    }
    
    cropImage(response.dataUrl, rect.left, rect.top, rect.width, rect.height, (croppedDataUrl) => {
      // Deactivate internal state completely
      deactivateOverlay();
      
      // Get settings from storage
      chrome.storage.sync.get({ ocrLang: 'eng+kor', targetLang: 'ko' }, (settings) => {
        // Send to background for OCR and Translation
        chrome.runtime.sendMessage({
          action: 'processImage',
          imageData: croppedDataUrl,
          ocrLang: settings.ocrLang,
          targetLang: settings.targetLang
        }, processResponse => {
          if (chrome.runtime.lastError || !processResponse || processResponse.error) {
             updateCommentBox(commentBox, null, processResponse?.error || "Translation processing failed.");
          } else {
             updateCommentBox(commentBox, processResponse.translatedText, null, processResponse.extractedText);
          }
        });
      });
    });
  });
}

function cropImage(dataUrl, sx, sy, sw, sh, callback) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = img.width / window.innerWidth;
    canvas.width = sw * scale;
    canvas.height = sh * scale;
    ctx.drawImage(img, sx * scale, sy * scale, sw * scale, sh * scale, 0, 0, canvas.width, canvas.height);
    callback(canvas.toDataURL('image/png'));
  };
  img.src = dataUrl;
}

function createCommentBox(x, y, selWidth, selHeight) {
  const box = document.createElement('div');
  box.className = 'ocr-translator-comment-box';
  
  // Position it next to the selection
  const left = x + window.scrollX + selWidth + 10;
  const top = y + window.scrollY;
  // Ensure it doesn't overflow right side of screen
  const isRightOverflow = left + 300 > window.innerWidth;
  
  box.style.left = isRightOverflow ? (x + window.scrollX - 310) + 'px' : left + 'px';
  box.style.top = top + 'px';
  
  box.innerHTML = `
    <div class="ocr-translator-comment-header">
      <span>Translation</span>
      <button class="ocr-translator-close-btn">×</button>
    </div>
    <div class="ocr-translator-comment-body">
      <div class="ocr-translator-loading">
        <div class="ocr-translator-loading-spinner"></div>
        Recognizing & Translating...
      </div>
    </div>
  `;
  
  document.body.appendChild(box);
  
  // Close button
  box.querySelector('.ocr-translator-close-btn').addEventListener('click', () => {
    box.remove();
  });
  
  // Make it draggable
  let isDraggingBox = false;
  let boxStartX, boxStartY, initialLeft, initialTop;
  const header = box.querySelector('.ocr-translator-comment-header');
  
  header.addEventListener('mousedown', e => {
    isDraggingBox = true;
    boxStartX = e.clientX;
    boxStartY = e.clientY;
    initialLeft = parseInt(box.style.left || 0, 10);
    initialTop = parseInt(box.style.top || 0, 10);
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', e => {
    if (!isDraggingBox) return;
    const dx = e.clientX - boxStartX;
    const dy = e.clientY - boxStartY;
    box.style.left = (initialLeft + dx) + 'px';
    box.style.top = (initialTop + dy) + 'px';
  });
  
  document.addEventListener('mouseup', () => {
    isDraggingBox = false;
  });
  
  return box;
}

function updateCommentBox(box, translatedText, errorMsg, originalText) {
  const body = box.querySelector('.ocr-translator-comment-body');
  
  if (errorMsg) {
    body.innerHTML = `<span style="color: #E74C3C; font-weight: 500;">Error:</span> ${errorMsg}`;
  } else {
    // Escape HTML from original text to prevent injection in textarea
    const safeOriginal = originalText ? originalText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
    
    body.innerHTML = `
      <div class="ocr-translator-result-text" style="font-size: 15px; color: #111;">${translatedText.replace(/\\n/g, '<br>')}</div>
      ${originalText ? `
        <div class="ocr-translator-original">
          <textarea class="ocr-translator-textarea">${safeOriginal}</textarea>
          <div class="ocr-translator-refresh-status">
            <div class="ocr-translator-mini-spinner"></div>
            Translating...
          </div>
        </div>
      ` : ''}
    `;
    
    if (originalText) {
      const textarea = body.querySelector('.ocr-translator-textarea');
      const statusDiv = body.querySelector('.ocr-translator-refresh-status');
      const resultDiv = body.querySelector('.ocr-translator-result-text');
      
      let debounceTimer = null;
      
      textarea.addEventListener('input', () => {
        // Show loading
        statusDiv.classList.add('active');
        resultDiv.style.opacity = '0.5';
        
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const newText = textarea.value;
          chrome.storage.sync.get({ targetLang: 'ko' }, (settings) => {
            chrome.runtime.sendMessage({
              action: 'retranslate',
              text: newText,
              targetLang: settings.targetLang
            }, response => {
              statusDiv.classList.remove('active');
              resultDiv.style.opacity = '1';
              
              if (chrome.runtime.lastError || !response || response.error) {
                resultDiv.innerHTML = `<span style="color: #E74C3C;">Error: ${response?.error || 'Failed to re-translate'}</span>`;
              } else {
                resultDiv.innerHTML = response.translatedText.replace(/\\n/g, '<br>');
              }
            });
          });
        }, 800);
      });
    }
  }
}

// Ensure DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
