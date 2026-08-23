# Grok for Chrome

This is the official **Claude for Chrome** extension, connected to **Grok** instead of Claude. Browser control, the side panel, tools, and the rest of the product are unchanged.

## Connection (same as Hermes Agent)

Sign-in is **xAI OAuth device-code** against [auth.x.ai](https://auth.x.ai) — the same public client and scopes Hermes Agent uses. Nothing is installed on the device: no API key file, no native host, no Claude Desktop pairing.

- Client ID: `b1a00492-073a-47ea-816f-4c329264a828`
- Scopes: `openid profile email offline_access grok-cli:access api:access`
- API: `https://api.x.ai/v1`
- Subscription: [SuperGrok](https://x.ai/grok) or [X Premium+](https://x.com/i/premium_sign_up)

Click **Log in** in the side panel. Chrome opens an xAI / accounts.x.ai page. Approve access (enter the code if asked). Tokens stay in extension storage and refresh in the background.

## Models

The model picker offers:

- **Grok 4.6** (default)
- **Grok 4.5**
- **Grok 4.3**
- **Grok 4.2 Reasoning** (`grok-4.20-0309-reasoning`)
- **Grok 4.2 Non-reasoning** (`grok-4.20-0309-non-reasoning`)
- **Grok 4.2 Multi-agent** (`grok-4.20-multi-agent-0309`)

Long-thread compression uses **Grok 4.2 Non-reasoning**.

## Install (unpacked)

1. Remove or disable the Chrome Web Store **Claude** extension if it is installed (same side-panel slot).
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → this folder (the one that contains `manifest.json`)
5. Pin **Grok** and open the side panel
6. Sign in with your Grok subscription

## What stayed the same

Page reading, the accessibility tree, the on-page cursor, clicks / typing / screenshots, tab groups, permissions, shortcuts, and the existing side-panel UI all still come from this extension. Only the Anthropic login and `/v1/messages` backend were swapped for Grok.

Reload the unpacked extension on `chrome://extensions` after any code change. Sign in on a normal `https` page, not `chrome://`.
