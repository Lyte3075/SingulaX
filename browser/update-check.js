(() => {
  const API_URL = "https://api.github.com/repos/Lyte3075/SingulaX/commits/main";
  const STORAGE_KEY = "singulax-known-version";
  const CHECK_INTERVAL = 5 * 60 * 1000;
  let latestSha = null;
  let checking = false;

  function makeNotice() {
    if (document.getElementById("sgx-update-notice")) return document.getElementById("sgx-update-notice");
    const style = document.createElement("style");
    style.textContent = `
      #sgx-update-notice{position:fixed;right:18px;bottom:18px;z-index:99999;width:min(390px,calc(100vw - 36px));padding:16px;border:1px solid rgba(75,224,227,.25);border-radius:16px;background:rgba(13,17,29,.97);color:#f5f7ff;box-shadow:0 20px 60px rgba(0,0,0,.45),0 0 35px rgba(75,224,227,.08);font:14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;backdrop-filter:blur(18px)}
      #sgx-update-notice strong{display:block;font-size:15px;margin-bottom:5px}
      #sgx-update-notice p{margin:0;color:#9ba5b9;line-height:1.45}
    `;
    document.head.appendChild(style);

    const notice = document.createElement("div");
    notice.id = "sgx-update-notice";
    notice.hidden = true;
    notice.innerHTML = `
      <strong>✨ SingulaX is out of date</strong>
      <p>A newer version is available. This page will refresh automatically in a few seconds.</p>
      <div id="sgx-update-countdown" style="margin-top:10px;color:#4be0e3;font-weight:750">Refreshing in 5 seconds…</div>
    `;
    document.body.appendChild(notice);

    // The update is automatic. No action buttons are needed.
    return notice;
  }

  function showUpdate() {
    if (!document.body) return;
    const notice = makeNotice();
    notice.hidden = false;

    // Prevent the refreshed page from detecting the same commit again.
    if (latestSha) localStorage.setItem(STORAGE_KEY, latestSha);

    let seconds = 5;
    const countdown = notice.querySelector("#sgx-update-countdown");
    const timer = setInterval(() => {
      seconds -= 1;
      if (countdown) countdown.textContent = `Refreshing in ${seconds} second${seconds === 1 ? "" : "s"}…`;
      if (seconds <= 0) {
        clearInterval(timer);
        updateNow();
      }
    }, 1000);
  }

  async function updateNow() {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.update().catch(() => {})));
        await Promise.all(registrations.map(reg => reg.unregister().catch(() => {})));
      }
    } finally {
      const url = new URL(location.href);
      url.searchParams.set("sgx-update", Date.now().toString());
      location.replace(url.href);
    }
  }

  async function checkForUpdate() {
    if (checking || document.hidden) return;
    checking = true;
    try {
      const response = await fetch(API_URL + "?t=" + Date.now(), {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.sha) return;

      latestSha = data.sha;
      const known = localStorage.getItem(STORAGE_KEY);

      if (!known) {
        localStorage.setItem(STORAGE_KEY, latestSha);
      } else if (known !== latestSha) {
        showUpdate();
      }
    } catch (_) {
      // Updating is optional. Keep the app working when GitHub is unavailable.
    } finally {
      checking = false;
    }
  }

  window.SingulaXUpdate = {
    check: checkForUpdate,
    update: updateNow
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkForUpdate, { once: true });
  } else {
    checkForUpdate();
  }

  setInterval(checkForUpdate, CHECK_INTERVAL);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkForUpdate();
  });
})();