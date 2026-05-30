import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../EventBus.js';

describe('EventBus', () => {
  it('on() 订阅后 emit() 能触发回调', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('test', fn);
    bus.emit('test', 'a', 1);
    expect(fn).toHaveBeenCalledWith('a', 1);
  });

  it('同一个事件可订阅多个回调', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('e', a);
    bus.on('e', b);
    bus.emit('e');
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('多参数传递', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('e', fn);
    bus.emit('e', 1, 'two', { three: 3 });
    expect(fn).toHaveBeenCalledWith(1, 'two', { three: 3 });
  });

  it('once() 只触发一次', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.once('e', fn);
    bus.emit('e');
    bus.emit('e');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('off() 取消订阅后不再触发', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('e', fn);
    bus.off('e', fn);
    bus.emit('e');
    expect(fn).not.toHaveBeenCalled();
  });

  it('off() 带 context 精确匹配', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const ctxA = {};
    const ctxB = {};
    bus.on('e', fn, ctxA);
    bus.off('e', fn, ctxA);
    bus.emit('e');
    expect(fn).not.toHaveBeenCalled();

    bus.on('e', fn, ctxB);
    bus.off('e', fn, ctxA); // 不同 context，不应取消
    bus.emit('e');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('removeAllListeners() 清空所有事件', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('e1', a);
    bus.on('e2', b);
    bus.removeAllListeners();
    bus.emit('e1');
    bus.emit('e2');
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('emit 空事件名不报错', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });

  it('off 未注册的监听器不报错', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    expect(() => bus.off('nonexistent', fn)).not.toThrow();
    expect(() => bus.off('e', fn)).not.toThrow();
    bus.on('e', vi.fn());
    expect(() => bus.off('e', fn)).not.toThrow();
  });

  it('once 回调中 off 自身不报错', () => {
    const bus = new EventBus();
    const fn = vi.fn(() => bus.off('e', fn));
    bus.on('e', fn);
    bus.emit('e');
    expect(fn).toHaveBeenCalledOnce();
    // 第二次 emit 不应报错
    expect(() => bus.emit('e')).not.toThrow();
  });

  it('emit 时遍历快照不受回调中 on/off 影响', () => {
    const bus = new EventBus();
    const addB = () => bus.on('e', () => {});
    const removeSelf = vi.fn(function () { bus.off('e', removeSelf); });
    bus.on('e', addB);
    bus.on('e', removeSelf);
    const third = vi.fn();
    bus.on('e', third);

    bus.emit('e');
    // removeSelf 被 off 了但 third 应该仍然被调用
    expect(removeSelf).toHaveBeenCalledOnce();
    expect(third).toHaveBeenCalledOnce();
  });

  it('context 绑定正确传递', () => {
    const bus = new EventBus();
    const ctx = { value: 42 };
    let captured;
    bus.on('e', function () { captured = this.value; }, ctx);
    bus.emit('e');
    expect(captured).toBe(42);
  });
});
