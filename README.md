# Grok for Chrome

A Chrome side-panel agent that can read the page, click, type, take screenshots, and work across tabs. It is powered by **Grok**. Muse Spark is an optional add-on.

This is an unofficial port of Anthropic’s [Claude for Chrome](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn?hl=en-US). The UI and browser tools come from that extension. The backend talks to Grok (and optionally Meta) instead of Claude.

Not affiliated with Anthropic, xAI, or Meta.

## How to use

1. If the Chrome Web Store **Claude** extension is installed, disable it (same side-panel slot).
2. Download [`grok-for-chrome.zip`](./grok-for-chrome.zip), unzip it, then open `chrome://extensions`, turn on **Developer mode**, and **Load unpacked** the `grok-for-chrome` folder.
3. Pin **Grok for Chrome**, open the side panel, and sign in with [SuperGrok](https://x.ai/grok) or [X Premium+](https://x.com/i/premium_sign_up).
4. Sign in on a normal `https` page, not `chrome://`.

Sign-in is xAI OAuth (device code) at [auth.x.ai](https://auth.x.ai). No API key file on the device.

## Models

**Grok** (uses your Grok sign-in):

- Grok 4.6 (default)
- Grok 4.5
- Grok 4.3
- Grok 4.2 Reasoning
- Grok 4.2 Non-reasoning
- Grok 4.2 Multi-agent

**Optional add-on — Meta Muse** (enable with **+** on Options → Models, then save a [Meta API key](https://dev.meta.ai/)):

- Muse Spark 1.2
- Muse Spark 1.1
- Muse Spark 1.2 Contributor (may train future Meta models)

The picker stays Grok-only until a Meta key is saved.

## Support

If this is useful: [buymeacoffee.com/egedincer](https://buymeacoffee.com/egedincer)
