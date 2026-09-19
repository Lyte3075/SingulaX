SINGULAX BUILT-IN 3D ENGINE
============================

This build adds an offline 3D engine directly to the SingulaX browser IDE.

There are NO runtime CDN imports and NO internet dependency for the 3D renderer.
The browser host uses a bundled WebGL renderer and the SingulaX runtime exposes a
small, simple 3D API.

FILES
-----
app.js       Browser IDE with the built-in WebGL 3D canvas bridge.
runtime.js   SingulaX runtime with the built-in 3D scene system.
3d-demo.sglx Example 3D game/program.

SIMPLE API
----------
scene3d(name)
scene3d_background(color)
scene3d_ambient(value)
scene3d_fog(enabled, density, color)

camera3d(name)
camera3d_position(name, x, y, z)
camera3d_rotation(name, x, y, z)
camera3d_fov(name, degrees)

object3d(name, type)
position3d(name, x, y, z)
rotation3d(name, x, y, z)
scale3d(name, x, y, z)
move3d(name, x, y, z)
rotate3d(name, x, y, z)
material3d_set(name, color)
collider3d(name, type, size)

Supported built-in primitive types:
cube
plane
sphere
cylinder

LIGHTS
------
light3d(name)
light3d_position(name, x, y, z)
light3d_rotation(name, x, y, z)
light3d_intensity(name, value)
light3d_color(name, color)

CUSTOM MESHES
-------------
mesh3d(name)
mesh3d_vertex(name, x, y, z)
mesh3d_face(name, a, b, c, ...)
mesh3d_use(objectName, meshName)

RENDER LOOP
-----------
update3d(dt)
render3d()

The engine is game-agnostic. The old FPS maze system is not required by this
3D engine and does not become the default.
