// Offscreen document for playing notification sounds
// This runs in a hidden document context that can play audio

console.log("[Offscreen] Document loaded and ready");

// SW keepalive — offscreen docs aren't subject to MV3's 30s idle kill. A
// message every 20s resets the SW's idle timer, keeping the bridge WS
// setInterval ping running under background throttle/freeze.
setInterval(() => {
  chrome.runtime.sendMessage({ type: "SW_KEEPALIVE" }).catch(() => {
    // SW restarting — self-heals via setupOffscreenDocument at next startup
  });
}, 20_000);

// AudioContext is lazy — the doc is persistent for keepalive, so avoid
// allocating audio resources until a sound actually needs to play.
let audioContext;
function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
    console.log("[Offscreen] AudioContext created, state:", audioContext.state);
  }
  return audioContext;
}

// Play audio using Web Audio API (bypasses autoplay restrictions better)
async function playAudioWithWebAudioAPI(audioUrl, volume) {
  const ctx = getAudioContext();
  try {
    console.log("[Offscreen] Fetching audio file:", audioUrl);

    // Fetch the audio file
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();

    console.log("[Offscreen] Audio file fetched, decoding...");

    // Decode the audio data
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    console.log("[Offscreen] Audio decoded, creating source...");

    // Create buffer source
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Create gain node for volume control
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;

    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Resume audio context if needed
    if (ctx.state === "suspended") {
      console.log("[Offscreen] Resuming AudioContext...");
      await ctx.resume();
    }

    console.log("[Offscreen] Starting playback...");
    source.start(0);

    return new Promise((resolve, reject) => {
      source.onended = () => {
        console.log("[Offscreen] Playback finished");
        resolve();
      };
      source.onerror = (error) => {
        console.error("[Offscreen] Source error:", error);
        reject(error);
      };
    });
  } catch (error) {
    console.error("[Offscreen] Web Audio API error:", error);
    throw error;
  }
}

// ============ DRAWING FUNCTIONS (ported from gifCanvas.ts and gifOverlays.ts) ============

/**
 * Draw a click indicator (orange circle) on the canvas
 * Scales all sizes by scaleFactor for high-DPI displays
 */
