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
- **Muse Spark 1.2 Contributor** (`muse-spark-1.2-contributor`) — Meta Model API key required
- **Cursor Auto** (`cursor-auto`) — Cursor subscription
- **Cursor Auto (Smart)** (`cursor-auto-smart`) — Cursor Router
- **Composer 2** (`cursor-composer-2`) — Cursor subscription
- **Cursor Grok 4.6** (`cursor-grok-4.6`) — Grok via Cursor quota

Long-thread compression for Grok uses **Grok 4.2 Non-reasoning**. Muse uses Meta's 1M-token context and local clipping instead. Cursor models run as no-repo Cloud Agents and count against your Cursor plan.

## Meta Muse API key

Muse Spark 1.2 Contributor talks to `https://api.meta.ai/v1` with a key you create in the [Meta Model API dashboard](https://dev.meta.ai/). Open the extension **Options** page (chrome://extensions → Grok → Details → Extension options) and paste the key there. Enterprise admins can also set the `metaApiKey` managed-policy field.

Contributor-tier prompts and completions may be used to train future Meta models. Grok sign-in is unchanged and still used for every Grok model.

## Cursor OAuth and quota

Cursor sign-in uses the same browser login as the Cursor SDK / CLI (`/loginDeepControl` + `POST /auth/poll`), then mints a user API key. Usage for Cursor models is billed to your [Cursor subscription](https://cursor.com/pricing) through the official Cloud Agents API.

1. Open **Extension options**.
2. Click **Sign in with Cursor** (or paste a `crsr_` key from [cursor.com/dashboard/api](https://cursor.com/dashboard/api)).
3. Pick a Cursor model in the side panel.
4. Optional: enable **Use Cursor quota for Grok models too** to send the existing Grok picker entries through Cursor instead of xAI.

Enterprise admins can set the `cursorApiKey` managed-policy field. Grok device-code login is unchanged when that box is off.

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
