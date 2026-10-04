(() => {
  const STORAGE_KEY = "singulax-easter-theme";
  const THEME = "caitlyn";
  const RAIN_THEME = "rain";
  const SCRIPT_URL = document.currentScript?.src || new URL("browser/easter-theme.js", location.href).href;
  const CAITLYN_LOGO = new URL("../icons/caitlyn-logo.png", SCRIPT_URL).href;
  const DEFAULT_LOGO = new URL("../icons/logo.png", SCRIPT_URL).href;
  const DEFAULT_MANIFEST = new URL("../manifest.webmanifest", SCRIPT_URL).href;
  const CAITLYN_MANIFEST = new URL("../manifest-caitlyn.webmanifest", SCRIPT_URL).href;

  const css = `
    html.sgx-easter-theme, body.sgx-easter-theme {
      --sgx-red:#ef3b45;
      --sgx-red-2:#ff5962;
      --sgx-bg:#0c0b0d;
      --sgx-panel:#151214;
      --sgx-panel-2:#242126;
      --sgx-text:#f7eef0;
      --sgx-muted:#aa969b;
      --sgx-border:#43282e;
      --sgx-deep:#3a1116;
      background:var(--sgx-bg)!important;
      color:var(--sgx-text)!important;
    }

    body.sgx-easter-theme,
    body.sgx-easter-theme header,
    body.sgx-easter-theme nav,
    body.sgx-easter-theme aside,
    body.sgx-easter-theme main,
    body.sgx-easter-theme section,
    body.sgx-easter-theme article,
    body.sgx-easter-theme footer,
    body.sgx-easter-theme dialog,
    body.sgx-easter-theme .card,
    body.sgx-easter-theme .panel,
    body.sgx-easter-theme .window,
    body.sgx-easter-theme .editorWrap,
    body.sgx-easter-theme .tabs,
    body.sgx-easter-theme .studioTabs,
    body.sgx-easter-theme .blockbar {
      border-color:var(--sgx-border)!important;
    }

    body.sgx-easter-theme header,
    body.sgx-easter-theme aside,
    body.sgx-easter-theme nav,
    body.sgx-easter-theme .panel,
    body.sgx-easter-theme .window,
    body.sgx-easter-theme .editorWrap,
    body.sgx-easter-theme .tabs,
    body.sgx-easter-theme .studioTabs,
    body.sgx-easter-theme .blockbar,
    body.sgx-easter-theme dialog {
      background:var(--sgx-panel)!important;
      color:var(--sgx-text)!important;
    }

    body.sgx-easter-theme .card,
    body.sgx-easter-theme .project,
    body.sgx-easter-theme .empty,
    body.sgx-easter-theme .modal,
    body.sgx-easter-theme .manageProject,
    body.sgx-easter-theme .managePanel {
      background:linear-gradient(145deg,var(--sgx-panel-2),var(--sgx-panel))!important;
      color:var(--sgx-text)!important;
      border-color:var(--sgx-border)!important;
    }

    body.sgx-easter-theme button,
    body.sgx-easter-theme select,
    body.sgx-easter-theme input,
    body.sgx-easter-theme textarea,
    body.sgx-easter-theme a {
      border-color:var(--sgx-border)!important;
    }

    body.sgx-easter-theme button,
    body.sgx-easter-theme select,
    body.sgx-easter-theme input,
    body.sgx-easter-theme textarea {
      background:var(--sgx-panel-2)!important;
      color:var(--sgx-text)!important;
    }

    body.sgx-easter-theme button:hover,
    body.sgx-easter-theme button:focus-visible,
    body.sgx-easter-theme select:focus-visible,
    body.sgx-easter-theme .primary,
    body.sgx-easter-theme .active,
    body.sgx-easter-theme .studioTab.active,
    body.sgx-easter-theme .treeitem.active {
      background:var(--sgx-red)!important;
      color:#fff!important;
      border-color:var(--sgx-red-2)!important;
    }

    body.sgx-easter-theme a,
    body.sgx-easter-theme .accent,
    body.sgx-easter-theme .extension-name,
    body.sgx-easter-theme .logo,
    body.sgx-easter-theme .brand span {
      color:var(--sgx-red-2)!important;
    }

    body.sgx-easter-theme h1,
    body.sgx-easter-theme h2,
    body.sgx-easter-theme h3,
    body.sgx-easter-theme h4,
    body.sgx-easter-theme h5,
    body.sgx-easter-theme h6,
    body.sgx-easter-theme strong,
    body.sgx-easter-theme b {
      color:var(--sgx-text);
    }

    body.sgx-easter-theme p,
    body.sgx-easter-theme small,
    body.sgx-easter-theme .muted,
    body.sgx-easter-theme .hint,
    body.sgx-easter-theme .status {
      color:var(--sgx-muted)!important;
    }

    body.sgx-easter-theme .block {
      background:#24181b!important;
      border-color:#613238!important;
    }
    body.sgx-easter-theme .block.if { background:#32181d!important; }
    body.sgx-easter-theme .block.loop { background:#241d20!important; }

    body.sgx-easter-theme #editor,
    body.sgx-easter-theme .codeShell textarea {
      background:#110f11!important;
      color:#f7eef0!important;
    }

    body.sgx-easter-theme #gutter {
      background:#110f11!important;
      color:#735f64!important;
    }

    body.sgx-easter-theme .brand span,
    body.sgx-easter-theme h1 {
      background:linear-gradient(90deg,#ef3b45,#ff7b82)!important;
      -webkit-background-clip:text!important;
      background-clip:text!important;
      color:transparent!important;
    }

    body.sgx-easter-theme .hero-stars,
    body.sgx-easter-theme .sgx-easter-decoration {
      color:var(--sgx-red-2)!important;
    }

    body.sgx-easter-theme .glow,
    body.sgx-easter-theme .glow.cyan,
    body.sgx-easter-theme .glow.purple {
      background:var(--sgx-red)!important;
      box-shadow:0 0 80px var(--sgx-red), 0 0 140px var(--sgx-red-2)!important;
      filter:none!important;
    }

    body.sgx-easter-theme img {
      filter:none;
    }
    html.sgx-rain-theme, body.sgx-rain-theme { --rain-bg:#071018; --rain-panel:#0d1821; --rain-panel-2:#12212c; --rain-border:#263d4b; --rain-text:#e5f2f8; --rain-muted:#91a9b7; --rain-accent:#67c7e8; background:linear-gradient(180deg,#071018,#0a141c 45%,#050b10)!important; color:var(--rain-text)!important; }
    body.sgx-rain-theme { position:relative; min-height:100vh; }
    body.sgx-rain-theme > :not(.sgx-rain-layer) { position:relative; z-index:1; }
    body.sgx-rain-theme header,body.sgx-rain-theme nav,body.sgx-rain-theme aside,body.sgx-rain-theme main,body.sgx-rain-theme section,body.sgx-rain-theme article,body.sgx-rain-theme footer,body.sgx-rain-theme .panel,body.sgx-rain-theme .window,body.sgx-rain-theme .card,body.sgx-rain-theme dialog { border-color:var(--rain-border)!important; }
    body.sgx-rain-theme header,body.sgx-rain-theme nav,body.sgx-rain-theme aside,body.sgx-rain-theme .panel,body.sgx-rain-theme .window,body.sgx-rain-theme dialog { background:rgba(10,20,28,.9)!important; color:var(--rain-text)!important; }
    body.sgx-rain-theme .card,body.sgx-rain-theme .project,body.sgx-rain-theme .modal,body.sgx-rain-theme .manageProject,body.sgx-rain-theme .managePanel { background:linear-gradient(145deg,var(--rain-panel-2),var(--rain-panel))!important; color:var(--rain-text)!important; }
    body.sgx-rain-theme button,body.sgx-rain-theme input,body.sgx-rain-theme textarea,body.sgx-rain-theme select { background:var(--rain-panel-2)!important; color:var(--rain-text)!important; border-color:var(--rain-border)!important; }
    body.sgx-rain-theme button:hover,body.sgx-rain-theme .primary,body.sgx-rain-theme .active { background:var(--rain-accent)!important; color:#031018!important; border-color:#9be3f8!important; }
    body.sgx-rain-theme a,body.sgx-rain-theme .accent,body.sgx-rain-theme .extension-name { color:#7dd8f2!important; }
    body.sgx-rain-theme p,body.sgx-rain-theme small,body.sgx-rain-theme .muted,body.sgx-rain-theme .hint,body.sgx-rain-theme .status { color:var(--rain-muted)!important; }
    body.sgx-rain-theme .glow,body.sgx-rain-theme .glow.cyan,body.sgx-rain-theme .glow.purple { background:#39758c!important; box-shadow:0 0 100px #39758c,0 0 180px #1d4558!important; filter:blur(70px)!important; opacity:.16!important; }
    .sgx-rain-layer { position:fixed; inset:0; z-index:2147483000; pointer-events:none; overflow:hidden; }
    .sgx-rain-drop { position:absolute; top:-15vh; width:1px; height:7vh; background:linear-gradient(transparent,rgba(150,220,245,.72)); transform:rotate(10deg); animation:sgxRainFall linear infinite; }
    .sgx-rain-clouds { position:absolute; inset:0; background:radial-gradient(ellipse at 20% 0%,rgba(70,91,105,.22),transparent 34%),radial-gradient(ellipse at 70% 8%,rgba(48,66,78,.28),transparent 38%); }
    .sgx-lightning { position:absolute; inset:0; opacity:0; background:rgba(210,240,255,.8); mix-blend-mode:screen; }
    .sgx-lightning.flash { animation:sgxLightning .32s ease-out; }
    @keyframes sgxRainFall { to { transform:translate3d(7vw,120vh,0) rotate(10deg); } }
    @keyframes sgxLightning { 0%{opacity:0} 10%{opacity:.48} 18%{opacity:.05} 32%{opacity:.72} 48%{opacity:.08} 100%{opacity:0} }
  `;

  const style = document.createElement("style");
  style.id = "sgx-easter-theme-style";
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  function replaceBranding(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      if (!node.nodeValue) continue;
      const parent = node.parentElement;
      if (parent && ["SCRIPT","STYLE","TEXTAREA","INPUT"].includes(parent.tagName)) continue;
      node.nodeValue = node.nodeValue
        .replaceAll("SingulaX", "Caitlyn")
        .replaceAll("Singulax", "Caitlyn")
        .replaceAll("singulax", "caitlyn")
        .replaceAll("✦", "♥")
        .replaceAll("⚛️", "❤️‍🔥");
    }

    document.title = document.title
      .replaceAll("SingulaX", "Caitlyn")
      .replaceAll("Singulax", "Caitlyn");

    document.querySelectorAll("[alt],[aria-label],[title],[placeholder]").forEach(el => {
      for (const attr of ["alt","aria-label","title","placeholder"]) {
        if (el.hasAttribute(attr)) {
          el.setAttribute(attr, el.getAttribute(attr)
            .replaceAll("SingulaX", "Caitlyn")
            .replaceAll("Singulax", "Caitlyn")
            .replaceAll("singulax", "caitlyn")
            .replaceAll("✦", "♥"));
        }
      }
    });
  }


  function swapThemeIcons(active) {
    document.querySelectorAll('img, link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(el => {
      const attr = el.tagName === "IMG" ? "src" : "href";
      const value = el.getAttribute(attr);
      if (!value) return;

      if (active) {
        const url = new URL(value, location.href);
        const isDefaultLogo = /(?:^|\/)icons\/logo\.png(?:[?#].*)?$/.test(url.pathname);
        if (!el.dataset.sgxOriginalLogo && isDefaultLogo) {
          el.dataset.sgxOriginalLogo = value;
          el.setAttribute(attr, CAITLYN_LOGO);
        }
      } else if (el.dataset.sgxOriginalLogo) {
        el.setAttribute(attr, el.dataset.sgxOriginalLogo);
        delete el.dataset.sgxOriginalLogo;
      }
    });

    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      if (!manifestLink.dataset.sgxOriginalManifest) {
        manifestLink.dataset.sgxOriginalManifest = manifestLink.getAttribute("href") || DEFAULT_MANIFEST;
      }
      manifestLink.setAttribute("href", active ? CAITLYN_MANIFEST : manifestLink.dataset.sgxOriginalManifest);
    }

    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      document.head.appendChild(themeColor);
    }
    themeColor.dataset.sgxOriginalThemeColor ||= themeColor.getAttribute("content") || "#080a12";
    themeColor.setAttribute("content", active ? "#ef3b45" : themeColor.dataset.sgxOriginalThemeColor);

    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement("meta");
      appleTitle.name = "apple-mobile-web-app-title";
      document.head.appendChild(appleTitle);
    }
    appleTitle.dataset.sgxOriginalTitle ||= appleTitle.getAttribute("content") || "SingulaX";
    appleTitle.setAttribute("content", active ? "Caitlyn" : appleTitle.dataset.sgxOriginalTitle);
  }

  let rainTimer = null;
  function stopRainEffects() { if (rainTimer) { clearInterval(rainTimer); rainTimer = null; } document.querySelector(".sgx-rain-layer")?.remove(); }
  function startRainEffects() {
    if (!document.body) return;
    stopRainEffects();
    const layer=document.createElement("div"); layer.className="sgx-rain-layer";
    const clouds=document.createElement("div"); clouds.className="sgx-rain-clouds";
    const lightning=document.createElement("div"); lightning.className="sgx-lightning"; layer.append(clouds,lightning);
    const count=Math.min(180,Math.max(90,Math.floor(innerWidth/7)));
    for(let i=0;i<count;i++){ const drop=document.createElement("span"); drop.className="sgx-rain-drop"; drop.style.left=Math.random()*105+"vw"; drop.style.animationDuration=(.45+Math.random()*.65)+"s"; drop.style.animationDelay=(-Math.random()*1.2)+"s"; drop.style.opacity=(.25+Math.random()*.55).toFixed(2); layer.appendChild(drop); }
    document.documentElement.appendChild(layer);
    rainTimer=setInterval(()=>{ lightning.classList.remove("flash"); void lightning.offsetWidth; lightning.classList.add("flash"); },5500+Math.random()*5500);
  }
  function apply() {
    if (!document.body) return;

    const savedTheme = localStorage.getItem(STORAGE_KEY);
    const caitlynActive = savedTheme === THEME;
    const rainActive = savedTheme === RAIN_THEME;

    document.documentElement.classList.toggle("sgx-easter-theme", caitlynActive);
    document.body.classList.toggle("sgx-easter-theme", caitlynActive);
    document.documentElement.classList.toggle("sgx-rain-theme", rainActive);
    document.body.classList.toggle("sgx-rain-theme", rainActive);

    if (caitlynActive) {
      document.documentElement.setAttribute("data-easter-theme", THEME);
      document.body.setAttribute("data-easter-theme", THEME);
      replaceBranding();
      swapThemeIcons(true);
      stopRainEffects();
      return;
    }

    if (rainActive) {
      document.body.setAttribute("data-easter-theme", RAIN_THEME);
      document.documentElement.setAttribute("data-easter-theme", RAIN_THEME);
      swapThemeIcons(false);
      if (!document.querySelector(".sgx-rain-layer")) startRainEffects();
      return;
    }

    document.body.removeAttribute("data-easter-theme");
    document.documentElement.removeAttribute("data-easter-theme");
    swapThemeIcons(false);
    stopRainEffects();
  }

  window.SingulaXEasterTheme = {
    key: STORAGE_KEY,
    apply,
    set(theme) {
      if (theme) localStorage.setItem(STORAGE_KEY, theme);
      else localStorage.removeItem(STORAGE_KEY);
      apply();
    },
    clear() {
      localStorage.removeItem(STORAGE_KEY);
      apply();
    }
  };

  function applyWhenReady() {
    if (document.body) apply();
    else document.addEventListener("DOMContentLoaded", apply, {once:true});
  }

  applyWhenReady();
  window.addEventListener("pageshow", apply);
  window.addEventListener("load", apply);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") apply();
  });

  let queued = false;
  new MutationObserver((mutations) => {
    const onlyRainChanges = mutations.every(m => {
      const targetIsRain = m.target?.closest?.(".sgx-rain-layer");
      const nodesAreRain = [...m.addedNodes, ...m.removedNodes].every(n =>
        n.nodeType !== Node.ELEMENT_NODE || n.matches?.(".sgx-rain-layer") || n.closest?.(".sgx-rain-layer")
      );
      return targetIsRain || nodesAreRain;
    });
    if (onlyRainChanges) return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if ((saved !== THEME && saved !== RAIN_THEME) || queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }).observe(document.documentElement, {subtree:true, childList:true});
})();