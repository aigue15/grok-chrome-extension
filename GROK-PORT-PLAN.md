# Plan: Claude for Chrome → Grok backend port

Goal: this folder is the official **Claude for Chrome** extension (v1.0.85, compiled/minified Vite bundles). It must keep its original UI, tools, permissions flow, and browser-control behavior, but talk to **xAI Grok** instead of Anthropic. Only the working model changes.

Non-goals: no UI redesign, no rebuild from source, no new features, no Cowork/Claude-Desktop integration.

---

## 1. Architecture (already in place — do not redesign)

Everything Grok-specific lives in one adapter, `grok-bridge.js`, loaded **first** by every entry point:

- `service-worker-loader.js` → `import './grok-bridge.js'` then `./assets/service-worker.ts-Qx93VBt4.js`
- `sidepanel.html`, `options.html`, `pairing.html` → `<script type="module" src="/grok-bridge.js">` before the page bundle

What the bridge does:

1. **Patches `globalThis.fetch`** — any URL matching `shouldIntercept()` (api.anthropic.com, claude.ai/api, claude.ai/oauth, platform.claude.com, claudeusercontent.com) is answered locally by `handleAnthropic()`:
   - `/api/bootstrap/features/` → `GROK_FEATURES` (feature flags incl. models + system prompts)
   - `/api/oauth/profile` → synthetic Grok profile (`claude_max` org so no upgrade nags)
   - OAuth token endpoint → returns/refreshes stored xAI tokens
   - `/v1/models` → Grok 4.6 / Grok 4.5
   - `/v1/messages` → `proxyMessages()` → translated to xAI `POST https://api.x.ai/v1/chat/completions`, response translated back to Anthropic Messages format (incl. SSE stream re-encoding: `message_start`, `content_block_*`, `input_json_delta`, `message_stop`)
   - telemetry/misc endpoints → benign stubs
2. **Patches `WebSocket`** — `wss://bridge.claudeusercontent.com` (Claude Desktop pairing) gets a local stub socket that opens and answers `waiting`/`pong`. Nothing leaves the machine.
3. **Patches auth entry** — `chrome.identity.launchWebAuthFlow` and `chrome.tabs.create` intercept Claude OAuth URLs and instead run the **xAI device-code flow** (same as Hermes Agent):
   - client id `b1a00492-073a-47ea-816f-4c329264a828`
   - scopes `openid profile email offline_access grok-cli:access api:access`
   - discovery `https://auth.x.ai/.well-known/openid-configuration`, device endpoint `https://auth.x.ai/oauth2/device/code`, grant `urn:ietf:params:oauth:grant-type:device_code`
   - tokens stored in `chrome.storage` under the app's own keys: `accessToken`, `refreshToken`, `tokenExpiry`, `accountUuid` (the compiled app reads exactly these — confirmed in `assets/mcpPermissions-192xiXNg.js`: `e.ACCESS_TOKEN="accessToken"...`). Sign-out therefore works through the app's normal path.
4. **Feature-flag override** — sets `globalThis.__GROK_FEATURE_VALUES`; `assets/mcpPermissions-192xiXNg.js` was patched so `getFeatureValue`/`getFeatureValueAsync` and the FeatureProvider fallback **prefer** `__GROK_FEATURE_VALUES` over fetched/cached flags. This is what feeds the models list and the system prompt.
5. **`chrome.debugger.detach` wrapper** — swallows "Debugger is not attached" (reads `runtime.lastError` in the callback). A matching fix is inline in `mcpPermissions` `detachDebugger`.

### Surgical edits already made in compiled bundles (do not revert)

- Model IDs replaced everywhere they were defaults: `claude-sonnet-4-5-20250929` → `grok-4.6`, `claude-haiku-4-5-20251001` → `grok-4.5`, `claude-3-5-sonnet-20241022` → `grok-4.6` (sidepanel + options bundles). Remaining `claude-opus-4-6` / `claude-mythos-preview` strings are inside the vendored Anthropic SDK's long-request warning lists — harmless, leave them.
- `mcpPermissions-192xiXNg.js`: feature-value precedence patch (above) + `detachDebugger` lastError fix.
- All `<link rel="modulepreload">` removed from HTML entries (they caused cross-world resource warnings). Do not re-add.
- `manifest.json`: name **Grok**, Web Store `key`/`update_url` removed, CSP `connect-src` includes `https://api.x.ai https://auth.x.ai https://accounts.x.ai`.

### Bugs already fixed — do not regress

| Symptom | Cause | Fix in place |
|---|---|---|
| WS 403 to bridge.claudeusercontent.com | Claude Desktop pairing socket | local `LocalGrokBridgeSocket` stub |
| React error #185 (max update depth) | `m("chrome_ext_version_info", {})` returned a fresh `{}` each render | stable `EMPTY_OBJECT` values via `__GROK_FEATURE_VALUES` |
| "Unable to initialize the chat session" | `chrome_ext_system_prompt` flag had no `systemPrompt` string | `GROK_SYSTEM_PROMPT` / `GROK_SKIP_PERMS_PROMPT` in grok-bridge; placeholders `{{currentDate}}`, `{{currentDateTime}}`, `{{modelName}}` are substituted by the app |
| "Debugger is not attached to the tab" | detach on never-attached tab, `lastError` unread | debugger.detach wrapper + mcpPermissions patch |

