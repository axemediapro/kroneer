// KRONEER - Sistem Menaxhimi i Lifteve (app.js)

// Utility për ngarkim dinamik dhe asinkron të skripteve vetëm kur kërkohen
window.loadScript = function(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true' || (src.includes('jsQR') && window.jsQR) || (src.includes('zxing') && window.ZXing) || (src.includes('JsBarcode') && window.JsBarcode) || (src.includes('chart') && window.Chart)) {
        return resolve();
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

window.ensureScannerLibraries = async function() {
  const promises = [];
  if (!window.jsQR) promises.push(window.loadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'));
  if (!window.ZXing) promises.push(window.loadScript('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'));
  if (promises.length > 0) await Promise.all(promises);
};

window.ensureJsBarcode = async function() {
  if (!window.JsBarcode) {
    await window.loadScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // 0. Rendo ikonat Lucide (data-lucide="...") në SVG
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // 1. Menaxhimi i Modalitetit të Ndritshëm / të Errët (Dark / Light Mode)
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');
  const html = document.documentElement;

  // Kontrollo preferencën e ruajtur (default është dark)
  const savedTheme = localStorage.getItem('kroneer_theme') || 'dark';
  if (savedTheme === 'light') {
    html.classList.remove('dark');
    html.classList.add('light');
  } else {
    html.classList.remove('light');
    html.classList.add('dark');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        html.classList.add('light');
        localStorage.setItem('kroneer_theme', 'light');
      } else {
        html.classList.remove('light');
        html.classList.add('dark');
        localStorage.setItem('kroneer_theme', 'dark');
      }
    });
  }

  // 2. Menaxhimi i Menysë Anësore në Celular (Mobile Sidebar Drawer)
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('main-sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');

  if (mobileMenuBtn && sidebar && sidebarBackdrop) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
      sidebarBackdrop.classList.toggle('hidden');
    });

    sidebarBackdrop.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      sidebarBackdrop.classList.add('hidden');
    });
  }

  // 3. Kërkimi Global me Shortcut (Ctrl+K ose Cmd+K)
  const searchModal = document.getElementById('search-modal');
  const searchInput = document.getElementById('global-search-input');
  const searchResultsContainer = document.getElementById('global-search-results');
  const searchTriggerBtn = document.getElementById('search-trigger-btn');
  const searchCloseBtn = document.getElementById('search-close-btn');
  const mobileSearchBtn = document.getElementById('mobile-search-btn');

  function openSearchModal() {
    if (searchModal) {
      searchModal.classList.remove('hidden');
      if (searchInput) {
        searchInput.focus();
        searchInput.value = '';
      }
      if (searchResultsContainer) {
        searchResultsContainer.innerHTML = '<p class="p-4 text-center text-sm text-slate-400">Shkruani për të kërkuar klientë, lifta, fatura, projekte...</p>';
      }
    }
  }

  function closeSearchModal() {
    if (searchModal) {
      searchModal.classList.add('hidden');
    }
  }

  if (searchTriggerBtn) {
    searchTriggerBtn.addEventListener('click', openSearchModal);
  }

  if (mobileSearchBtn) {
    mobileSearchBtn.addEventListener('click', openSearchModal);
  }

  if (searchCloseBtn) {
    searchCloseBtn.addEventListener('click', closeSearchModal);
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearchModal();
    }
    if (e.key === 'Escape' && searchModal && !searchModal.classList.contains('hidden')) {
      closeSearchModal();
    }
    if (e.key === 'Escape') {
      stopCameraScan();
    }
  });

  // 3.1 Skanimi me Kamerë ose Foto (QR / Barkod) - Universal Safari & Cross-Browser
  const scanBtn = document.getElementById('search-scan-btn');
  const scanOverlay = document.getElementById('barcode-scan-overlay');
  const scanChoice = document.getElementById('barcode-scan-choice');
  const scanChooseCameraBtn = document.getElementById('barcode-scan-choose-camera');
  const scanChooseFileBtn = document.getElementById('barcode-scan-choose-file');
  const scanFileInput = document.getElementById('barcode-scan-file-input');
  const scanCameraWrap = document.getElementById('barcode-scan-camera-wrap');
  const scanVideo = document.getElementById('barcode-scan-video');
  const scanCloseBtn = document.getElementById('barcode-scan-close-btn');
  const scanStatus = document.getElementById('barcode-scan-status');
  let scanStream = null;
  let scanLoopId = null;
  let zxingReaderInstance = null;

  function showScanStep(step) {
    if (scanChoice) scanChoice.classList.toggle('hidden', step !== 'choice');
    if (scanCameraWrap) scanCameraWrap.classList.toggle('hidden', step !== 'camera');
    if (scanStatus) scanStatus.classList.toggle('hidden', step === 'choice');
  }

  function openScanOverlay() {
    if (!scanOverlay) return;
    showScanStep('choice');
    scanOverlay.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  function stopCameraScan() {
    if (scanLoopId) {
      clearTimeout(scanLoopId);
      scanLoopId = null;
    }
    if (zxingReaderInstance) {
      try { zxingReaderInstance.reset(); } catch (e) {}
      zxingReaderInstance = null;
    }
    if (scanStream) {
      scanStream.getTracks().forEach(track => track.stop());
      scanStream = null;
    }
    if (scanVideo) {
      scanVideo.srcObject = null;
    }
    if (scanOverlay) scanOverlay.classList.add('hidden');
  }

  function useDetectedCode(value) {
    if (!value) return;
    stopCameraScan();
    openSearchModal();
    if (searchInput) {
      searchInput.value = value;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  async function startCameraScan() {
    if (!scanOverlay || !scanVideo) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showScanStep('camera');
      if (scanStatus) scanStatus.textContent = 'Qasja te kamera kërkon lidhje të sigurt (HTTPS) ose nuk mbështetet në këtë pajisje.';
      return;
    }

    try {
      showScanStep('camera');
      if (scanStatus) scanStatus.textContent = 'Duke ngarkuar modulin e skanimit...';
      await window.ensureScannerLibraries();

      scanVideo.setAttribute('playsinline', 'true');
      scanVideo.setAttribute('webkit-playsinline', 'true');
      scanVideo.muted = true;

      scanStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      scanVideo.srcObject = scanStream;
      showScanStep('camera');
      if (scanStatus) scanStatus.textContent = 'Vendosni kodin brenda kornizës...';
      await scanVideo.play();

      // Motori 1: BarcodeDetector i integruar (Chrome / Android)
      let nativeDetector = null;
      if ('BarcodeDetector' in window) {
        try {
          nativeDetector = new window.BarcodeDetector({
            formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'upc_a', 'upc_e']
          });
        } catch (e) {}
      }

      // Motori 2 & 3: Canvas decoding (Safari iOS / macOS / Firefox me jsQR & ZXing)
      const offCanvas = document.createElement('canvas');
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

      const scanFrame = async () => {
        if (!scanStream || scanVideo.readyState < 2) {
          scanLoopId = setTimeout(scanFrame, 200);
          return;
        }

        try {
          // A. Provë me BarcodeDetector
          if (nativeDetector) {
            const results = await nativeDetector.detect(scanVideo);
            if (results && results.length > 0 && results[0].rawValue) {
              useDetectedCode(results[0].rawValue);
              return;
            }
          }

          // B. Provë me jsQR në canvas (100% funksional në Safari iOS/Mac)
          const vw = scanVideo.videoWidth || 640;
          const vh = scanVideo.videoHeight || 480;
          if (vw > 0 && vh > 0) {
            offCanvas.width = vw;
            offCanvas.height = vh;
            offCtx.drawImage(scanVideo, 0, 0, vw, vh);

            if (window.jsQR) {
              const imgData = offCtx.getImageData(0, 0, vw, vh);
              const qrResult = window.jsQR(imgData.data, vw, vh, { inversionAttempts: 'attemptBoth' });
              if (qrResult && qrResult.data) {
                useDetectedCode(qrResult.data);
                return;
              }
            }

            // C. Provë me ZXing (për barkode 1D)
            if (window.ZXing && !zxingReaderInstance) {
              try {
                if (!zxingReaderInstance) {
                  zxingReaderInstance = new window.ZXing.BrowserMultiFormatReader();
                }
                const zxResult = await zxingReaderInstance.decodeFromCanvas(offCanvas);
                if (zxResult && zxResult.getText()) {
                  useDetectedCode(zxResult.getText());
                  return;
                }
              } catch (zxErr) {}
            }
          }
        } catch (err) {
          // vazhdo te korniza tjetër pa u bllokuar
        }

        scanLoopId = setTimeout(scanFrame, 250);
      };

      scanFrame();
    } catch (err) {
      console.error('Gabim qasjeje në kamerë:', err);
      showScanStep('camera');
      if (scanStatus) scanStatus.textContent = 'Nuk u arrit qasja te kamera. Ju lutem lejoni qasjen te cilësimet e shfletuesit.';
    }
  }

  async function scanFromFile(file) {
    if (!file) return;
    showScanStep('camera');
    if (scanStatus) {
      scanStatus.classList.remove('hidden');
      scanStatus.textContent = 'Duke ngarkuar skanerin...';
    }

    await window.ensureScannerLibraries();

    if (scanStatus) {
      scanStatus.textContent = 'Duke analizuar foton...';
    }

    const reader = new FileReader();
    reader.onerror = () => {
      if (scanStatus) scanStatus.textContent = 'Gabim gjatë leximit të skedarit.';
    };

    reader.onload = async (event) => {
      const img = new Image();
      img.onerror = () => {
        if (scanStatus) scanStatus.textContent = 'Skedari i zgjedhur nuk është një foto e vlefshme.';
      };

      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);

          // 1. Lexim QR me jsQR (Punon në të gjithë shfletuesit përfshirë Safari iOS/Mac)
          if (window.jsQR) {
            const imgData = ctx.getImageData(0, 0, w, h);
            const qrCode = window.jsQR(imgData.data, w, h, {
              inversionAttempts: 'attemptBoth'
            });
            if (qrCode && qrCode.data) {
              useDetectedCode(qrCode.data);
              return;
            }
          }

          // 2. Lexim me ZXing (Barkode 1D & QR)
          if (window.ZXing) {
            try {
              const zxing = new window.ZXing.BrowserMultiFormatReader();
              const zxRes = await zxing.decodeFromCanvas(canvas);
              if (zxRes && zxRes.getText()) {
                useDetectedCode(zxRes.getText());
                return;
              }
            } catch (zxErr) {}
          }

          // 3. Lexim me BarcodeDetector nëse mbështetet
          if ('BarcodeDetector' in window) {
            try {
              const detector = new window.BarcodeDetector({
                formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'upc_a', 'upc_e']
              });
              const results = await detector.detect(canvas);
              if (results && results.length > 0 && results[0].rawValue) {
                useDetectedCode(results[0].rawValue);
                return;
              }
            } catch (detErr) {}
          }

          if (scanStatus) {
            scanStatus.textContent = 'Nuk u gjet asnjë QR/Barkod në këtë foto. Ju lutem provoni një foto më të qartë.';
          }
        } catch (err) {
          console.error('Gabim gjatë përpunimit të fotos:', err);
          if (scanStatus) {
            scanStatus.textContent = 'Ndodhi një problem gjatë përpunimit të fotos.';
          }
        }
      };

      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  }

  if (scanBtn) {
    scanBtn.addEventListener('click', openScanOverlay);
  }
  if (scanChooseCameraBtn) {
    scanChooseCameraBtn.addEventListener('click', startCameraScan);
  }
  if (scanChooseFileBtn && scanFileInput) {
    scanChooseFileBtn.addEventListener('click', () => scanFileInput.click());
    scanFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      scanFromFile(file);
      scanFileInput.value = '';
    });
  }
  if (scanCloseBtn) {
    scanCloseBtn.addEventListener('click', stopCameraScan);
  }

  // 3.2 Skanim me lexues fizik (USB/Bluetooth barcode scanner) - hap kërkimin automatikisht
  // Skanerët "shkruajnë" karaktere shumë shpejt (< 60ms hop-pas-hopi) e ndjekur nga Enter,
  // ndryshe nga shtypja normale e njeriut - kjo dallon skanimin nga shtypja e rregullt.
  let hwScanBuffer = '';
  let hwScanLastTime = 0;
  const HW_SCAN_MAX_GAP_MS = 60;
  const HW_SCAN_MIN_LENGTH = 4;

  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const isOtherEditable = active && active !== searchInput &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);

    if (isOtherEditable) {
      hwScanBuffer = '';
      return;
    }

    const now = Date.now();
    const gap = now - hwScanLastTime;
    hwScanLastTime = now;

    if (e.key === 'Enter') {
      if (hwScanBuffer.length >= HW_SCAN_MIN_LENGTH && active !== searchInput) {
        e.preventDefault();
        openSearchModal();
        if (searchInput) {
          searchInput.value = hwScanBuffer;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      hwScanBuffer = '';
      return;
    }

    if (e.key.length !== 1) return;
    hwScanBuffer = gap > HW_SCAN_MAX_GAP_MS ? e.key : hwScanBuffer + e.key;
  });

  // Kërkimi Live AJAX
  let searchDebounceTimer = null;
  if (searchInput && searchResultsContainer) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(searchDebounceTimer);

      if (q.length < 2) {
        searchResultsContainer.innerHTML = '<p class="p-4 text-center text-sm text-slate-400">Shkruani të paktën 2 karaktere...</p>';
        return;
      }

      searchResultsContainer.innerHTML = '<div class="p-4 text-center text-sm text-slate-400 flex items-center justify-center gap-2"><div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div> Duke kërkuar...</div>';

      searchDebounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/kerko?q=${encodeURIComponent(q)}`);
          const data = await res.json();

          if (!data.items || data.items.length === 0) {
            searchResultsContainer.innerHTML = `<div class="p-6 text-center text-slate-400 text-sm">Nuk u gjet asnjë rezultat për "<strong>${q}</strong>"</div>`;
            return;
          }

          let html = '<div class="divide-y divide-slate-800">';
          data.items.forEach(item => {
            html += `
              <a href="${item.url}" class="flex items-center justify-between p-3.5 hover:bg-slate-800/80 transition-colors">
                <div class="flex items-center gap-3">
                  <span class="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">${item.category}</span>
                  <div>
                    <h4 class="font-medium text-slate-200 text-sm">${item.title}</h4>
                    <p class="text-xs text-slate-400">${item.subtitle}</p>
                  </div>
                </div>
                <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </a>
            `;
          });
          html += `
            <div class="p-2.5 bg-slate-900/50 text-center">
              <a href="/kerko?q=${encodeURIComponent(q)}" class="text-xs text-amber-400 hover:text-amber-300 font-medium">Shiko të gjitha rezultatet e detajuara &rarr;</a>
            </div>
          </div>`;
          searchResultsContainer.innerHTML = html;
        } catch (err) {
          searchResultsContainer.innerHTML = '<p class="p-4 text-center text-sm text-rose-400">Gabim gjatë kërkimit.</p>';
        }
      }, 250);
    });
  }

  // 4. Mbyllja automatike e mesazheve njoftuese (Flash messages)
  const flashAlerts = document.querySelectorAll('.flash-alert');
  flashAlerts.forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s ease';
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 500);
    }, 5000);
  });
});

// Funksione Ndihmëse Globale

// Komponent Alpine i ripërdorshëm: popup për shtim të shpejtë të klientit (Individ / Biznes Privat)
// kudo që zgjidhet klienti (fatura, oferta, kontrata, projekte, etj.). Kërkon një <select x-ref="customerSelect">
// brenda të njëjtit x-data.
function quickCustomerModal() {
  return {
    isOpen: false,
    saving: false,
    error: '',
    discountGroups: [
      { name: 'Standard', percent: 0 },
      { name: 'Bronz', percent: 5 },
      { name: 'Argjend', percent: 10 },
      { name: 'Ar', percent: 15 },
      { name: 'VIP/Partner', percent: 20 }
    ],
    form: {},
    defaultForm() {
      return {
        kind: 'biznes', firstName: '', lastName: '', companyName: '', contactPerson: '',
        taxNumber: '', businessNumber: '', phone: '', email: '', city: '', address: '',
        discountGroup: 'Standard', discountPercent: 0
      };
    },
    applyDiscountGroup() {
      const g = this.discountGroups.find(g => g.name === this.form.discountGroup);
      if (g) this.form.discountPercent = g.percent;
    },
    openModal() {
      this.form = this.defaultForm();
      this.error = '';
      this.isOpen = true;
    },
    closeModal() {
      this.isOpen = false;
    },
    async saveCustomer() {
      const isIndivid = this.form.kind === 'individ';
      if (isIndivid && (!this.form.firstName.trim() || !this.form.lastName.trim())) {
        this.error = 'Emri dhe Mbiemri janë të detyrueshëm.';
        return;
      }
      if (!isIndivid && !this.form.companyName.trim()) {
        this.error = 'Emri i kompanisë/klientit është i detyrueshëm.';
        return;
      }
      this.saving = true;
      this.error = '';
      try {
        const res = await fetch('/klientet/api/krijo-shpejte', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.form)
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          this.error = data.message || 'Ndodhi një gabim gjatë ruajtjes.';
          return;
        }
        const select = this.$refs.customerSelect;
        const option = document.createElement('option');
        option.value = data.customer.id;
        option.textContent = `${data.customer.companyName} (${data.customer.code})`;
        select.appendChild(option);
        select.value = data.customer.id;
        select.dispatchEvent(new Event('change'));
        this.isOpen = false;
      } catch (err) {
        this.error = 'Ndodhi një gabim në lidhje me serverin.';
      } finally {
        this.saving = false;
      }
    }
  };
}

// Komponent Alpine i ripërdorshëm: modal për QR Code / Barkod të një numri serik
// (shkarkim si imazh ose printim direkt). Përdor <canvas x-ref="barcodeCanvas"> për barkodin.
function serialCodeModal() {
  return {
    isOpen: false,
    serial: '',
    qrImg: '',
    codeType: 'qr',
    open(serial, qrImg) {
      this.serial = serial;
      this.qrImg = qrImg;
      this.codeType = 'qr';
      this.isOpen = true;
    },
    close() {
      this.isOpen = false;
    },
    setType(type) {
      this.codeType = type;
      if (type === 'barcode') {
        this.$nextTick(() => this.renderBarcode());
      }
    },
    async renderBarcode() {
      const canvas = this.$refs.barcodeCanvas;
      if (!canvas) return;
      if (!window.JsBarcode && window.ensureJsBarcode) {
        await window.ensureJsBarcode();
      }
      if (canvas && window.JsBarcode) {
        window.JsBarcode(canvas, this.serial, {
          format: 'CODE128',
          displayValue: true,
          fontSize: 14,
          height: 60,
          margin: 8
        });
      }
    },
    downloadBarcode() {
      const canvas = this.$refs.barcodeCanvas;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${this.serial}-barcode.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    },
    printCode() {
      const src = this.codeType === 'qr' ? this.qrImg : this.$refs.barcodeCanvas.toDataURL('image/png');
      const printWin = window.open('', '_blank', 'width=420,height=520');
      if (!printWin) return;
      printWin.document.title = this.serial;
      const style = printWin.document.createElement('style');
      style.textContent = 'body{font-family:sans-serif;text-align:center;padding:30px;} img{max-width:280px;} p{font-weight:bold;font-size:16px;margin-top:14px;letter-spacing:1px;}';
      printWin.document.head.appendChild(style);
      const img = printWin.document.createElement('img');
      img.src = src;
      const p = printWin.document.createElement('p');
      p.textContent = this.serial;
      printWin.document.body.appendChild(img);
      printWin.document.body.appendChild(p);
      img.onload = () => {
        printWin.focus();
        printWin.print();
      };
    }
  };
}

// 3.3 Modal global i Pamjes së Shpejtë (Quick View) - përdoret nga listat (Ofertat, Faturat, etj.)
(function initQuickViewModal() {
  const modal = document.getElementById('quick-view-modal');
  const closeBtn = document.getElementById('quick-view-close-btn');
  if (!modal) return;

  document.addEventListener('click', (e) => {
    if (e.target === modal) closeQuickView();
  });
  if (closeBtn) closeBtn.addEventListener('click', closeQuickView);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeQuickView();
  });
})();

function openQuickView(payload) {
  const modal = document.getElementById('quick-view-modal');
  if (!modal) return;

  const title = document.getElementById('qv-title');
  const subtitle = document.getElementById('qv-subtitle');
  const statusWrap = document.getElementById('qv-status-wrap');
  const rowsEl = document.getElementById('qv-rows');
  const viewLink = document.getElementById('qv-view-link');
  const editLink = document.getElementById('qv-edit-link');
  const printLink = document.getElementById('qv-print-link');

  if (title) title.textContent = payload.title || '';
  if (subtitle) subtitle.textContent = payload.subtitle || '';

  if (statusWrap) {
    statusWrap.innerHTML = '';
    if (payload.statusLabel) {
      const span = document.createElement('span');
      span.className = `inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${payload.statusClass || 'bg-slate-800 text-slate-300 border-slate-700'}`;
      span.textContent = payload.statusLabel;
      statusWrap.appendChild(span);
    }
  }

  if (rowsEl) {
    rowsEl.innerHTML = '';
    (payload.rows || []).forEach(row => {
      const dt = document.createElement('dt');
      dt.className = 'text-slate-500 font-semibold';
      dt.textContent = row.label;
      const dd = document.createElement('dd');
      dd.className = 'text-slate-200 font-medium text-right';
      dd.textContent = row.value;
      rowsEl.appendChild(dt);
      rowsEl.appendChild(dd);
    });
  }

  if (viewLink) viewLink.href = payload.viewUrl || '#';
  if (editLink) {
    if (payload.editUrl) {
      editLink.href = payload.editUrl;
      editLink.classList.remove('hidden');
    } else {
      editLink.classList.add('hidden');
    }
  }
  if (printLink) {
    if (payload.printUrl) {
      printLink.href = payload.printUrl;
      printLink.classList.remove('hidden');
    } else {
      printLink.classList.add('hidden');
    }
  }

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeQuickView() {
  const modal = document.getElementById('quick-view-modal');
  if (modal) modal.classList.add('hidden');
}

function markNotificationRead(id) {
  fetch(`/api/njoftimet/lexo/${id}`, { method: 'POST' })
    .then(res => res.json())
    .then(() => {
      const el = document.getElementById(`notif-${id}`);
      if (el) el.remove();
      const countBadge = document.getElementById('notif-badge-count');
      if (countBadge) {
        let current = parseInt(countBadge.innerText) || 0;
        if (current > 1) {
          countBadge.innerText = current - 1;
        } else {
          countBadge.remove();
        }
      }
    });
}

function markAllNotificationsRead() {
  fetch('/api/njoftimet/lexo-te-gjitha', { method: 'POST' })
    .then(res => res.json())
    .then(() => {
      const list = document.getElementById('notifications-list');
      if (list) list.innerHTML = '<p class="p-4 text-center text-xs text-slate-400">Nuk keni njoftime të reja.</p>';
      const countBadge = document.getElementById('notif-badge-count');
      if (countBadge) countBadge.remove();
    });
}

// 5. Instant Fast Page Transitions & Link Prefetching (AJAX Fast Response Time)
(function initInstantNavigation() {
  const pageCache = new Map();
  const prefetchingUrls = new Set();

  function isValidNavigationLink(el) {
    if (!el || el.tagName !== 'A') return false;
    const href = el.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (el.target && el.target !== '_self') return false;
    if (el.hasAttribute('download')) return false;
    if (href.includes('/dil') || href.includes('/print') || href.includes('-pdf') || href.includes('/backup')) return false;
    
    try {
      const url = new URL(href, window.location.origin);
      return url.origin === window.location.origin;
    } catch (e) {
      return false;
    }
  }

  function prefetchUrl(url) {
    if (pageCache.has(url) || prefetchingUrls.has(url) || pageCache.size > 12) return;
    prefetchingUrls.add(url);
    fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(res => {
        if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
          return res.text();
        }
        return null;
      })
      .then(html => {
        if (html) pageCache.set(url, html);
      })
      .catch(() => {})
      .finally(() => prefetchingUrls.delete(url));
  }

  let prefetchTimer = null;
  document.addEventListener('pointerenter', (e) => {
    const link = e.target.closest('a');
    if (!isValidNavigationLink(link)) return;
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(() => prefetchUrl(link.href), 350);
  }, { capture: true, passive: true });

  async function navigateTo(url, pushState = true) {
    let html = pageCache.get(url);
    
    // Top loader bar
    let bar = document.getElementById('fast-nav-loader');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'fast-nav-loader';
      bar.className = 'fixed top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 z-[9999] transition-all duration-200 shadow-md shadow-amber-500/50';
      document.body.appendChild(bar);
    }
    bar.style.width = '35%';
    bar.style.opacity = '1';

    if (!html) {
      try {
        bar.style.width = '65%';
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) {
          window.location.href = url;
          return;
        }
        html = await res.text();
        pageCache.set(url, html);
      } catch (err) {
        window.location.href = url;
        return;
      }
    }

    bar.style.width = '100%';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const newMain = doc.querySelector('main');
    const curMain = document.querySelector('main');

    if (newMain && curMain) {
      curMain.innerHTML = newMain.innerHTML;
      if (doc.title) document.title = doc.title;

      if (pushState) {
        window.history.pushState({ url }, '', url);
      }

      // Update active links on sidebar & mobile navbar
      const newPath = new URL(url, window.location.origin).pathname;
      document.querySelectorAll('#main-sidebar a, #mobile-bottom-navbar a').forEach(a => {
        const aPath = a.getAttribute('href');
        if (!aPath) return;
        const isActive = (aPath === newPath) || (aPath !== '/paneli' && aPath !== '/' && newPath.startsWith(aPath));
        a.classList.toggle('text-amber-400', isActive);
        if (a.closest('#main-sidebar')) {
          a.classList.toggle('bg-amber-500/15', isActive);
          a.classList.toggle('border-amber-500/30', isActive);
        }
      });

      // Close mobile drawer if open
      const sidebar = document.getElementById('main-sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (sidebar && backdrop) {
        sidebar.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
      }

      // Re-run inline scripts in newMain
      newMain.querySelectorAll('script').forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });

      // Re-run Lucide Icons
      if (window.lucide) window.lucide.createIcons();

      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      window.location.href = url;
    }

    setTimeout(() => {
      if (bar) {
        bar.style.opacity = '0';
        setTimeout(() => { if (bar) bar.style.width = '0%'; }, 200);
      }
    }, 150);
  }

  // Intercept click on internal links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link || !isValidNavigationLink(link)) return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    
    e.preventDefault();
    navigateTo(link.href, true);
  });

  // Handle browser back / forward
  window.addEventListener('popstate', () => {
    navigateTo(window.location.href, false);
  });
})();
