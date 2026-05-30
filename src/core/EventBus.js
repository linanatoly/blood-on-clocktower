class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, fn, context) {
    const entry = { fn, context };
    if (!this._listeners.has(event)) {
      this._listeners.set(event, [entry]);
    } else {
      this._listeners.get(event).push(entry);
    }
  }

  off(event, fn, context) {
    const listeners = this._listeners.get(event);
    if (!listeners) return;
    const idx = listeners.findIndex(
      (e) => e.fn === fn && (context === undefined || e.context === context)
    );
    if (idx !== -1) listeners.splice(idx, 1);
  }

  once(event, fn, context) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      fn.apply(context, args);
    };
    this.on(event, wrapper);
  }

  emit(event, ...args) {
    const listeners = this._listeners.get(event);
    if (!listeners) return;
    for (const entry of [...listeners]) {
      entry.fn.apply(entry.context, args);
    }
  }

  removeAllListeners() {
    this._listeners.clear();
  }
}

export const eventBus = new EventBus();
export { EventBus };
