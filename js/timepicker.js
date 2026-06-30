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
    
    this.isDragging = false;
    this.dragWheel = null;
    this.startY = 0;
    this.currentOffset = 0;
    this.itemHeight = 36;
    this.wheelHeight = 140;
    
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
      <div class="time-picker-footer">
        <button class="time-picker-quick-btn" data-quick="now">现在</button>
        <button class="time-picker-quick-btn" data-quick="hour">整点</button>
        <button class="time-picker-quick-btn" data-quick="half">半点</button>
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
  
  scrollToSelected(type, animate = true) {
    const inner = this.panel.querySelector(`[data-wheel="${type}"] .time-picker-wheel-inner`);
    if (!inner) return;
    
    const selectedItem = inner.querySelector('.time-picker-wheel-item.selected');
    if (!selectedItem) return;
    
    const offset = selectedItem.offsetTop - (this.wheelHeight / 2) + (this.itemHeight / 2);
    
    if (animate) {
      inner.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    } else {
      inner.style.transition = 'none';
    }
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
  
  setupDragEvents() {
    const wheels = this.panel.querySelectorAll('.time-picker-wheel');
    
    wheels.forEach(wheel => {
      wheel.addEventListener('touchstart', (e) => this.onDragStart(e, wheel));
      wheel.addEventListener('touchmove', (e) => this.onDragMove(e));
      wheel.addEventListener('touchend', () => this.onDragEnd());
      
      wheel.addEventListener('mousedown', (e) => this.onDragStart(e, wheel));
      wheel.addEventListener('wheel', (e) => this.onWheel(e, wheel), { passive: false });
    });
  }
  
  onWheel(e, wheel) {
    e.preventDefault();
    const wheelType = wheel.dataset.wheel;
    const delta = e.deltaY > 0 ? 1 : -1;
    
    if (wheelType === 'hour') {
      this.changeHour(delta);
    } else {
      this.changeMinute(delta);
    }
  }
  
  onDragStart(e, wheel) {
    e.preventDefault();
    this.isDragging = true;
    this.dragWheel = wheel.dataset.wheel;
    
    const point = e.touches ? e.touches[0] : e;
    this.startY = point.clientY;
    
    const inner = wheel.querySelector('.time-picker-wheel-inner');
    const transform = inner.style.transform;
    const match = transform.match(/translateY\(-?(\d+)px\)/);
    this.currentOffset = match ? parseInt(match[1]) : 0;
    
    inner.style.transition = 'none';
  }
  
  onDragMove(e) {
    if (!this.isDragging || !this.dragWheel) return;
    e.preventDefault();
    
    const point = e.touches ? e.touches[0] : e;
    const deltaY = point.clientY - this.startY;
    
    const newOffset = this.currentOffset - deltaY;
    const inner = this.panel.querySelector(`[data-wheel="${this.dragWheel}"] .time-picker-wheel-inner`);
    
    inner.style.transform = `translateY(-${newOffset}px)`;
    
    this.updateDisplayFromScroll(newOffset);
  }
  
  updateDisplayFromScroll(offset) {
    const centerOffset = this.wheelHeight / 2 - this.itemHeight / 2;
    const relativeOffset = offset + centerOffset;
    const itemIndex = Math.round(relativeOffset / this.itemHeight);
    
    const maxItems = this.dragWheel === 'hour' ? 24 : 60;
    const clampedIndex = Math.max(0, Math.min(maxItems - 1, itemIndex));
    
    if (this.dragWheel === 'hour') {
      this.hour = clampedIndex;
    } else {
      this.minute = clampedIndex;
    }
    
    this.updateDisplay();
    this.updateWheelSelection();
  }
  
  updateWheelSelection() {
    const wheels = this.panel.querySelectorAll('.time-picker-wheel');
    wheels.forEach(wheel => {
      const type = wheel.dataset.wheel;
      const items = wheel.querySelectorAll('.time-picker-wheel-item');
      items.forEach((item, index) => {
        const isSelected = type === 'hour' ? index === this.hour : index === this.minute;
        item.classList.toggle('selected', isSelected);
      });
    });
  }
  
  onDragEnd() {
    if (!this.isDragging || !this.dragWheel) return;
    
    const inner = this.panel.querySelector(`[data-wheel="${this.dragWheel}"] .time-picker-wheel-inner`);
    const transform = inner.style.transform;
    const match = transform.match(/translateY\(-?(\d+)px\)/);
    const offset = match ? parseInt(match[1]) : 0;
    
    const centerOffset = this.wheelHeight / 2 - this.itemHeight / 2;
    const relativeOffset = offset + centerOffset;
    const itemIndex = Math.round(relativeOffset / this.itemHeight);
    
    const maxItems = this.dragWheel === 'hour' ? 24 : 60;
    const clampedIndex = Math.max(0, Math.min(maxItems - 1, itemIndex));
    
    this.selectValue(this.dragWheel, clampedIndex);
    
    this.isDragging = false;
    this.dragWheel = null;
  }
  
  handleAmpmClick(ampm) {
    if (ampm === 'pm') {
      if (this.hour < 12) this.hour += 12;
    } else {
      if (this.hour >= 12) this.hour -= 12;
    }
    this.updateValue();
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
    document.removeEventListener('click', this.globalClickHandler);
    document.removeEventListener('keydown', this.globalKeyHandler);
    document.removeEventListener('mousemove', this.globalMouseMoveHandler);
    document.removeEventListener('mouseup', this.globalMouseUpHandler);
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
      } else if (target.classList.contains('time-picker-quick-btn')) {
        this.handleQuickSelect(target.dataset.quick);
      }
    });
    
    this.globalClickHandler = (e) => {
      if (!this.container.contains(e.target) && this.isOpen) {
        this.close();
      }
    };
    
    this.globalKeyHandler = (e) => {
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
        case 'Enter':
          e.preventDefault();
          this.close();
          break;
      }
    };
    
    this.globalMouseMoveHandler = (e) => this.onDragMove(e);
    this.globalMouseUpHandler = () => this.onDragEnd();
    
    document.addEventListener('click', this.globalClickHandler);
    document.addEventListener('keydown', this.globalKeyHandler);
    document.addEventListener('mousemove', this.globalMouseMoveHandler);
    document.addEventListener('mouseup', this.globalMouseUpHandler);
    
    this.setupDragEvents();
  }
}