class TimePicker {
  constructor(options) {
    this.id = options.id;
    this.value = options.value || '';
    this.onChange = options.onChange || (() => {});
    this.placeholder = options.placeholder || '选择时间';
    this.container = null;
    this.input = null;
    this.panel = null;
    this.isOpen = false;
    this.hour = 12;
    this.minute = 0;
    this.is24Hour = true;
    this.scrollOffset = { hour: 0, minute: 0 };
    
    this.init();
  }
  
  init() {
    this.container = document.createElement('div');
    this.container.className = 'time-picker-wrapper';
    
    this.renderInput();
    this.renderPanel();
    
    this.setupEvents();
  }
  
  renderInput() {
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'time-picker-input';
    this.input.placeholder = this.placeholder;
    this.input.value = this.value;
    this.input.readOnly = true;
    
    const icon = document.createElement('span');
    icon.className = 'time-picker-icon';
    icon.textContent = '⏰';
    
    this.container.appendChild(icon);
    this.container.appendChild(this.input);
  }
  
  renderPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'time-picker-panel';
    
    this.panel.innerHTML = `
      <div class="time-picker-header">
        <div class="time-picker-ampm">
          <button class="time-picker-ampm-btn" data-ampm="am">上午</button>
          <button class="time-picker-ampm-btn" data-ampm="pm">下午</button>
        </div>
        <div class="time-picker-display">--:--</div>
      </div>
      <div class="time-picker-wheels">
        <div class="time-picker-wheel" data-wheel="hour">
          <div class="time-picker-wheel-inner"></div>
          <div class="time-picker-wheel-marker"></div>
        </div>
        <div class="time-picker-wheel" data-wheel="minute">
          <div class="time-picker-wheel-inner"></div>
          <div class="time-picker-wheel-marker"></div>
        </div>
      </div>
      <div class="time-picker-nav-btns">
        <button class="time-picker-nav-btn" data-action="prev-hour">↑</button>
        <button class="time-picker-nav-btn" data-action="prev-minute">↑</button>
        <button class="time-picker-nav-btn" data-action="next-hour">↓</button>
        <button class="time-picker-nav-btn" data-action="next-minute">↓</button>
      </div>
      <div class="time-picker-footer">
        <button class="time-picker-quick-btn" data-quick="now">现在</button>
        <button class="time-picker-quick-btn" data-quick="hour">整点</button>
        <button class="time-picker-quick-btn" data-quick="half">半点</button>
        <button class="time-picker-quick-btn" data-quick="quarter">15分</button>
        <button class="time-picker-quick-btn" data-quick="5min">5分</button>
        <button class="time-picker-quick-btn" data-quick="30min+">+30分</button>
      </div>
    `;
    
    this.container.appendChild(this.panel);
    
