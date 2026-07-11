class TimePicker {
  constructor(options) {
    this.id = options.id;
    this.value = options.value || '';
    this.onChange = options.onChange || (() => {});
    this.placeholder = options.placeholder || '选择时间';
    this.container = null;
    this.input = null;
    this.panel = null;
    this.hourEl = null;
    this.minEl = null;
    this.hour = 0;
    this.min = 0;
    this.isOpen = false;
    this._parseValue();
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.className = 'time-picker-wrapper';
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
    const display = this.value ? this.value : this.placeholder;

    this.container.innerHTML = `
      <input type="text" class="time-picker-input" value="${display}" readonly placeholder="${this.placeholder}">
      <span class="time-picker-icon">&#x23F0;</span>
      <div class="time-picker-panel">
        <div class="time-picker-stepper">
          <div class="stp-unit">
            <button class="stp-btn stp-up" data-unit="hour" data-dir="1">&#x25B2;</button>
            <div class="stp-val" data-unit="hour">${String(this.hour).padStart(2,'0')}</div>
            <button class="stp-btn stp-down" data-unit="hour" data-dir="-1">&#x25BC;</button>
          </div>
          <span class="stp-colon">:</span>
          <div class="stp-unit">
            <button class="stp-btn stp-up" data-unit="min" data-dir="1">&#x25B2;</button>
            <div class="stp-val" data-unit="min">${String(this.min).padStart(2,'0')}</div>
            <button class="stp-btn stp-down" data-unit="min" data-dir="-1">&#x25BC;</button>
          </div>
        </div>
        <div class="time-picker-footer">
          <button class="time-picker-quick-btn" data-action="now">此刻</button>
        </div>
      </div>
    `;

    this.input = this.container.querySelector('.time-picker-input');
    this.panel = this.container.querySelector('.time-picker-panel');
    this.hourEl = this.container.querySelector('[data-unit="hour"].stp-val');
    this.minEl = this.container.querySelector('[data-unit="min"].stp-val');

    this.setupEvents();
  }

  setupEvents() {
    // 输入框点击展开/收起
    this.input.addEventListener('click', () => this.toggle());
    this.input.addEventListener('focus', () => this.open());

    // 步进按钮
    this.panel.querySelectorAll('.stp-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const unit = btn.dataset.unit;
        const dir = parseInt(btn.dataset.dir);
        this._step(unit, dir);
      });
      let timer = null;
      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
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
      btn.addEventListener('touchstart', (e) => {
        e.stopPropagation();
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

    // 点击数字直接输入
    this.panel.querySelectorAll('.stp-val').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
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
    this.panel.querySelector('[data-action="now"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const now = new Date();
      this.hour = now.getHours();
      this.min = now.getMinutes();
      this._update();
    });

    // 点击外部关闭
    this._globalClick = (e) => {
      if (!this.container.contains(e.target)) this.close();
    };
    document.addEventListener('click', this._globalClick);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (this.isOpen) return;
    this.panel.classList.add('show');
    this.isOpen = true;
  }

  close() {
    this.panel.classList.remove('show');
    this.isOpen = false;
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
    this.input.value = this.value;
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
    this.input.value = this.value ? `${h}:${m}` : this.placeholder;
    if (this.hourEl) this.hourEl.textContent = h;
    if (this.minEl) this.minEl.textContent = m;
  }

  getElement() {
    return this.container;
  }

  destroy() {
    if (this._globalClick) document.removeEventListener('click', this._globalClick);
    if (this.container) this.container.remove();
  }
}
