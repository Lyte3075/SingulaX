SingulaX Built-in 3D + NEON RIFT

This build adds simple mouse-look input to the built-in, dependency-free WebGL 3D renderer.

Controls in NEON RIFT:
- WASD: move relative to camera direction
- Mouse: look around
- Space: pulse attack
- Esc: release the mouse cursor
- Click the 3D preview to capture the mouse

New SingulaX input builtins:
- mouse_dx()
- mouse_dy()

mouse_dx() and mouse_dy() return mouse movement since the previous read, so they are useful for camera look controls.

The renderer and runtime are self-contained. No CDN, downloads, or internet connection are required at runtime.
