# Grok for Chrome

A Chrome side-panel browser agent powered by **Grok**, with optional **Muse Spark** models after you add a Meta API key. It can read the page, click, type, take screenshots, and work across tab groups.

This is an independent project. It is not affiliated with Anthropic, xAI, or Meta.

## Sign in

Sign-in is **xAI OAuth device-code** against [auth.x.ai](https://auth.x.ai) — the same public client and scopes Hermes Agent uses. Nothing is installed on the device: no API key file, no native host.

- Client ID: `b1a00492-073a-47ea-816f-4c329264a828`
- Scopes: `openid profile email offline_access grok-cli:access api:access`
- API: `https://api.x.ai/v1`
- Subscription: [SuperGrok](https://x.ai/grok) or [X Premium+](https://x.com/i/premium_sign_up)

Click **Log in** in the side panel. Chrome opens an xAI / accounts.x.ai page. Approve access (enter the code if asked). Tokens stay in extension storage and refresh in the background.

## Models

- **Grok 4.6** (default)
- **Grok 4.5**
- **Grok 4.3**
- **Grok 4.2 Reasoning** (`grok-4.20-0309-reasoning`)
- **Grok 4.2 Non-reasoning** (`grok-4.20-0309-non-reasoning`)
- **Grok 4.2 Multi-agent** (`grok-4.20-multi-agent-0309`)
The picker starts with Grok models only. After you save a Meta Model API key, these appear too:

- **Muse Spark 1.2** (`muse-spark-1.2`) — standard tier
- **Muse Spark 1.1** (`muse-spark-1.1`) — standard tier
- **Muse Spark 1.2 Contributor** (`muse-spark-1.2-contributor`) — may train future Meta models

Hide models from the picker in **chrome://extensions → Grok for Chrome → Extension options → Models**. Clearing the Meta key hides Muse models again.

Long-thread compression for Grok uses **Grok 4.2 Non-reasoning**. Muse uses Meta's 1M-token context and local clipping instead.

## Meta Muse API key

Muse models talk to `https://api.meta.ai/v1` with a key you create in the [Meta Model API dashboard](https://dev.meta.ai/). Open **chrome://extensions → Grok for Chrome → Details → Extension options → Models** and paste the key there — that is what unlocks them in the picker. Enterprise admins can also set the `metaApiKey` managed-policy field.

Contributor-tier prompts and completions may be used to train future Meta models. Grok sign-in is unchanged and still used for every Grok model.

## Install (unpacked)

1. If the Chrome Web Store **Claude** extension is installed, disable it (same side-panel slot).
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → this folder (the one that contains `manifest.json`)
5. Pin **Grok for Chrome** and open the side panel
6. Sign in with your Grok subscription

Reload the unpacked extension on `chrome://extensions` after any code change. Sign in on a normal `https` page, not `chrome://`.
