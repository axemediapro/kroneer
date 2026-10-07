// KRONEER - Digital Signature Canvas Pad (signature.js)

class SignaturePad {
  constructor(canvasId, clearBtnId, hiddenInputId) {
    this.canvas = document.getElementById(canvasId);
    this.clearBtn = document.getElementById(clearBtnId);
    this.hiddenInput = document.getElementById(hiddenInputId);
    
    if (!this.canvas) return;
    
    this.ctx = this.canvas.getContext('2d');
    this.isDrawing = false;
    this.hasDrawn = false;

    // Konfiguro stilin e lapsit
    this.ctx.strokeStyle = '#D4AF37'; // KRONEER Gold
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.initEvents();
  }

  getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  start(e) {
    e.preventDefault();
    this.isDrawing = true;
    this.hasDrawn = true;
    const pos = this.getPos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  }

  draw(e) {
    if (!this.isDrawing) return;
    e.preventDefault();
    const pos = this.getPos(e);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.save();
  }

  stop(e) {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.save();
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasDrawn = false;
    if (this.hiddenInput) this.hiddenInput.value = '';
  }

  save() {
    if (this.hiddenInput && this.hasDrawn) {
      this.hiddenInput.value = this.canvas.toDataURL('image/png');
    }
  }

  initEvents() {
    // Mouse Events
    this.canvas.addEventListener('mousedown', (e) => this.start(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    window.addEventListener('mouseup', (e) => this.stop(e));

    // Touch Events për Celular dhe Tablet
    this.canvas.addEventListener('touchstart', (e) => this.start(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.draw(e), { passive: false });
    window.addEventListener('touchend', (e) => this.stop(e));

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.clear());
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SignaturePad('client-signature-canvas', 'clear-client-sign-btn', 'clientSignatureData');
  new SignaturePad('rep-signature-canvas', 'clear-rep-sign-btn', 'repSignatureData');
});