function drawClickIndicator(ctx, x, y, scaleFactor = 1) {
  ctx.save();

  // Outer glow (scaled)
  ctx.beginPath();
  ctx.arc(x, y, 15 * scaleFactor, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(207, 107, 60, 0.3)";
  ctx.fill();

  // Inner circle (scaled)
  ctx.beginPath();
  ctx.arc(x, y, 11 * scaleFactor, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(207, 107, 60, 0.5)";
  ctx.fill();

  // Border (scaled)
  ctx.beginPath();
  ctx.arc(x, y, 11 * scaleFactor, 0, 2 * Math.PI);
  ctx.strokeStyle = "rgba(207, 107, 60, 1)";
  ctx.lineWidth = 2 * scaleFactor;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a drag path with arrow on the canvas
 * Scales all sizes by scaleFactor for high-DPI displays
 */
function drawDragPath(ctx, startX, startY, endX, endY, scaleFactor = 1) {
  ctx.save();

  // Draw line (scaled)
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 3 * scaleFactor;
  ctx.stroke();

  // Draw arrowhead at end (scaled)
  const angle = Math.atan2(endY - startY, endX - startX);
  const arrowLength = 15 * scaleFactor;

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - arrowLength * Math.cos(angle - Math.PI / 6),
    endY - arrowLength * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    endX - arrowLength * Math.cos(angle + Math.PI / 6),
    endY - arrowLength * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fillStyle = "#dc2626";
  ctx.fill();

  // Draw start marker (scaled)
  ctx.beginPath();
  ctx.arc(startX, startY, 6 * scaleFactor, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#cf6b3c";
  ctx.lineWidth = 2 * scaleFactor;
  ctx.stroke();

  // Draw end marker (scaled)
  ctx.beginPath();
  ctx.arc(endX, endY, 6 * scaleFactor, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 2 * scaleFactor;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw an action label on the canvas
 * Scales all sizes by scaleFactor for high-DPI displays
 */
function drawActionLabel(ctx, text, x, y, scaleFactor = 1) {
  ctx.save();

  // Set font (scaled)
  const fontSize = 14 * scaleFactor;
  ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Measure text
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 20 * scaleFactor;
  const padding = 8 * scaleFactor;

  // Adjust position if too close to edges (scaled offsets)
  let labelX = x + 20 * scaleFactor;
  let labelY = y - 10 * scaleFactor;

  if (labelX + textWidth + padding * 2 > ctx.canvas.width) {
    labelX = x - textWidth - padding * 2 - 20 * scaleFactor;
  }

  if (labelY < 0) {
    labelY = y + 20 * scaleFactor;
  }

  // Draw background with rounded corners (scaled)
  const bgX = labelX;
  const bgY = labelY;
  const bgWidth = textWidth + padding * 2;
  const bgHeight = textHeight + padding;
  const radius = 6 * scaleFactor;

  ctx.beginPath();
  ctx.moveTo(bgX + radius, bgY);
  ctx.lineTo(bgX + bgWidth - radius, bgY);
  ctx.quadraticCurveTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + radius);
  ctx.lineTo(bgX + bgWidth, bgY + bgHeight - radius);
  ctx.quadraticCurveTo(
    bgX + bgWidth,
    bgY + bgHeight,
    bgX + bgWidth - radius,
    bgY + bgHeight,
  );
  ctx.lineTo(bgX + radius, bgY + bgHeight);
  ctx.quadraticCurveTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - radius);
  ctx.lineTo(bgX, bgY + radius);
  ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
  ctx.closePath();

  // Shadow (scaled)
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4 * scaleFactor;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2 * scaleFactor;

  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Draw text
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, bgX + padding, bgY + padding);

  ctx.restore();
}

/**
 * Draw a progress bar at the bottom of the canvas
 * Scales bar height by scaleFactor for high-DPI displays
 */
function drawProgressBar(ctx, progress, scaleFactor = 1) {
  ctx.save();

  const barHeight = 4 * scaleFactor;
  const barWidth = ctx.canvas.width;
  const progressWidth = barWidth * progress;
  const y = ctx.canvas.height - barHeight;

  // Draw background
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(0, y, barWidth, barHeight);

  // Draw progress
  ctx.fillStyle = "#C96442";
  ctx.fillRect(0, y, progressWidth, barHeight);

  ctx.restore();
}

/**
 * Draw Grok icon watermark on the canvas
 * Scales logo size and padding by scaleFactor for high-DPI displays
 */
function drawWatermark(ctx, scaleFactor = 1) {
  ctx.save();

  const padding = 8 * scaleFactor;
  const logoSize = 32 * scaleFactor;
  const x = ctx.canvas.width - padding - logoSize;
  const y = ctx.canvas.height - padding - logoSize - 4 * scaleFactor;
  const radius = logoSize * 0.22;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + logoSize - radius, y);
  ctx.quadraticCurveTo(x + logoSize, y, x + logoSize, y + radius);
  ctx.lineTo(x + logoSize, y + logoSize - radius);
  ctx.quadraticCurveTo(
    x + logoSize,
    y + logoSize,
    x + logoSize - radius,
    y + logoSize,
  );
  ctx.lineTo(x + radius, y + logoSize);
  ctx.quadraticCurveTo(x, y + logoSize, x, y + logoSize - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = "#0A0A0A";
  ctx.fill();

  const cx = x + logoSize / 2;
  const cy = y + logoSize / 2;
  const outer = logoSize * 0.34;
  const inner = logoSize * 0.13;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    const tipX = cx + outer * Math.cos(a);
    const tipY = cy + outer * Math.sin(a);
    const rightX = cx + inner * Math.cos(a + Math.PI / 6);
    const rightY = cy + inner * Math.sin(a + Math.PI / 6);
    const leftX = cx + inner * Math.cos(a - Math.PI / 6);
    const leftY = cy + inner * Math.sin(a - Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(rightX, rightY);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fillStyle = "rgba(186, 186, 190, 0.95)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, logoSize * 0.035, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  ctx.restore();
}

/**
 * Apply action indicators to a canvas based on action metadata
 * Applies coordinate scaling to account for device pixel ratio
 */
function applyActionIndicators(canvas, action, options, scaleFactor = 1) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !action) return;

  // Draw click indicator
  if (
    options.showClickIndicators &&
    action.coordinate &&
    (action.type.includes("click") || action.type === "scroll")
  ) {
    const [x, y] = action.coordinate;
    // Scale coordinates from viewport space to screenshot space
    const scaledX = x * scaleFactor;
    const scaledY = y * scaleFactor;
    drawClickIndicator(ctx, scaledX, scaledY, scaleFactor);

    // Draw action label near click
    if (options.showActionLabels && action.description) {
      drawActionLabel(ctx, action.description, scaledX, scaledY, scaleFactor);
    }
  }

  // Draw drag path
  if (
    options.showDragPaths &&
    action.type === "left_click_drag" &&
    action.start_coordinate &&
    action.coordinate
  ) {
    const [startX, startY] = action.start_coordinate;
    const [endX, endY] = action.coordinate;
    // Scale coordinates from viewport space to screenshot space
    const scaledStartX = startX * scaleFactor;
    const scaledStartY = startY * scaleFactor;
    const scaledEndX = endX * scaleFactor;
    const scaledEndY = endY * scaleFactor;
    drawDragPath(
      ctx,
      scaledStartX,
      scaledStartY,
      scaledEndX,
      scaledEndY,
      scaleFactor,
    );

    // Draw action label near end point
    if (options.showActionLabels && action.description) {
      drawActionLabel(
        ctx,
        action.description,
        scaledEndX,
        scaledEndY,
        scaleFactor,
      );
    }
  }

  // Draw action label for non-coordinate actions
  if (
    options.showActionLabels &&
    action.description &&
    !action.coordinate &&
    (action.type === "type" || action.type === "key" || action.type === "wait")
  ) {
    // Place label in top-left area (scaled position)
    drawActionLabel(
      ctx,
      action.description,
      20 * scaleFactor,
      20 * scaleFactor,
      scaleFactor,
    );
  }
}

/**
 * Pad a canvas to `width × height` with white right/bottom borders. Returns
 * the original canvas unchanged when it already matches. Done as a separate
 * step AFTER overlays so the progress bar / watermark stay anchored to the
 * frame's visible edge instead of drifting into the padding strip.
 *
 * Mirrors `padCanvasToSize` in src/utils/gif/gifExport.ts — this file is a
 * plain-JS public asset for the offscreen document, so it cannot import the
 * TS module.
 */
function padCanvasToSize(canvas, width, height) {
  if (canvas.width === width && canvas.height === height) {
    return canvas;
  }
  const padded = document.createElement("canvas");
  padded.width = width;
  padded.height = height;
  const ctx = padded.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(canvas, 0, 0);
  return padded;
}

// ============ GIF GENERATION FUNCTION ============

/**
 * GIF generation function with full enhancement support
 */
async function generateGif(frames, options = {}) {
  console.log(`[Offscreen] Generating GIF from ${frames.length} frames`);
  console.log(`[Offscreen] Options:`, options);

  // Default options (match /share flow defaults)
  const enhancementOptions = {
    showClickIndicators: options.showClickIndicators ?? true,
    showDragPaths: options.showDragPaths ?? true,
    showActionLabels: options.showActionLabels ?? true,
    showProgressBar: options.showProgressBar ?? true,
    showWatermark: options.showWatermark ?? true,
  };

  // Load all images first
  const images = await Promise.all(
    frames.map((frame, index) => {
      console.log(`[Offscreen] Loading image ${index + 1}/${frames.length}`);
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          console.log(
            `[Offscreen] Image ${index + 1} loaded: ${img.width}x${img.height}`,
          );
          resolve(img);
        };
        img.onerror = reject;
        const dataUrl = `data:image/${frame.format || "png"};base64,${frame.base64}`;
        img.src = dataUrl;
      });
    }),
  );

  console.log(`[Offscreen] All ${images.length} images loaded`);

  // gif.js encodes against ONE fixed grid for the whole animation. Frame
  // sizes can vary now that zoom region crops are real frames (not
  // re-captured full screenshots) — pad smaller frames right/bottom with
  // white to the max size so every addFrame() canvas matches the encoder
  // dimensions.
  const width = Math.max(...images.map((img) => img.width));
  const height = Math.max(...images.map((img) => img.height));

  console.log(`[Offscreen] Enhancing frames with indicators and overlays...`);

  // Create enhanced canvases with all indicators and overlays
  const enhancedCanvases = images.map((img, index) => {
    // Render the image + overlays at the IMAGE's own size first. The
    // progress bar and watermark are bottom/right-anchored to canvas
    // bounds — drawing them on a pre-padded canvas would push them into the
    // white padding strip. Pad as a separate composite step below.
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");

    // Draw the base image
    ctx.drawImage(img, 0, 0);

    // Apply action indicators (clicks, drags, labels)
    const frame = frames[index];

    // Calculate scale factor for coordinate transformation
    // Coordinates are in viewport space (CSS pixels), need to scale to screenshot space
    // CDP screenshots are resized, so use actual canvas/viewport ratio, not DPR
    let scaleFactor = 1;
    if (frame.viewportWidth && canvas.width) {
      // Calculate actual scaling ratio: screenshot pixels / viewport CSS pixels
      scaleFactor = canvas.width / frame.viewportWidth;
      console.log(
        `[Offscreen] Frame ${index + 1}: Applying scale factor ${scaleFactor} (canvas: ${canvas.width}x${canvas.height}, viewport: ${frame.viewportWidth}x${frame.viewportHeight})`,
      );
    } else {
      console.log(
        `[Offscreen] Frame ${index + 1}: No viewport metadata, using scale factor 1.0 (backwards compatibility)`,
      );
    }

    if (frame.action) {
      applyActionIndicators(
        canvas,
        frame.action,
        enhancementOptions,
        scaleFactor,
      );
    }

    // Apply overlays (progress bar, watermark) with scaling
    const progress = (index + 1) / images.length;

    if (enhancementOptions.showProgressBar) {
      drawProgressBar(ctx, progress, scaleFactor);
    }

    if (enhancementOptions.showWatermark) {
      drawWatermark(ctx, scaleFactor);
    }

    console.log(
      `[Offscreen] Frame ${index + 1}/${images.length} enhanced (progress: ${Math.round(progress * 100)}%)`,
    );

    return padCanvasToSize(canvas, width, height);
  });

  console.log(
    `[Offscreen] Creating GIF encoder: ${width}x${height}, workers: 2`,
  );

  // Get frame delays if provided, otherwise use default
  // Add 2 seconds to the final frame for better viewing
  const frameDelays = frames.map((frame, index) => {
    const baseDelay = frame.delay || 800;
    const isLastFrame = index === frames.length - 1;
    return isLastFrame ? baseDelay + 2000 : baseDelay;
  });

  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality: options.quality || 10,
      width,
      height,
      workerScript: chrome.runtime.getURL("gif.worker.js"),
      repeat: 0,
      debug: true,
    });

    gif.on("progress", (percent) => {
      console.log(
        `[Offscreen] GIF encoding progress: ${Math.round(percent * 100)}%`,
      );
    });

    gif.on("finished", (blob) => {
      console.log(`[Offscreen] GIF created: ${blob.size} bytes`);

      // Create blob URL (available in offscreen document context)
      const blobUrl = URL.createObjectURL(blob);
      console.log(`[Offscreen] Created blob URL: ${blobUrl}`);

      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];
        console.log(
          `[Offscreen] Conversion complete, base64 length: ${base64.length}`,
        );
        resolve({
          base64,
          blobUrl,
          size: blob.size,
          width,
          height,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    gif.on("abort", () => reject(new Error("GIF rendering aborted")));

    // Add all enhanced frames with their individual delays
    enhancedCanvases.forEach((canvas, index) => {
      gif.addFrame(canvas, { delay: frameDelays[index] });
    });

    console.log(`[Offscreen] Starting GIF rendering...`);
    gif.render();
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OFFSCREEN_PLAY_SOUND") {
    console.log("[Offscreen] Received OFFSCREEN_PLAY_SOUND message");

    const volume = message.volume || 0.5;

    playAudioWithWebAudioAPI(message.audioUrl, volume)
      .then(() => {
        console.log("[Offscreen] Sound played successfully via Web Audio API");
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("[Offscreen] Failed to play sound:", error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate async response
    return true;
  }

  if (message.type === "REVOKE_BLOB_URL") {
    URL.revokeObjectURL(message.blobUrl);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "GENERATE_GIF") {
    console.log("[Offscreen] Received GENERATE_GIF message");
    console.log(`[Offscreen] Frames: ${message.frames?.length}`);
    console.log(`[Offscreen] Options:`, message.options);

    generateGif(message.frames, message.options)
      .then((result) => {
        console.log("[Offscreen] GIF generated successfully");
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        console.error("[Offscreen] Failed to generate GIF:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Async response
  }
});
