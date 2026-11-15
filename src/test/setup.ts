import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// Progress is saved in the browser, so every test starts from a clean slate.
beforeEach(() => window.localStorage.clear());

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom has no ResizeObserver, which Radix sliders use to measure their thumbs.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
}
