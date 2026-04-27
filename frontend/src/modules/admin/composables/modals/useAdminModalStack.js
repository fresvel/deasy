export function useAdminModalStack() {
  const modalOriginStack = [];
  const blurActiveElement = () => {
    if (typeof document === "undefined") {
      return;
    }
    document.activeElement?.blur?.();
  };

  const pushModalOrigin = (origin) => {
    if (!origin) {
      return;
    }
    modalOriginStack.push(origin);
  };

  const peekModalOrigin = () => (
    modalOriginStack.length ? modalOriginStack[modalOriginStack.length - 1] : null
  );

  const clearModalOrigins = () => {
    modalOriginStack.length = 0;
  };

  const popModalOrigin = () => (
    modalOriginStack.length ? modalOriginStack.pop() : null
  );

  const resolveModalElement = (target) => {
    let current = target;
    for (let index = 0; index < 6; index += 1) {
      if (!current) {
        return null;
      }
      if (current instanceof HTMLElement) {
        return current;
      }
      if ("value" in current) {
        current = current.value;
        continue;
      }
      if ("el" in current) {
        current = current.el;
        continue;
      }
      break;
    }
    return current instanceof HTMLElement ? current : null;
  };
  const isModalShown = (target) => resolveModalElement(target)?.classList?.contains("show");

  const hideAndRemember = (origin, instance, target) => {
    if (!instance || !isModalShown(target)) {
      return false;
    }
    pushModalOrigin(origin);
    blurActiveElement();
    instance.hide();
    return true;
  };

  return {
    pushModalOrigin,
    peekModalOrigin,
    clearModalOrigins,
    popModalOrigin,
    resolveModalElement,
    isModalShown,
    hideAndRemember
  };
}
