import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

app.registerExtension({
    name: "Comfy.GrokImagineBrowser",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "GrokImagineBrowser") {  // <-- Change node name here if you update Python side too
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                const widgetDiv = document.createElement("div");
                widgetDiv.style.display = "flex";
                widgetDiv.style.flexDirection = "column";
                widgetDiv.style.width = "100%";
                widgetDiv.dataset.captureWheel = "true";
                widgetDiv.addEventListener("wheel", (e) => {
                    e.stopPropagation();
                });

                // Hidden widget to output pasted/captured image URLs to ComfyUI
                const imageUrlWidget = this.addWidget("hidden_text", "image_url", "", () => {}, { multiline: true });
                imageUrlWidget.draw = function() {};
                imageUrlWidget.computeSize = function() { return [0, 0]; };

                this.addDOMWidget("browser", "div", widgetDiv);

                widgetDiv.innerHTML = `
                    <style>
                        .browser-controls { padding: 8px; background: #222; display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
                        .browser-url-input { flex-grow: 1; background: #111; color: #eee; border: 1px solid #444; border-radius: 4px; padding: 6px; }
                        .browser-btn { background: #333; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; }
                        .browser-btn:hover { background: #555; }
                        .grok-hint { padding: 8px; background: #2a2a2a; color: #aaa; font-size: 0.9em; text-align: center; }
                        .image-capture { display: flex; gap: 6px; padding: 8px; background: #1a1a1a; border-top: 1px solid #333; }
                        .image-capture input { flex-grow: 1; background: #111; color: #eee; border: 1px solid #444; border-radius: 4px; padding: 6px; }
                    </style>

                    <div class="browser-controls">
                        <button class="browser-btn browser-home-btn" title="Go to Grok">Grok Home</button>
                        <input type="text" class="browser-url-input" placeholder="https://x.com/i/grok" value="https://x.com/i/grok" />
                        <button class="browser-btn browser-go">Go</button>
                    </div>

                    <div class="grok-hint">
                        Paste your prompt into the Grok chat box below.<br>
                        After generation, right-click image/video → Copy image address → paste here ↓
                    </div>

                    <div class="image-capture">
                        <input type="text" class="browser-image-url" placeholder="Paste generated image/video URL here" />
                        <button class="browser-btn browser-load-image-btn">Load to ComfyUI</button>
                        <span class="status-icon" style="color:#4caf50; font-weight:bold; display:none;">✓</span>
                    </div>

                    <iframe style="flex-grow: 1; border: none; width: 100%; background: #111;" allowfullscreen></iframe>
                `;

                const urlInput          = widgetDiv.querySelector(".browser-url-input");
                const goButton          = widgetDiv.querySelector(".browser-go");
                const homeButton        = widgetDiv.querySelector(".browser-home-btn");
                const imageUrlInput     = widgetDiv.querySelector(".browser-image-url");
                const loadImageBtn      = widgetDiv.querySelector(".browser-load-image-btn");
                const statusIcon        = widgetDiv.querySelector(".status-icon");
                const iframe            = widgetDiv.querySelector("iframe");

                // Restrict to Grok / X domains only
                const allowedDomains = ["x.com", "twitter.com", "grok.x.ai"];
                const isAllowed = (url) => {
                    try {
                        const u = new URL(url);
                        return allowedDomains.some(d => u.hostname === d || u.hostname.endsWith("." + d));
                    } catch {
                        return false;
                    }
                };

                const navigate = (url) => {
                    if (!url) return;
                    if (!url.startsWith("http")) url = "https://" + url;
                    if (!isAllowed(url)) {
                        alert("Navigation restricted to x.com / Grok domains only.");
                        return;
                    }
                    urlInput.value = url;
                    iframe.src = url;
                };

                // Default to Grok chat
                let homeUrl = localStorage.getItem("grokHomeUrl") || "https://x.com/i/grok";
                homeButton.addEventListener("click", () => navigate(homeUrl));

                // Allow changing home (right-click)
                homeButton.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    const newUrl = prompt("Set new Grok homepage:", homeUrl);
                    if (newUrl && isAllowed(newUrl)) {
                        homeUrl = newUrl.trim();
                        localStorage.setItem("grokHomeUrl", homeUrl);
                        alert("Homepage updated to: " + homeUrl);
                    } else if (newUrl) {
                        alert("Only x.com / Grok URLs allowed.");
                    }
                });

                goButton.addEventListener("click", () => navigate(urlInput.value.trim()));
                urlInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") navigate(urlInput.value.trim());
                });

                // Block navigation to disallowed domains
                iframe.addEventListener("load", () => {
                    try {
                        if (!isAllowed(iframe.src)) {
                            alert("Blocked navigation outside Grok/X domains.");
                            navigate(homeUrl);
                        }
                    } catch {}
                });

                // Load image URL → feed to ComfyUI
                loadImageBtn.addEventListener("click", () => {
                    const url = imageUrlInput.value.trim();
                    if (url) {
                        imageUrlWidget.value = url;
                        statusIcon.style.display = "inline";
                        setTimeout(() => { statusIcon.style.display = "none"; }, 1800);
                    }
                });

                imageUrlInput.addEventListener("paste", (e) => {
                    // Optional: auto-trigger load on paste
                    setTimeout(() => {
                        if (imageUrlInput.value.trim()) {
                            loadImageBtn.click();
                        }
                    }, 100);
                });

                // Enforce minimum size for usability
                this.onResize = function(size) {
                    const minWidth = 680;
                    const minHeight = 520;
                    if (size[0] < minWidth) size[0] = minWidth;
                    if (size[1] < minHeight) size[1] = minHeight;

                    const headerHeight ≈ 120; // controls + hint + loader
                    widgetDiv.style.height = (size[1] - headerHeight) + "px";
                };

                this.size = [800, 720];

                // Initial load
                navigate(homeUrl);

                requestAnimationFrame(() => {
                    if (this.onResize) this.onResize(this.size);
                });

                return r;
            };
        }
    },
});
