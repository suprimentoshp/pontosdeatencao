if ("serviceWorker" in navigator) {
  let refreshed = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshed) return;
    refreshed = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").then((registration) => {
      registration.update();
      if (registration.waiting && navigator.serviceWorker.controller) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    }).catch(() => {});
  });
}
