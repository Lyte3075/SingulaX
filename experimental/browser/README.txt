SingulaX Built-in 3D Engine - Preview Fix

This build keeps the 3D WebGL canvas hidden/offscreen and copies its rendered image into SingulaX's existing preview canvas. This prevents the 3D renderer from creating a visible/popped-out preview frame.

Files:
- app.js
- runtime.js
- 3d-demo.sglx

No CDN or network dependency is used by the 3D renderer.
