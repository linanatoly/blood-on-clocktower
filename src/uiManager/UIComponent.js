export class UIComponent {
  constructor(eventBus, containerEl) {
    this.eventBus = eventBus;
    this.el = containerEl;
    this.subscriptions = [];
  }

  on(event, fn) {
    this.eventBus.on(event, fn);
    this.subscriptions.push([event, fn]);
  }

  emit(event, ...args) {
    this.eventBus.emit(event, ...args);
  }

  show() {
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
  }

  toggle() {
    this.el.classList.toggle('hidden');
  }

  destroy() {
    this.subscriptions.forEach(([e, fn]) => this.eventBus.off(e, fn));
    this.subscriptions = [];
    if (this.el) {
      this.el.innerHTML = '';
    }
  }
}
