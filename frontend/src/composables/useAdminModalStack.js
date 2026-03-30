export function useAdminModalStack() {
  const modalOriginStack = [];

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

  const resolveModalElement = (target) => target?.el || target;
  const isModalShown = (target) => resolveModalElement(target)?.classList?.contains("show");

  const hideAndRemember = (origin, instance, target) => {
    if (!instance || !isModalShown(target)) {
      return false;
    }
    instance.hide();
    pushModalOrigin(origin);
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