    this.renderWheels();
    this.updateDisplay();
  }
  
  renderWheels() {
    this.renderWheel('hour');
    this.renderWheel('minute');
  }
  
  renderWheel(type) {
    const inner = this.panel.querySelector(`[data-wheel="${type}"] .time-picker-wheel-inner`);
    if (!inner) return;
    
    let items = [];
    if (type === 'hour') {
      for (let i = 0; i < 24; i++) {
        items.push(i);
      }
    } else {
      for (let i = 0; i < 60; i++) {
        items.push(i);
      }
    }
    
    inner.innerHTML = items.map(item => {
      const display = String(item).padStart(2, '0');
      const isSelected = type === 'hour' ? item === this.hour : item === this.minute;
      return `<div class="time-picker-wheel-item ${isSelected ? 'selected' : ''}" data-value="${item}">${display}</div>`;
    }).join('');
    
    this.scrollToSelected(type);
  }
  
  scrollToSelected(type) {
    const inner = this.panel.querySelector(`[data-wheel="${type}"] .time-picker-wheel-inner`);
    if (!inner) return;
    
    const selectedItem = inner.querySelector('.time-picker-wheel-item.selected');
    if (!selectedItem) return;
    
    const itemHeight = 36;
    const wheelHeight = 140;
    const offset = selectedItem.offsetTop - (wheelHeight / 2) + (itemHeight / 2);
    
    inner.style.transform = `translateY(-${offset}px)`;
  }
  
  updateDisplay() {
    const display = this.panel.querySelector('.time-picker-display');
    if (!display) return;
    
    const h = String(this.hour).padStart(2, '0');
    const m = String(this.minute).padStart(2, '0');
    display.textContent = `${h}:${m}`;
    
    const ampmBtns = this.panel.querySelectorAll('.time-picker-ampm-btn');
    if (this.is24Hour) {
      ampmBtns.forEach(btn => btn.style.display = 'none');
    } else {
      ampmBtns.forEach(btn => btn.style.display = 'block');
      const isPM = this.hour >= 12;
      ampmBtns[0].classList.toggle('active', !isPM);
      ampmBtns[1].classList.toggle('active', isPM);
    }
  }
  
  setupEvents() {
    this.input.addEventListener('click', () => this.toggle());
    this.input.addEventListener('focus', () => this.open());
    
    this.panel.addEventListener('click', (e) => {
      const target = e.target;
      
      if (target.classList.contains('time-picker-ampm-btn')) {
        this.handleAmpmClick(target.dataset.ampm);
      } else if (target.classList.contains('time-picker-wheel-item')) {
        const wheel = target.closest('[data-wheel]').dataset.wheel;
        this.selectValue(wheel, parseInt(target.dataset.value));
      } else if (target.classList.contains('time-picker-nav-btn')) {
        this.handleNavClick(target.dataset.action);
      } else if (target.classList.contains('time-picker-quick-btn')) {
        this.handleQuickSelect(target.dataset.quick);
      }
    });
    
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target) && this.isOpen) {
        this.close();
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          this.close();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.changeMinute(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.changeMinute(1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.changeHour(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.changeHour(1);
          break;
        case 'PageUp':
          e.preventDefault();
          this.changeMinute(-15);
          break;
        case 'PageDown':
          e.preventDefault();
          this.changeMinute(15);
          break;
        case 'Enter':
          e.preventDefault();
          this.close();
          break;
      }
    });
  }
  
  handleAmpmClick(ampm) {
    if (ampm === 'pm') {
      if (this.hour < 12) this.hour += 12;
    } else {
      if (this.hour >= 12) this.hour -= 12;
    }
    this.updateValue();
  }
  
  handleNavClick(action) {
    switch (action) {
      case 'prev-hour':
        this.changeHour(-1);
        break;
      case 'next-hour':
        this.changeHour(1);
        break;
      case 'prev-minute':
        this.changeMinute(-1);
        break;
      case 'next-minute':
        this.changeMinute(1);
        break;
    }
  }
  
  handleQuickSelect(type) {
    const now = new Date();
    switch (type) {
      case 'now':
        this.hour = now.getHours();
        this.minute = now.getMinutes();
        break;
      case 'hour':
        this.minute = 0;
        break;
      case 'half':
        this.minute = this.minute < 30 ? 30 : 0;
        if (this.minute === 0) this.changeHour(1);
        break;
      case 'quarter':
        this.minute = Math.floor(this.minute / 15) * 15;
        break;
      case '5min':
        this.minute = Math.floor(this.minute / 5) * 5;
        break;
      case '30min+':
        this.changeMinute(30);
        break;
    }
    this.updateValue();
  }
  
  selectValue(wheel, value) {
    if (wheel === 'hour') {
      this.hour = value;
    } else {
      this.minute = value;
    }
    this.updateValue();
  }
  
  changeHour(delta) {
    this.hour = (this.hour + delta + 24) % 24;
    this.updateValue();
  }
  
  changeMinute(delta) {
    let newMinute = this.minute + delta;
    let hourDelta = 0;
    
    if (newMinute >= 60) {
      hourDelta = Math.floor(newMinute / 60);
      newMinute = newMinute % 60;
    } else if (newMinute < 0) {
      hourDelta = -Math.floor(Math.abs(newMinute) / 60) - 1;
      newMinute = (60 + (newMinute % 60)) % 60;
    }
    
    this.minute = newMinute;
    this.hour = (this.hour + hourDelta + 24) % 24;
    this.updateValue();
  }
  
  updateValue() {
    const h = String(this.hour).padStart(2, '0');
    const m = String(this.minute).padStart(2, '0');
    this.value = `${h}:${m}`;
    this.input.value = this.value;
    this.updateDisplay();
    this.renderWheels();
    this.onChange(this.value);
  }
  
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
  
  open() {
    if (this.value) {
      const [h, m] = this.value.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        this.hour = h;
        this.minute = m;
      }
    } else {
      const now = new Date();
      this.hour = now.getHours();
      this.minute = now.getMinutes();
    }
    this.updateDisplay();
    this.renderWheels();
    this.panel.classList.add('show');
    this.isOpen = true;
    
    setTimeout(() => {
      this.input.focus();
    }, 100);
  }
  
  close() {
    this.panel.classList.remove('show');
    this.isOpen = false;
  }
  
  setValue(value) {
    this.value = value;
    this.input.value = value;
    if (value) {
      const [h, m] = value.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        this.hour = h;
        this.minute = m;
      }
    }
  }
  
  getValue() {
    return this.value;
  }
  
  getElement() {
    return this.container;
  }
  
  destroy() {
    if (this.container) {
      this.container.remove();
    }
  }
}