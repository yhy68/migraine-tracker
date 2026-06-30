class DatePicker {
  constructor(options) {
    this.id = options.id;
    this.value = options.value || '';
    this.onChange = options.onChange || (() => {});
    this.min = options.min || '';
    this.max = options.max || '';
    this.placeholder = options.placeholder || '选择日期';
    this.container = null;
    this.input = null;
    this.calendar = null;
    this.backdrop = null;
    this.currentDate = new Date();
    this.isOpen = false;
    
    this.monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    this.weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
    
    this.init();
  }
  
  init() {
    this.container = document.createElement('div');
    this.container.className = 'date-picker-wrapper';
    
    this.renderInput();
    this.renderCalendar();
    
    this.setupEvents();
  }
  
  renderInput() {
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'date-picker-input';
    this.input.placeholder = this.placeholder;
    this.input.value = this.value;
    this.input.readOnly = true;
    
    const icon = document.createElement('span');
    icon.className = 'date-picker-icon';
    icon.textContent = '📅';
    
    this.container.appendChild(icon);
    this.container.appendChild(this.input);
  }
  
  renderCalendar() {
    this.calendar = document.createElement('div');
    this.calendar.className = 'date-picker-calendar';
    
    this.calendar.innerHTML = `
      <div class="date-picker-header">
        <button class="date-picker-nav-btn" data-action="prev-year">◀</button>
        <button class="date-picker-nav-btn" data-action="prev-month">‹</button>
        <span class="date-picker-month-year"></span>
        <button class="date-picker-nav-btn" data-action="next-month">›</button>
        <button class="date-picker-nav-btn" data-action="next-year">▶</button>
      </div>
      <div class="date-picker-weekdays"></div>
      <div class="date-picker-days"></div>
      <div class="date-picker-footer">
        <button class="date-picker-quick-btn" data-quick="today">今天</button>
        <button class="date-picker-quick-btn" data-quick="yesterday">昨天</button>
        <button class="date-picker-quick-btn" data-quick="week-start">本周一</button>
        <button class="date-picker-quick-btn" data-quick="week-end">本周末</button>
        <button class="date-picker-quick-btn" data-quick="last-week">上周</button>
        <button class="date-picker-quick-btn" data-quick="last-month">上月</button>
      </div>
    `;
    
    this.container.appendChild(this.calendar);
    
    this.renderWeekdays();
    this.renderDays();
  }
  
  renderWeekdays() {
    const weekdaysEl = this.calendar.querySelector('.date-picker-weekdays');
    weekdaysEl.innerHTML = this.weekdayNames.map(d => 
      `<div class="date-picker-weekday">${d}</div>`
    ).join('');
  }
  
  renderDays() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const prevDays = prevLastDay.getDate();
    
    let daysHtml = '';
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevDays - i;
      daysHtml += this.createDayButton(day, year, month - 1, true);
    }
    
    for (let day = 1; day <= totalDays; day++) {
      daysHtml += this.createDayButton(day, year, month, false);
    }
    
    const remainingCells = 42 - (firstDayOfWeek + totalDays);
    for (let day = 1; day <= remainingCells; day++) {
      daysHtml += this.createDayButton(day, year, month + 1, true);
    }
    
    this.calendar.querySelector('.date-picker-days').innerHTML = daysHtml;
    this.updateMonthYearDisplay();
  }
  
  createDayButton(day, year, month, isOtherMonth) {
    const date = new Date(year, month, day);
    const dateStr = this.formatDate(date);
    const today = new Date();
    const todayStr = this.formatDate(today);
    
    let classes = 'date-picker-day';
    if (isOtherMonth) classes += ' other-month';
    if (dateStr === todayStr) classes += ' today';
    if (dateStr === this.value) classes += ' selected';
    if (this.isDateDisabled(date)) classes += ' disabled';
    
    return `<button class="${classes}" data-date="${dateStr}">${day}</button>`;
  }
  
  updateMonthYearDisplay() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    this.calendar.querySelector('.date-picker-month-year').textContent = 
      `${year}年 ${this.monthNames[month]}`;
  }
  
  isDateDisabled(date) {
    if (this.min && date < new Date(this.min)) return true;
    if (this.max && date > new Date(this.max)) return true;
    return false;
  }
  
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  handleNavClick(action) {
    switch (action) {
      case 'prev-month':
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        break;
      case 'next-month':
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        break;
      case 'prev-year':
        this.currentDate.setFullYear(this.currentDate.getFullYear() - 1);
        break;
      case 'next-year':
        this.currentDate.setFullYear(this.currentDate.getFullYear() + 1);
        break;
    }
    this.renderDays();
  }
  
  navigateDay(delta) {
    if (!this.value) {
      this.value = this.formatDate(this.currentDate);
    }
    const current = new Date(this.value);
    current.setDate(current.getDate() + delta);
    
    const newDateStr = this.formatDate(current);
    if (!this.isDateDisabled(current)) {
      this.value = newDateStr;
      this.input.value = this.value;
      this.currentDate = current;
      this.renderDays();
    }
  }
  
  handleQuickSelect(type) {
    const today = new Date();
    let date = new Date(today);
    
    switch (type) {
      case 'today':
        break;
      case 'yesterday':
        date.setDate(date.getDate() - 1);
        break;
      case 'week-start':
        date.setDate(date.getDate() - date.getDay() + 1);
        break;
      case 'week-end':
        date.setDate(date.getDate() - date.getDay() + 7);
        break;
      case 'last-week':
        date.setDate(date.getDate() - date.getDay() + 1 - 7);
        break;
      case 'last-month':
        date.setMonth(date.getMonth() - 1);
        break;
    }
    
    const dateStr = this.formatDate(date);
    if (!this.isDateDisabled(date)) {
      this.selectDate(dateStr);
    }
  }
  
  selectDate(dateStr) {
    this.value = dateStr;
    this.input.value = dateStr;
    this.onChange(dateStr);
    this.close();
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
      this.currentDate = new Date(this.value);
    }
    this.renderDays();
    this.calendar.classList.add('show');
    this.isOpen = true;
    
    setTimeout(() => {
      this.input.focus();
    }, 100);
  }
  
  close() {
    this.calendar.classList.remove('show');
    this.isOpen = false;
  }
  
  setValue(value) {
    this.value = value;
    this.input.value = value;
  }
  
  getValue() {
    return this.value;
  }
  
  setMin(value) {
    this.min = value;
    this.renderDays();
  }
  
  setMax(value) {
    this.max = value;
    this.renderDays();
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
  }
  
  setupEvents() {
    this.input.addEventListener('click', () => this.toggle());
    this.input.addEventListener('focus', () => this.open());
    
    this.calendar.addEventListener('click', (e) => {
      const target = e.target;
      
      if (target.classList.contains('date-picker-nav-btn')) {
        this.handleNavClick(target.dataset.action);
      } else if (target.classList.contains('date-picker-day')) {
        if (!target.classList.contains('disabled')) {
          this.selectDate(target.dataset.date);
        }
      } else if (target.classList.contains('date-picker-quick-btn')) {
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
          this.navigateDay(-7);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.navigateDay(7);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.navigateDay(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.navigateDay(1);
          break;
        case 'Enter':
          e.preventDefault();
          if (this.value) this.close();
          break;
      }
    };
    
    document.addEventListener('click', this.globalClickHandler);
    document.addEventListener('keydown', this.globalKeyHandler);
  }
}