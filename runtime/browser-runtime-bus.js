const listeners = new Set();

export function publishRuntimeEvent(event) {
  window.dispatchEvent(new CustomEvent('runtime-event', { detail: event }));

  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.warn('[runtime-bus] listener failed', error);
    }
  }
}

export function subscribeRuntimeEvent(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function attachWindowRuntimeListener(listener) {
  const handler = (event) => {
    listener(event.detail);
  };

  window.addEventListener('runtime-event', handler);

  return () => {
    window.removeEventListener('runtime-event', handler);
  };
}
