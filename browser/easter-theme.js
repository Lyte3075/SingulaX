(() => {
  const STORAGE_KEY = "singulax-easter-theme";
  const THEME = "caitlyn";

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

    body.sgx-easter-theme img {
      filter:none;
    }
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
      node.nodeValue = node.nodeValue
        .replaceAll("SingulaX", "Caitlyn")
        .replaceAll("Singulax", "Caitlyn")
        .replaceAll("singulax", "caitlyn")
        .replaceAll("✦", "♥");
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

  function apply() {
    const active = localStorage.getItem(STORAGE_KEY) === THEME;
    document.documentElement.classList.toggle("sgx-easter-theme", active);
    document.body?.classList.toggle("sgx-easter-theme", active);

    if (active) {
      document.body?.setAttribute("data-easter-theme", THEME);
      replaceBranding();
    } else {
      document.body?.removeAttribute("data-easter-theme");
    }
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

  apply();

  new MutationObserver(() => {
    if (localStorage.getItem(STORAGE_KEY) === THEME) {
      document.documentElement.classList.add("sgx-easter-theme");
      document.body?.classList.add("sgx-easter-theme");
      replaceBranding();
    }
  }).observe(document.documentElement, {subtree:true, childList:true, attributes:true});
})();