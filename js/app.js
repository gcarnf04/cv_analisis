document.addEventListener('DOMContentLoaded', () => {

  // PDF.js global setup
  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

  // DOM Elements - Vault
  const btnToggleApiKey = document.getElementById('btnToggleApiKey');
  const setupModal = document.getElementById('setupModal');
  const loginModal = document.getElementById('loginModal');
  const modalApiKeyInput = document.getElementById('modalApiKeyInput');
  const statusDot = document.getElementById('statusDot');
  const statusLabel = document.getElementById('statusLabel');
  const modalError = document.getElementById('modalError');
  const loginError = document.getElementById('loginError');
  const btnSaveKey = document.getElementById('btnSaveKey');
  const btnClearKey = document.getElementById('btnClearKey');
  const btnUnlock = document.getElementById('btnUnlock');
  const btnToggleApiKeyVis = document.getElementById('btnToggleApiKeyVis');

  const setupPins = [...document.querySelectorAll('#setupModal .pin-input')];
  const loginPins = [...document.querySelectorAll('#loginModal .pin-input')];

  // DOM Elements - App UI
  const heroSection = document.getElementById('heroSection');
  const uploadSection = document.getElementById('uploadSection');
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const fileInfoBar = document.getElementById('fileInfoBar');
  const fileNameEl = document.getElementById('fileName');
  const fileStatEl = document.getElementById('fileStat');
  const btnRemoveFile = document.getElementById('btnRemoveFile');
  const previewSection = document.getElementById('previewSection');
  const textPreviewBox = document.getElementById('textPreviewBox');
  const btnAnalyze = document.getElementById('btnAnalyze');
  const ctaHint = document.getElementById('ctaHint');
  const adMid = document.getElementById('adMid');
  const loadingSection = document.getElementById('loadingSection');
  const loadingStatus = document.getElementById('loadingStatus');
  const loadingBarFill = document.getElementById('loadingBarFill');
  const btnCancelAnalysis = document.getElementById('btnCancelAnalysis');
  const resultsSection = document.getElementById('resultsSection');
  const gaugeScore = document.getElementById('gaugeScore');
  const gaugeFill = document.getElementById('gaugeFill');
  const scoreVerdict = document.getElementById('scoreVerdict');
  const diagnosisBody = document.getElementById('diagnosisBody');
  const btnCopyReport = document.getElementById('btnCopyReport');
  const btnNewSession = document.getElementById('btnNewSession');

  // DOM Elements - Interstitial Ad
  const interstitialAdModal = document.getElementById('interstitialAdModal');
  const adCountdownText = document.getElementById('adCountdownText');
  const btnSkipAd = document.getElementById('btnSkipAd');

  // App State
  let selectedFile = null;
  let extractedText = "";
  let fullDiagnosticReport = "";
  let currentScore = null;
  let adCountdownVal = 5;
  let adTimer = null;

  /* ══════════════════════════════════════════════════════ VAULT STATE ═══ */
  function initPinInputs(inputs) {
    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '').slice(-1);
        if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
      });
    });
  }
  initPinInputs(setupPins);
  initPinInputs(loginPins);

  btnToggleApiKeyVis.addEventListener('click', () => {
    const isPass = modalApiKeyInput.type === 'password';
    modalApiKeyInput.type = isPass ? 'text' : 'password';
  });

  // Language switcher setup
  const langSelect = document.querySelector('.lang-select');
  if (langSelect) {
    langSelect.value = Lang.get();
    langSelect.addEventListener('change', (e) => {
      Lang.set(e.target.value);
    });
  }
  window.addEventListener('langchange', () => {
    updateVaultUI();
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      updateFileInfoBar(selectedFile);
    }
  });

  function updateVaultUI() {
    const hasKey = Vault.hasStoredKey();
    const unlocked = Vault.isUnlocked();
    const lang = Lang.get();

    if (unlocked) {
      statusDot.className = "status-dot active";
      statusLabel.textContent = lang === 'es' ? "Clave API Activa" : "API Key Active";
      btnToggleApiKey.textContent = lang === 'es' ? "Gestionar Clave" : "Manage Key";
      btnAnalyze.disabled = !extractedText;
      ctaHint.style.display = 'none';
    } else if (hasKey) {
      statusDot.className = "status-dot error";
      statusLabel.textContent = lang === 'es' ? "Bloqueado" : "Locked";
      btnToggleApiKey.textContent = lang === 'es' ? "Desbloquear" : "Unlock Key";
      btnAnalyze.disabled = true;
      ctaHint.style.display = 'block';
      ctaHint.textContent = lang === 'es' ? "Desbloquea tu clave API para auditar" : "Unlock your API key to audit";
    } else {
      statusDot.className = "status-dot";
      statusLabel.textContent = lang === 'es' ? "Sin clave API" : "No API key";
      btnToggleApiKey.textContent = lang === 'es' ? "Configurar clave" : "Set key";
      btnAnalyze.disabled = true;
      ctaHint.style.display = 'block';
      ctaHint.textContent = lang === 'es' ? "Configura una clave API de Gemini para auditar" : "Provide a Gemini API Key to enable auditing";
    }
  }

  btnToggleApiKey.addEventListener('click', () => {
    if (Vault.hasStoredKey() && !Vault.isUnlocked()) {
      loginModal.removeAttribute('hidden');
      loginError.textContent = '';
      loginPins.forEach(p => p.value = '');
      setTimeout(() => loginPins[0].focus(), 50);
    } else {
      setupModal.removeAttribute('hidden');
      setupError.textContent = '';
      modalApiKeyInput.value = '';
      setupPins.forEach(p => p.value = '');
      if (Vault.hasStoredKey()) {
        btnClearKey.style.display = 'block';
      } else {
        btnClearKey.style.display = 'none';
      }
      setTimeout(() => modalApiKeyInput.focus(), 50);
    }
  });

  window.closeSetupModal = () => { setupModal.setAttribute('hidden', ''); };
  window.closeLoginModal = () => { loginModal.setAttribute('hidden', ''); };

  btnSaveKey.addEventListener('click', () => {
    const key = modalApiKeyInput.value.trim();
    const pin = setupPins.map(p => p.value).join('');
    if (!GeminiAPI.validateKeyFormat(key)) {
      modalError.textContent = 'Invalid API key format. Key must start with AIzaSy.';
      return;
    }
    if (pin.length !== 4) {
      modalError.textContent = 'Please create a 4-digit security PIN.';
      return;
    }

    if (Vault.saveKey(key, pin)) {
      closeSetupModal();
      updateVaultUI();
    } else {
      modalError.textContent = 'Failed to save key securely.';
    }
  });

  btnUnlock.addEventListener('click', () => {
    const pin = loginPins.map(p => p.value).join('');
    if (pin.length !== 4) {
      loginError.textContent = 'Enter your 4-digit PIN.';
      return;
    }

    const key = Vault.loadKey(pin);
    if (key) {
      closeLoginModal();
      updateVaultUI();
    } else {
      loginError.textContent = 'Incorrect PIN.';
    }
  });

  btnClearKey.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete your saved API Key?')) {
      Vault.clearKey();
      closeSetupModal();
      updateVaultUI();
    }
  });

  /* ══════════════════════════════════════════════════ FILE PARSING ═══ */
  function updateFileInfoBar(file) {
    fileNameEl.textContent = file.name;
    const sizeKB = Math.round(file.size / 1024);
    fileStatEl.textContent = `${sizeKB} KB`;
    fileInfoBar.removeAttribute('hidden');
    uploadSection.style.display = 'none';
  }

  function handleFileSelection(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const lang = Lang.get();
    if (ext !== 'pdf' && ext !== 'docx') {
      const msg = lang === 'es' 
        ? 'Formato de archivo no soportado. Por favor sube un archivo PDF o DOCX.' 
        : 'Unsupported file format. Please upload a PDF or DOCX file.';
      alert(msg);
      return;
    }

    selectedFile = file;
    updateFileInfoBar(file);

    heroSection.style.display = 'none';
    previewSection.removeAttribute('hidden');
    textPreviewBox.textContent = lang === 'es' ? "Cargando y extrayendo texto localmente..." : "Loading and extracting text locally...";
    btnAnalyze.disabled = true;

    const reader = new FileReader();

    if (ext === 'pdf') {
      reader.onload = async function() {
        try {
          const typedarray = new Uint8Array(this.result);
          const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
          }
          extractedText = text.trim();
          if (!extractedText) {
            textPreviewBox.textContent = lang === 'es'
              ? "Advertencia: No se pudo extraer texto seleccionable del PDF. Podría estar escaneado o vacío."
              : "Warning: No selectable text could be extracted from this PDF. It might be scanned or empty.";
          } else {
            textPreviewBox.textContent = extractedText.slice(0, 1000) + (extractedText.length > 1000 ? "\n\n[... Truncated for preview ...]" : "");
          }
          if (Vault.isUnlocked()) btnAnalyze.disabled = !extractedText;
        } catch (e) {
          textPreviewBox.textContent = (lang === 'es' ? "Error al leer PDF: " : "Error reading PDF file: ") + e.message;
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'docx') {
      reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        mammoth.extractRawText({arrayBuffer: arrayBuffer})
          .then(function(result) {
            extractedText = result.value.trim();
            if (!extractedText) {
              textPreviewBox.textContent = lang === 'es'
                ? "Advertencia: El archivo de Word parece estar vacío."
                : "Warning: The Word file appears to be empty.";
            } else {
              textPreviewBox.textContent = extractedText.slice(0, 1000) + (extractedText.length > 1000 ? "\n\n[... Truncated for preview ...]" : "");
            }
            if (Vault.isUnlocked()) btnAnalyze.disabled = !extractedText;
          })
          .catch(function(err) {
            textPreviewBox.textContent = (lang === 'es' ? "Error al leer Word: " : "Error reading Word file: ") + err.message;
          });
      };
      reader.readAsArrayBuffer(file);
    }
  }

  // Drag and drop event listeners
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, e => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });
  dropZone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    handleFileSelection(file);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    handleFileSelection(fileInput.files[0]);
  });

  btnRemoveFile.addEventListener('click', resetSession);

  function resetSession() {
    selectedFile = null;
    extractedText = "";
    fullDiagnosticReport = "";
    currentScore = null;
    
    fileInput.value = "";
    fileInfoBar.setAttribute('hidden', '');
    previewSection.setAttribute('hidden', '');
    resultsSection.setAttribute('hidden', '');
    loadingSection.setAttribute('hidden', '');
    adMid.setAttribute('hidden', '');
    uploadSection.style.display = 'block';
    heroSection.style.display = 'block';
    updateVaultUI();
  }

  /* ═════════════════════════════════════════════════ INTERSTITIAL ═══ */
  function startInterstitialAd(onAdFinished) {
    interstitialAdModal.removeAttribute('hidden');
    adCountdownVal = 5;
    btnSkipAd.disabled = true;
    const lang = Lang.get();
    btnSkipAd.textContent = lang === 'es' ? `Por favor espera ${adCountdownVal}s...` : `Please wait ${adCountdownVal}s...`;

    adTimer = setInterval(() => {
      adCountdownVal--;
      if (adCountdownVal > 0) {
        btnSkipAd.textContent = lang === 'es' ? `Por favor espera ${adCountdownVal}s...` : `Please wait ${adCountdownVal}s...`;
      } else {
        clearInterval(adTimer);
        adCountdownText.textContent = lang === 'es' ? "Anuncio finalizado" : "Ad Finished";
        btnSkipAd.disabled = false;
        btnSkipAd.textContent = lang === 'es' ? "Saltar anuncio y ver auditoría" : "Skip Ad & View Audit";
      }
    }, 1000);

    btnSkipAd.onclick = () => {
      interstitialAdModal.setAttribute('hidden', '');
      onAdFinished();
    };
  }

  /* ═════════════════════════════════════════════════ AI AUDIT ═══════ */
  btnAnalyze.addEventListener('click', () => {
    if (!Vault.isUnlocked() || !extractedText) return;

    previewSection.setAttribute('hidden', '');
    fileInfoBar.setAttribute('hidden', '');
    adMid.removeAttribute('hidden');

    startInterstitialAd(() => {
      runAIEvaluation();
    });
  });

  function runAIEvaluation() {
    loadingSection.removeAttribute('hidden');
    const lang = Lang.get();
    loadingStatus.textContent = lang === 'es' ? "Analizando contenido del currículum..." : "Analyzing resume content...";
    loadingBarFill.style.width = "20%";

    const apiKey = Vault.getUnlockedKey();
    fullDiagnosticReport = "";
    diagnosisBody.innerHTML = '<span class="cursor"></span>';
    scoreVerdict.textContent = "";
    gaugeScore.textContent = "—";
    updateGauge(0);

    GeminiAPI.callWithStreaming(
      extractedText,
      apiKey,
      {
        onToken: (token) => {
          if (loadingSection.style.display !== 'none') {
            loadingSection.setAttribute('hidden', '');
            resultsSection.removeAttribute('hidden');
          }
          fullDiagnosticReport += token;
          diagnosisBody.innerHTML = marked.parse(fullDiagnosticReport) + '<span class="cursor"></span>';
          
          // Live extract score if ready
          const score = GeminiAPI.extractScore(fullDiagnosticReport);
          if (score !== null) {
            gaugeScore.textContent = score;
            updateGauge(score);
          }
        },
        onStatus: (msg, pct) => {
          loadingStatus.textContent = msg;
          loadingBarFill.style.width = `${pct}%`;
        },
        onDone: (cancelled) => {
          // Remove streaming cursor
          const cursor = diagnosisBody.querySelector('.cursor');
          if (cursor) cursor.remove();

          if (cancelled) {
            resetSession();
            return;
          }

          // Final score check
          const score = GeminiAPI.extractScore(fullDiagnosticReport) || 0;
          gaugeScore.textContent = score;
          updateGauge(score);

          // Render direct verdict
          scoreVerdict.textContent = getVerdictSummary(score);
        },
        onError: (err) => {
          loadingSection.setAttribute('hidden', '');
          resultsSection.removeAttribute('hidden');
          diagnosisBody.innerHTML = `<p style="color:var(--red); font-weight:600;">Error: ${err}</p>`;
        }
      }
    );
  }

  btnCancelAnalysis.addEventListener('click', () => {
    GeminiAPI.cancel();
    resetSession();
  });

  btnNewSession.addEventListener('click', resetSession);

  btnCopyReport.addEventListener('click', () => {
    const lang = Lang.get();
    navigator.clipboard.writeText(fullDiagnosticReport)
      .then(() => alert(lang === 'es' ? '¡Informe de auditoría copiado como Markdown!' : 'Audit report copied as Markdown!'))
      .catch(() => alert(lang === 'es' ? 'Error al copiar. Selecciona el texto manualmente.' : 'Failed to copy. Please select the text manually.'));
  });

  /* ── Score gauge rendering ───────────────────────────── */
  function updateGauge(score) {
    // Circumference of half-circle track is approx 251.2
    const totalCircumference = 251.2;
    const offset = totalCircumference - (totalCircumference * (score / 100));
    gaugeFill.style.strokeDashoffset = offset;
    
    // Dynamically change gauge color based on score
    if (score < 40) {
      gaugeFill.style.stroke = "var(--red)";
    } else if (score < 70) {
      gaugeFill.style.stroke = "var(--yellow)";
    } else {
      gaugeFill.style.stroke = "var(--green)";
    }
  }

  function getVerdictSummary(score) {
    const lang = Lang.get();
    if (score < 45) {
      return lang === 'es' 
        ? "Reescritura crítica necesaria. Este currículum te está impidiendo conseguir entrevistas de forma activa." 
        : "Critical rewrite needed. This resume is actively preventing you from getting interviews.";
    } else if (score < 75) {
      return lang === 'es'
        ? "Currículum promedio. Conseguirá algunas visualizaciones, pero necesita ajustes fuertes basados en métricas para destacar."
        : "Average resume. It will get some views, but needs strong metric-driven adjustments to stand out.";
    } else {
      return lang === 'es'
        ? "Excelente estructura de perfil. Se recomienda pulido mínimo para asegurar roles de primer nivel."
        : "Excellent profile structure. Minimal polish recommended to secure top-tier roles.";
    }
  }

  // Init
  updateVaultUI();
});
