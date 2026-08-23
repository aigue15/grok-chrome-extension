let coworkActive = false;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "cowork_runtime") {
    coworkActive = Boolean(msg.active);
    return;
  }
  if (msg?.type !== "play_chime") return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(784, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(523, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    /* ignore */
  }
});

setInterval(() => {
  if (!coworkActive) return;
  chrome.runtime.sendMessage({ type: "cowork_keepalive" }).catch(() => {});
}, 20_000);