---

## 2. Work items for the implementation pass

Ordered. P0 = required for correct operation, P1 = cleanup, P2 = optional polish.

### P0-1. Fix `/v1/messages/count_tokens` routing (real bug)

In `grok-bridge.js` → `handleAnthropic()`, the branch `path.includes("/v1/messages")` also matches `/v1/messages/count_tokens`, so token-count requests are currently sent to xAI as a **full chat completion** (wasted call, wrong response shape).

Fix: add **before** the `/v1/messages` branch:

```js
if (path.includes("/v1/messages/count_tokens")) {
  const raw = typeof init?.body === "string" ? init.body : await new Response(init?.body).text();
  return jsonResponse({ input_tokens: Math.max(1, Math.ceil((raw?.length || 4) / 4)) });
}
```

Acceptance: no `chat/completions` call fires when the app counts tokens; long conversations still compact correctly.

### P0-2. Verify/normalize stub shapes for `/v1/sessions`, `/v1/skills`, `/v1/files`

These currently all return `{ ok: true, data: [] }`. GET-list callers usually want `{ data: [], has_more: false }`; a POST create may want an object with an `id`. Runtime-verify: open the side panel with DevTools, watch for `TypeError: ... of undefined` traces pointing at these paths. If any appear, split the branch:

```js
if (path.includes("/v1/sessions")) {
  if ((init?.method || "GET").toUpperCase() === "POST")
    return jsonResponse({ id: `session_${crypto.randomUUID()}`, type: "session" });
  return jsonResponse({ data: [], has_more: false });
}
```

Same pattern for `/v1/skills` and `/v1/files` if errors surface. Do not change them blindly if nothing breaks.

### P0-3. Remove `nativeMessaging` permission

Claude Desktop pairing is dead (WS stubbed) but `manifest.json` still declares `"nativeMessaging"`, so `assets/service-worker.ts-Qx93VBt4.js`'s `chrome.permissions.contains({permissions:["nativeMessaging"]})` check passes and it attempts `connectNative` → "native messaging host not found" noise. Deleting the permission makes that check fail cleanly (the SW already handles that path). Keep `downloads` (used by GIF recording), keep everything else.

Acceptance: no native-host errors in the SW console after reload.

### P0-4. End-to-end send verification (the critical path)

After reload, with a SuperGrok / X Premium+ account:

1. Sign in → device-code tab opens on auth.x.ai → approve → side panel shows signed-in profile ("Grok", claude_max tier internally).
2. Send "hello" → confirm in SW/network logs: exactly one `POST https://api.x.ai/v1/chat/completions` with `Authorization: Bearer …`, `stream: true`; streamed text renders token-by-token.
3. Trigger a tool call (e.g. "read this page and summarize") → confirm `tool_calls` deltas arrive as `input_json_delta`, tool executes, result goes back as a `tool_result` block, second round-trip completes.
4. Switch model to Grok 4.5 in the picker → next request body has `"model":"grok-4.5"`.
5. Attach an image → request contains `image_url` data-URL part. If xAI rejects images for these models (400), add a graceful fallback in `anthropicMessagesToOpenAI`: replace image parts with `[image attached — not supported by this model]` text instead of failing the whole request.

Known external risk: xAI returns 403 on the device-code flow for some account tiers (same as Hermes). Surface the error message the bridge already produces; nothing to code around.

### P0-5. Tool-schema sanitation (verify, likely no-op)

`anthropicToolsToOpenAI()` passes Anthropic `input_schema` straight through as OpenAI `parameters`. xAI is OpenAI-compatible and lenient, but if a 400 mentions schema validation, strip unsupported keywords (`$schema`, `additionalProperties: false` is fine; watch for `format` values) recursively. Only implement if a real 400 occurs.

### P1-1. Delete leftover Grok-for-Chrome clone directories

A previous approach rsynced parts of another project in. These are **unreferenced** by `manifest.json`, the HTML entries, and `service-worker-loader.js` (verified by grep): delete `background/`, `content/`, `icons/`, `lib/`, `options/`, `sidepanel/`.

Careful: do NOT delete `assets/` (real app), `i18n/`, `offscreen*`, `public/`, `sounds/`, `gif*`, `blocked.html`, `managed_schema.json` — all original.

### P1-2. Trim CSP telemetry hosts (block analytics at the browser level)

`manifest.json` CSP `connect-src` still allows `api.segment.io`, `*.segment.com`, `*.ingest.us.sentry.io`, `api.honeycomb.io`, `browser-intake-us5-datadoghq.com`. Anthropic-bound telemetry is already intercepted by the fetch patch, but Segment/Sentry/Datadog calls go direct. Removing those hosts from CSP hard-blocks them (requests fail silently; the app tolerates it). Keep `https://api.anthropic.com`, `https://claude.ai`, `https://platform.claude.com`, and the `wss://` bridge entries in CSP — the SDK still *constructs* requests to them and interception happens in JS, but leave them to avoid CSP violations from any non-patched path (workers, beacons). Keep the three x.ai hosts.

