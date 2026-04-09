export const installPdfJsCollectionPolyfills = () => {
  if (typeof Map !== "undefined" && !Map.prototype.getOrInsertComputed) {
    Object.defineProperty(Map.prototype, "getOrInsertComputed", {
      value(key, compute) {
        if (this.has(key)) {
          return this.get(key);
        }
        const value = compute(key);
        this.set(key, value);
        return value;
      },
      configurable: true,
      writable: true
    });
  }

  if (typeof WeakMap !== "undefined" && !WeakMap.prototype.getOrInsertComputed) {
    Object.defineProperty(WeakMap.prototype, "getOrInsertComputed", {
      value(key, compute) {
        if (this.has(key)) {
          return this.get(key);
        }
        const value = compute(key);
        this.set(key, value);
        return value;
      },
      configurable: true,
      writable: true
    });
  }
};

installPdfJsCollectionPolyfills();
