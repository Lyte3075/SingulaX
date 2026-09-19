# SingulaX Mobile Controls Update

This update fixes the mobile controls so they only appear while the **Preview** panel is active on small screens.

Default mobile controls:
- Left joystick
- A
- B

Optional controls can be enabled by SingulaX code:

```sglx
controls.show("dpad")
controls.show("x", "y")
controls.show("right_joystick")
controls.show("lb", "rb")
controls.show("lt", "rt")
```

Or choose an exact layout:

```sglx
controls.only(
  "left_joystick",
  "right_joystick",
  "a",
  "b",
  "x",
  "y"
)
```

Reset to the mobile defaults:

```sglx
controls.reset()
```

Show everything:

```sglx
controls.all()
```

Input functions:

```sglx
joystick_x()
joystick_y()
joystick2_x()
joystick2_y()
button_down("a")
button_down("b")
button_down("x")
button_down("y")
button_down("lb")
button_down("rb")
button_down("lt")
button_down("rt")
trigger_value("lt")
trigger_value("rt")
```

The controls are generated dynamically by `app.js`, so `full-ide.html` and `style.css` do not need separate control markup for this version.
