// KRONEER - Konfiguruesi Interaktiv i Lifteve (configurator.js)

document.addEventListener('DOMContentLoaded', () => {
  let currentStep = 1;
  const totalSteps = 10;

  // Çmimet bazë sipas llojit dhe kapacitetit
  const baseRates = {
    'Lift pasagjerësh': { 300: 16000, 450: 18500, 630: 22500, 800: 26000, 1000: 31000, 1275: 35000, 1600: 39000, 2000: 44000, 2500: 49000 },
    'Lift shtëpiak': { 300: 14500, 450: 18900, 630: 21000, 800: 24000, 1000: 27000, 1275: 30000, 1600: 34000, 2000: 38000, 2500: 42000 },
    'Lift panoramik': { 300: 24000, 450: 29000, 630: 36000, 800: 41000, 1000: 46000, 1275: 52000, 1600: 59000, 2000: 67000, 2500: 75000 },
    'Lift mallrash': { 300: 18000, 450: 21000, 630: 25000, 800: 29000, 1000: 33000, 1275: 35500, 1600: 37000, 2000: 38000, 2500: 45000 },
    'Lift spitalor': { 300: 22000, 450: 26000, 630: 30000, 800: 34000, 1000: 36500, 1275: 38000, 1600: 39500, 2000: 43000, 2500: 48000 },
    'Lift shërbimi': { 300: 15000, 450: 17500, 630: 21000, 800: 24500, 1000: 27500, 1275: 31000, 1600: 35000, 2000: 39000, 2500: 43000 },
    'Lift automobilash': { 300: 30000, 450: 35000, 630: 39000, 800: 43000, 1000: 46000, 1275: 49000, 1600: 50000, 2000: 51000, 2500: 52000 },
    'Platformë ngritëse': { 300: 12500, 450: 14500, 630: 16500, 800: 19000, 1000: 22000, 1275: 25000, 1600: 28000, 2000: 31000, 2500: 34000 }
  };

  function updateStepUI() {
    // Shfaq vetëm hapin aktual
    for (let i = 1; i <= totalSteps; i++) {
      const stepEl = document.getElementById(`step-content-${i}`);
      const stepNavEl = document.getElementById(`step-nav-${i}`);
      if (stepEl) {
        if (i === currentStep) {
          stepEl.classList.remove('hidden');
        } else {
          stepEl.classList.add('hidden');
        }
      }
      if (stepNavEl) {
        if (i === currentStep) {
          stepNavEl.classList.add('border-amber-400', 'text-amber-400', 'bg-amber-500/10');
          stepNavEl.classList.remove('border-slate-700', 'text-slate-400', 'bg-slate-900');
        } else if (i < currentStep) {
          stepNavEl.classList.add('border-emerald-500', 'text-emerald-400', 'bg-emerald-500/10');
          stepNavEl.classList.remove('border-amber-400', 'text-amber-400', 'border-slate-700', 'text-slate-400', 'bg-slate-900');
        } else {
          stepNavEl.classList.add('border-slate-700', 'text-slate-400', 'bg-slate-900');
          stepNavEl.classList.remove('border-amber-400', 'text-amber-400', 'border-emerald-500', 'text-emerald-400', 'bg-amber-500/10', 'bg-emerald-500/10');
        }
      }
    }

    const prevBtn = document.getElementById('config-prev-btn');
    const nextBtn = document.getElementById('config-next-btn');
    const submitBtn = document.getElementById('config-submit-btn');

    if (prevBtn) prevBtn.disabled = currentStep === 1;
    if (nextBtn) {
      if (currentStep === totalSteps) {
        nextBtn.classList.add('hidden');
        if (submitBtn) submitBtn.classList.remove('hidden');
      } else {
        nextBtn.classList.remove('hidden');
        if (submitBtn) submitBtn.classList.add('hidden');
      }
    }

    recalculatePrice();
  }

  function recalculatePrice() {
    const elevatorType = document.querySelector('input[name="elevatorType"]:checked')?.value || 'Lift pasagjerësh';
    const capacityKg = parseInt(document.querySelector('input[name="capacityKg"]:checked')?.value) || 630;
    const speed = parseFloat(document.querySelector('input[name="speed"]:checked')?.value) || 1.0;
    const floorsCount = parseInt(document.getElementById('floorsCount')?.value) || 5;

    // 1. Çmimi Bazë
    let base = 22500;
    const selected = window.SELECTED_ELEVATOR;
    if (selected && selected.type === elevatorType && selected.capacityKg === capacityKg) {
      // Modeli i zgjedhur nga katalogu përputhet ende me llojin/kapacitetin - përdor çmimin e tij real
      base = selected.basePrice;
    } else if (baseRates[elevatorType] && baseRates[elevatorType][capacityKg]) {
      base = baseRates[elevatorType][capacityKg];
    }

    // Shtesa për kate mbi 5 (+600 € për çdo kat shtesë)
    if (floorsCount > 5) {
      base += (floorsCount - 5) * 650;
    }

    // Shtesa për shpejtësi
    if (speed === 1.6) base += 2400;
    if (speed === 2.0) base += 4500;

    // 2. Opsionet e zgjedhura
    let optionsTotal = 0;
    const selectedOptionsList = [];
    document.querySelectorAll('input[name="selectedOptions"]:checked').forEach(cb => {
      const price = parseFloat(cb.dataset.price) || 0;
      optionsTotal += price;
      selectedOptionsList.push({
        code: cb.value,
        name: cb.dataset.name,
        price: price
      });
    });

    // 3. Instalimi & Testimi
    let installPrice = 3500;
    if (floorsCount > 5) installPrice += (floorsCount - 5) * 200;
    if (capacityKg > 1000) installPrice += 1000;

    // 4. Transporti
    const transportPrice = 900;

    // 5. Zbritje (Discount)
    const discountInput = document.getElementById('discountInput');
    const discount = parseFloat(discountInput?.value) || 1500;

    // Llogaritjet Finale
    const subtotal = Math.max(0, (base + optionsTotal + installPrice + transportPrice) - discount);
    const vatAmount = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + vatAmount;

    // Përditëso UI në anën e djathtë
    const elBase = document.getElementById('summary-base-price');
    const elOpts = document.getElementById('summary-options-price');
    const elInst = document.getElementById('summary-install-price');
    const elTrans = document.getElementById('summary-transport-price');
    const elDisc = document.getElementById('summary-discount-price');
    const elSub = document.getElementById('summary-subtotal-price');
    const elVat = document.getElementById('summary-vat-price');
    const elTotal = document.getElementById('summary-total-price');

    if (elBase) elBase.innerText = base.toLocaleString('de-DE') + ' €';
    if (elOpts) elOpts.innerText = optionsTotal.toLocaleString('de-DE') + ' €';
    if (elInst) elInst.innerText = installPrice.toLocaleString('de-DE') + ' €';
    if (elTrans) elTrans.innerText = transportPrice.toLocaleString('de-DE') + ' €';
    if (elDisc) elDisc.innerText = '-' + discount.toLocaleString('de-DE') + ' €';
    if (elSub) elSub.innerText = subtotal.toLocaleString('de-DE') + ' €';
    if (elVat) elVat.innerText = vatAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
    if (elTotal) elTotal.innerText = total.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';

    // Përditëso fushat e fshehura në formë për dërgim në server
    const hiddenBase = document.getElementById('hidden-basePrice');
    const hiddenOpts = document.getElementById('hidden-optionsPrice');
    const hiddenInst = document.getElementById('hidden-installationPrice');
    const hiddenTrans = document.getElementById('hidden-transportPrice');
    const hiddenDisc = document.getElementById('hidden-discount');
    const hiddenSub = document.getElementById('hidden-subtotal');
    const hiddenVat = document.getElementById('hidden-vatAmount');
    const hiddenTot = document.getElementById('hidden-calculatedPrice');
    const hiddenOptionsJson = document.getElementById('hidden-selectedOptionsJson');

    if (hiddenBase) hiddenBase.value = base;
    if (hiddenOpts) hiddenOpts.value = optionsTotal;
    if (hiddenInst) hiddenInst.value = installPrice;
    if (hiddenTrans) hiddenTrans.value = transportPrice;
    if (hiddenDisc) hiddenDisc.value = discount;
    if (hiddenSub) hiddenSub.value = subtotal;
    if (hiddenVat) hiddenVat.value = vatAmount;
    if (hiddenTot) hiddenTot.value = total;
    if (hiddenOptionsJson) hiddenOptionsJson.value = JSON.stringify(selectedOptionsList);
  }

  // Event Listeners për butonat e navigimit
  const prevBtn = document.getElementById('config-prev-btn');
  const nextBtn = document.getElementById('config-next-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateStepUI();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentStep < totalSteps) {
        currentStep++;
        updateStepUI();
      }
    });
  }

  // Klikimet në hapat e shiritit të navigimit
  for (let i = 1; i <= totalSteps; i++) {
    const navItem = document.getElementById(`step-nav-${i}`);
    if (navItem) {
      navItem.addEventListener('click', () => {
        currentStep = i;
        updateStepUI();
      });
    }
  }

  // Dëgjo ndryshimet në radio/checkbox/input për llogaritje të çastit
  const configForm = document.getElementById('elevator-configurator-form');
  if (configForm) {
    configForm.addEventListener('change', recalculatePrice);
    configForm.addEventListener('input', recalculatePrice);
  }

  // Inicimi fillestar
  updateStepUI();
});
