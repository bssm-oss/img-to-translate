document.addEventListener('DOMContentLoaded', () => {
  const ocrLangSelect = document.getElementById('ocrLang');
  const targetLangSelect = document.getElementById('targetLang');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  chrome.storage.sync.get({
    ocrLang: 'eng+kor',
    targetLang: 'ko'
  }, (items) => {
    ocrLangSelect.value = items.ocrLang;
    targetLangSelect.value = items.targetLang;
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const ocrLang = ocrLangSelect.value;
    const targetLang = targetLangSelect.value;

    chrome.storage.sync.set({
      ocrLang,
      targetLang
    }, () => {
      statusDiv.textContent = 'Settings saved!';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    });
  });
});
