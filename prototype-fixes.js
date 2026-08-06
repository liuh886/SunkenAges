// Prototype-only interaction hardening kept separate from the core loop.

const originalReturnToMuseum = returnToMuseum;

returnToMuseum = function returnToMuseumSafely(forced = false) {
  if (!state.running) return;

  if (forced && state.recovered.size < 2) {
    state.running = false;
    cancelAnimationFrame(animationFrame);
    ui.interactionPrompt.hidden = true;
    hideDiveToast();
    window.alert("氧气耗尽，本次回收的证据不足以策展。潜水员已安全返回，请重新准备后下潜。");
    showScreen("briefing");
    return;
  }

  originalReturnToMuseum(forced);
};

const mobileControls = document.querySelector(".mobile-controls");
if (mobileControls) {
  const surfaceControl = document.createElement("button");
  surfaceControl.type = "button";
  surfaceControl.className = "mobile-surface-control";
  surfaceControl.textContent = "返航";
  surfaceControl.setAttribute("aria-label", "返回水面");
  surfaceControl.addEventListener("click", () => returnToMuseum());
  mobileControls.appendChild(surfaceControl);

  const style = document.createElement("style");
  style.textContent = `
    .mobile-surface-control {
      position: absolute;
      right: 0;
      bottom: 88px;
      min-width: 74px;
      min-height: 38px;
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 999px;
      color: var(--ink);
      background: rgba(2,18,24,0.76);
      backdrop-filter: blur(7px);
      pointer-events: auto;
      font-size: 11px;
      font-weight: 800;
    }

    @media (min-width: 761px) {
      .mobile-surface-control { display: none; }
    }
  `;
  document.head.appendChild(style);
}