### P1-3. Confirm sign-out

Use the app's own sign-out. It clears `accessToken`/`refreshToken`/`tokenExpiry` (the bridge's keys). Verify after sign-out: sending a message yields the "Sign in to start a conversation." state, and sign-in works again. If stale `grokAccountUuid`/`grokIdToken`/`grokAuth`/`grokTokenEndpoint` keys cause a phantom logged-in profile, clear those extra keys when `/api/oauth/profile` finds no access/refresh token (edit `grokProfile()` in `grok-bridge.js`).

### P2-1. Branding (optional, cosmetic)

- `icon-128.png` and `claude_icon.svg` are still Claude art. Swap `icon-128.png` for a Grok icon if desired (`manifest.json` only references `icon-128.png`).
- Visible UI strings inside `assets/sidepanel-BSS8ARkQ.js` still say "Claude" in places (headers, empty states). Bulk find/replace in the minified bundle is **risky** (the word appears in URLs, event names, CSS classes like `claude-response`, i18n keys). Only replace exact user-facing sentence strings, one at a time, verifying the extension still loads after each. Skip entirely if not important.
- Links to `claude.ai/upgrade`, `claude.ai/settings/...` in menus will just open claude.ai; harmless. Optionally intercept in `chrome.tabs.create` patch and route to `https://x.ai` — low value.

### P2-2. SSE niceties (only if the UI misbehaves)

The stream translator doesn't emit `ping` events or real `usage` tokens in `message_delta`. The UI tolerates this. If a "context left" meter looks wrong, wire `chunk.usage` (xAI sends usage on the final chunk when `stream_options: {"include_usage": true}` is added to the payload) into the final `message_delta.usage.output_tokens`.

---

## 3. Invariants — things the implementer must NOT do

1. Do not re-enable `chrome_ext_cowork_iframe` (embeds claude.ai).
2. Do not remove or reorder `grok-bridge.js` script tags — it must run before each page bundle, and first in the SW loader.
3. Do not re-add `<link rel="modulepreload">` to the HTML entries.
4. Do not revert the `__GROK_FEATURE_VALUES`-first patch in `mcpPermissions-192xiXNg.js` (three sites: `getFeatureValue`, `getFeatureValueAsync`, FeatureProvider `useCallback`).
5. Do not give features `{}` literals per-render — reuse the stable constants in `grok-bridge.js` (`EMPTY_OBJECT` etc.); React #185 regression otherwise.
6. Do not touch the two content scripts (`accessibility-tree.js-B-oUarrX.js`, `agent-visual-indicator.js-CwioqiOd.js`) — browser tools depend on them.
7. Keep storage keys exactly `accessToken` / `refreshToken` / `tokenExpiry` / `accountUuid` — the compiled app reads those names.
8. Never write an API key to disk and never add a native host — auth is web device-code only.
9. Models stay exactly `grok-4.6` (default) and `grok-4.5` (small/fast); `mapModel()` maps any Claude id → grok.

---

## 4. File map

| Path | Role |
|---|---|
| `grok-bridge.js` | The entire Grok adapter (auth, fetch/WS/debugger patches, API translation, feature flags, system prompt) |
| `manifest.json` | MV3 manifest, renamed Grok, x.ai hosts in CSP |
| `service-worker-loader.js` | bridge + original SW import |
| `sidepanel.html` / `options.html` / `pairing.html` | entries; bridge loaded first |
| `assets/service-worker.ts-Qx93VBt4.js` | original compiled SW (untouched) |
| `assets/sidepanel-BSS8ARkQ.js` | main UI bundle (model IDs swapped; session-init logic lives here) |
| `assets/mcpPermissions-192xiXNg.js` | auth/flags/SDK bundle (patched: feature precedence, detach lastError) |
| `assets/options-C0QRRkur.js` | options UI bundle (model IDs swapped) |
| `background/`, `content/`, `icons/`, `lib/`, `options/`, `sidepanel/` | dead leftovers from another project → delete (P1-1) |
| `README.md` | install + sign-in instructions |

## 5. Final acceptance checklist

- [ ] Loads unpacked with zero errors on `chrome://extensions` (Errors page empty after reload + one full use)
- [ ] Device-code sign-in completes; profile shows; tokens refresh after expiry (set `tokenExpiry` to `Date.now()` in storage and send a message to force refresh)
- [ ] Plain chat streams correctly on grok-4.6; model switch to grok-4.5 works
- [ ] Page-read, click, screenshot, and multi-step tool loops work on a normal https page
- [ ] Permission prompts (site access) still appear and are honored
- [ ] count_tokens no longer triggers chat completions (P0-1)
- [ ] No native-messaging errors (P0-3), no debugger detach errors, no WS 403s
- [ ] Sign out → sign in cycle clean (P1-3)
