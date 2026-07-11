class TimePicker {
  constructor(options) {
    this.id = options.id;
    this.value = options.value || '';
    this.onChange = options.onChange || (() => {});
    this.placeholder = options.placeholder || '选择时间';
    this.container = null;
    this.hourEl = null;
    this.minEl = null;
    this.hour = 0;
    this.min = 0;
    this._parseValue();
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.className = 'stepper-time-picker';
    this.render();
  }

  _parseValue() {
    if (this.value) {
      const parts = this.value.split(':');
      this.hour = parseInt(parts[0]) || 0;
      this.min = parseInt(parts[1]) || 0;
    }
  }

  render() {
    const hPad = String(this.hour).padStart(2, '0');
    const mPad = String(this.min).padStart(2, '0');

    this.container.innerHTML = `
      <span class="stp-label">${this.placeholder}</span>
      <button class="stp-now-btn" data-action="now">此刻</button>
      <div class="stp-digits">
        <div class="stp-unit">
          <button class="stp-btn stp-up" data-unit="hour" data-dir="1">▲</button>
          <div class="stp-val" data-unit="hour">${hPad}</div>
          <button class="stp-btn stp-down" data-unit="hour" data-dir="-1">▼</button>
        </div>
        <span class="stp-colon">:</span>
        <div class="stp-unit">
          <button class="stp-btn stp-up" data-unit="min" data-dir="1">▲</button>
          <div class="stp-val" data-unit="min">${mPad}</div>
          <button class="stp-btn stp-down" data-unit="min" data-dir="-1">▼</button>
        </div>
      </div>
    `;

    this.hourEl = this.container.querySelector('[data-unit="hour"].stp-val');
    this.minEl = this.container.querySelector('[data-unit="min"].stp-val');

    this.setupEvents();
  }

  setupEvents() {
    // 步进按钮
    this.container.querySelectorAll('.stp-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const unit = btn.dataset.unit;
        const dir = parseInt(btn.dataset.dir);
        this._step(unit, dir);
      });
      // 按住连发
      let timer = null;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const unit = btn.dataset.unit;
        const dir = parseInt(btn.dataset.dir);
        this._step(unit, dir);
        timer = setTimeout(() => {
          timer = setInterval(() => this._step(unit, dir), 80);
        }, 400);
      });
      btn.addEventListener('mouseup', () => { clearInterval(timer); clearTimeout(timer); });
      btn.addEventListener('mouseleave', () => { clearInterval(timer); clearTimeout(timer); });
      // 触摸长按
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const unit = btn.dataset.unit;
        const dir = parseInt(btn.dataset.dir);
        this._step(unit, dir);
        timer = setTimeout(() => {
          timer = setInterval(() => this._step(unit, dir), 80);
        }, 400);
      }, { passive: false });
      btn.addEventListener('touchend', () => { clearInterval(timer); clearTimeout(timer); });
      btn.addEventListener('touchcancel', () => { clearInterval(timer); clearTimeout(timer); });
    });

    // 点击数字弹出输入
    this.container.querySelectorAll('.stp-val').forEach(el => {
      el.addEventListener('click', () => {
        const unit = el.dataset.unit;
        const current = unit === 'hour' ? this.hour : this.min;
        const max = unit === 'hour' ? 23 : 59;
        const val = prompt(
          unit === 'hour' ? '输入小时 (0-23)' : '输入分钟 (0-59)',
          String(current).padStart(2, '0')
        );
        if (val !== null) {
          const num = parseInt(val);
          if (!isNaN(num) && num >= 0 && num <= max) {
            if (unit === 'hour') this.hour = num;
            else this.min = num;
            this._update();
          }
        }
      });
    });

    // 此刻按钮
    this.container.querySelector('[data-action="now"]').addEventListener('click', (e) => {
      e.preventDefault();
      const now = new Date();
      this.hour = now.getHours();
      this.min = now.getMinutes();
      this._update();
    });
  }

  _step(unit, dir) {
    if (unit === 'hour') {
      this.hour = (this.hour + dir + 24) % 24;
    } else {
      this.min = (this.min + dir + 60) % 60;
    }
    this._update();
  }

  _update() {
    const h = String(this.hour).padStart(2, '0');
    const m = String(this.min).padStart(2, '0');
    this.value = `${h}:${m}`;
    if (this.hourEl) this.hourEl.textContent = h;
    if (this.minEl) this.minEl.textContent = m;
    this.onChange(this.value);
  }

  getValue() {
    return this.value;
  }

  setValue(value) {
    this.value = value;
    this._parseValue();
    const h = String(this.hour).padStart(2, '0');
    const m = String(this.min).padStart(2, '0');
    if (this.hourEl) this.hourEl.textContent = h;
    if (this.minEl) this.minEl.textContent = m;
  }

  getElement() {
    return this.container;
  }

  destroy() {
    if (this.container) this.container.remove();
  }
}
