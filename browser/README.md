# SingulaX Studio

Open `index.html`. This browser edition loads the SingulaX runtime as a classic JavaScript file (`runtime.js`) rather than an ES module, so it can work when opened locally from Files/Safari where module imports are blocked.

For PWA/offline service-worker features, serve this folder from HTTPS/localhost. The IDE itself does not require Python.


## App/tab icon
The Studio uses `singulax-icon.png` for the browser tab/favicon and iOS Home Screen icon. The manifest starts the installed app in `full-ide.html`.
