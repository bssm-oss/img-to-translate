async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['WORKERS'],
    justification: 'To run Tesseract OCR using a Web Worker'
  });
}

// Ensure the offscreen document is ready before handling messages
setupOffscreenDocument();

async function translateText(text, targetLang) {
  // Using Google Translate free endpoint
  // sl=auto means auto-detect source language
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  
  const response = await fetch(url);
  const json = await response.json();
  
  // The structure returned is an array of translated pieces
  let translatedText = '';
  if (json && json[0]) {
    for (const segment of json[0]) {
      translatedText += segment[0];
    }
  }
  return translatedText;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreen') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' })
      .then(dataUrl => {
        sendResponse({ dataUrl });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true; // Keep channel open
  }

  if (request.action === 'retranslate') {
    (async () => {
      try {
        const text = request.text.trim();
        if (!text) {
          throw new Error("Text is empty.");
        }
        const translatedText = await translateText(text, request.targetLang || 'ko');
        sendResponse({ success: true, translatedText });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'processImage') {
    (async () => {
      try {
        await setupOffscreenDocument();

        // 1. Run OCR (get original text)
        // We can pass the tesseract language. For now 'eng+kor' or a generic setup. Let's use 'eng+kor' if both needed?
        // Let's use 'eng' as default but we can let user configure it later. For now, we will use 'eng+kor'.
        const ocrResponse = await chrome.runtime.sendMessage({
          action: 'extractText',
          imageData: request.imageData,
          lang: request.ocrLang || 'eng' // We will pass standard tesseract lang code from content
        });

        if (ocrResponse.error) {
          throw new Error(ocrResponse.error);
        }

        let extractedText = ocrResponse.text.trim();
        
        // --- LLM Cleaner / Noise Filter ---
        
        // 0. Remove special characters and punctuations from the beginning of each line
        extractedText = extractedText.split('\n')
          .map(line => line.replace(/^[\p{P}\p{S}]+/u, '').trim())
          .join('\n')
          .trim();

        // Ignore empty strings
        if (!extractedText) {
          throw new Error("No text found in the image.");
        }

        // 1. Reject if it consists ENTIRELY of special characters, symbols, punctuations, whitespace, or isolated Jamo (regardless of length).
        if (/^[\p{P}\p{S}ㄱ-ㅎㅏ-ㅣ\s]+$/u.test(extractedText)) {
          throw new Error(`Symbol-only noise detected and ignored: "${extractedText}"`);
        }

        // 2. Reject very short noise (1~2 chars) even if it's purely numbers (like "1.", " 2").
        if (extractedText.length <= 2 && /^[\p{P}\p{S}\dㄱ-ㅎㅏ-ㅣ\s]+$/u.test(extractedText)) {
          throw new Error(`Short meaningless noise detected and ignored: "${extractedText}"`);
        }
        
        // 3. Reject single weird English letters commonly produced as noise by OCR (like l, i, I, j, 1).
        if (extractedText.length === 1 && /^[ilI1|!j\`\'\"]$/.test(extractedText)) {
           throw new Error(`Artifact noise detected and ignored: "${extractedText}"`);
        }

        // 2. Translate text
        const targetLang = request.targetLang || 'ko'; // default to Korean
        const translatedText = await translateText(extractedText, targetLang);

        sendResponse({ 
          success: true, 
          extractedText, 
          translatedText 
        });

      } catch (error) {
        console.error("Pipeline Error:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep channel open
  }
});
