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
