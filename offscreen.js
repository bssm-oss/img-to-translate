// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractText') {
    handleExtractText(request.imageData, request.lang)
      .then(text => {
        sendResponse({ text });
      })
      .catch(error => {
        sendResponse({ error: error.toString() });
      });
    return true; // Indicates an async response
  }
});

let worker = null;

async function setupWorker(lang = 'eng') {
  if (!worker) {
    worker = await Tesseract.createWorker(lang, 1, {
      workerPath: chrome.runtime.getURL('tesseract/worker.min.js'),
      corePath: chrome.runtime.getURL('tesseract/tesseract-core.wasm.js')
    });
  } else {
    // Switch or reinit language if needed. Since we createWorker with lang above,
    // let's just initialize. In Tesseract v5: you can call `createWorker(lang, ...)` directly.
    // However, if lang changes, we'd better recreate or use `worker = await Tesseract.createWorker(lang, ...)`
    // To handle multiple languages, let's keep it simple: we terminate old worker if lang differs?
    // Actually, v5 setup is simpler:
  }
}

let currentLang = null;

async function handleExtractText(imageData, lang = 'eng') {
  try {
    if (!worker || currentLang !== lang) {
      if (worker) {
        await worker.terminate();
      }
      worker = await Tesseract.createWorker(lang, 1, {
        workerBlobURL: false,
        workerPath: chrome.runtime.getURL('tesseract/worker.min.js'),
        corePath: chrome.runtime.getURL('tesseract/tesseract-core.wasm.js')
      });
      currentLang = lang;
    }

    const { data: { text } } = await worker.recognize(imageData);
    return text.trim();
  } catch (e) {
    console.error("OCR Error:", e);
    throw e;
  }
}
