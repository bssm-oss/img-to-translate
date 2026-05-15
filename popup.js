document.addEventListener('DOMContentLoaded', () => {
  const ocrLangSelect = document.getElementById('ocrLang');
  const targetLangSelect = document.getElementById('targetLang');
  const hotkeyDisplay = document.getElementById('hotkeyDisplay');
  const recordHotkeyBtn = document.getElementById('recordHotkeyBtn');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');

  let currentHotkey = {
    ctrl: false,
    alt: true,
    shift: true,
    meta: false,
    key: 'Shift' // Default is Alt+Shift. 'Shift' is the last key pressed.
  };

  let isRecording = false;

  function updateHotkeyDisplay(hotkey) {
    const parts = [];
    if (hotkey.ctrl) parts.push('Ctrl');
    if (hotkey.alt) parts.push('Alt');
    if (hotkey.shift) parts.push('Shift');
    if (hotkey.meta) parts.push('Cmd');
    if (hotkey.key && !['Control', 'Alt', 'Shift', 'Meta'].includes(hotkey.key)) {
      parts.push(hotkey.key.toUpperCase());
    }
    hotkeyDisplay.textContent = parts.join(' + ') || 'None';
  }

  // Load saved settings
  chrome.storage.sync.get({
    ocrLang: 'eng+kor',
    targetLang: 'ko',
    hotkey: currentHotkey
  }, (items) => {
    ocrLangSelect.value = items.ocrLang;
    targetLangSelect.value = items.targetLang;
    currentHotkey = items.hotkey;
    updateHotkeyDisplay(currentHotkey);
  });

  // Hotkey recording logic
  recordHotkeyBtn.addEventListener('click', () => {
    isRecording = true;
    hotkeyDisplay.textContent = 'Press keys...';
    hotkeyDisplay.classList.add('recording');
    recordHotkeyBtn.disabled = true;

    const onKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const newHotkey = {
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
        key: e.key
      };

      // Update UI while keys are held
      updateHotkeyDisplay(newHotkey);
      
      currentHotkey = newHotkey;
    };

    const onKeyUp = (e) => {
      isRecording = false;
      hotkeyDisplay.classList.remove('recording');
      recordHotkeyBtn.disabled = false;
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      updateHotkeyDisplay(currentHotkey);
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const ocrLang = ocrLangSelect.value;
    const targetLang = targetLangSelect.value;

    chrome.storage.sync.set({
      ocrLang,
      targetLang,
      hotkey: currentHotkey
    }, () => {
      statusDiv.textContent = 'Settings saved!';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    });
  });
});
