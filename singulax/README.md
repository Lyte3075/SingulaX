# Singulax

Singulax is an English-friendly programming language using `.sglx` files. This release keeps the original lightweight interpreter and adds a practical Studio web IDE, live keyboard/mouse input, simple canvas drawing, Lua/Luau-inspired declarations and loops, and project import/export.

## Run code

```bash
python3 sglx.py examples/01_basics.sglx
python3 sglx.py
```

## Open Singulax Studio

```bash
python3 sglx.py studio
```

Then open `http://127.0.0.1:8765/` in a browser. Studio is built with HTML/CSS/JavaScript and the server uses only Python's standard library.

## New control flow

```sglx
local score = 42

if score >= 90 then
  say("A")
elseif score >= 80 then
  say("B")
else
  say("C or below")
end

while score < 50 do
  score += 1
end

for i = 1, 10 do
  say(i)
end

for i = 10, 1, -1 do
  say(i)
end

forever do
  if key_down("Escape") then
    break
  end
end
```

`let`, `local`, and `var` declare variables. `local` creates a binding in the current Singulax environment, while `var` is accepted as a beginner-friendly declaration alias. Existing `otherwise if` and `otherwise` syntax remains supported alongside `elseif` and `else`.

## Live input and simple game drawing

When running inside Studio, Singulax programs can poll browser input:

```sglx
forever do
  clear_screen()

  if key_down("ArrowLeft") then
    say("left")
  end

  draw_rect(100, 100, 80, 80, "dodgerblue")
  draw_circle(mouse_x(), mouse_y(), 12, "white")
  draw_text("Click the canvas or press keys!", 20, 30, 22, "white")
end
```

Available browser bridge functions include `key_down(key)`, `mouse_x()`, `mouse_y()`, `mouse_down(button)`, `mouse_clicked(button)`, `clear_screen()`, `draw_rect(...)`, `draw_circle(...)`, and `draw_text(...)`. The regular `ask()` / `input()` functions continue to work for terminal input.

## Projects

Studio stores projects under `projects/`. A project can contain multiple `.sglx` files and folders. The IDE provides Save, Run, Stop, Import, and Export. Export creates a `.sglxproj.zip` archive that can be imported again.

## Blocks

Studio has a visual block mode for beginner-friendly construction of common statements. Blocks generate real Singulax source, so the result can be switched back to Code mode and edited normally.

## Portability

The language runtime remains dependency-free Python, so the interpreter works anywhere Python 3 works. The Studio UI is browser-based and can run on desktop and mobile browsers when its local/server environment is available. A future native/WASM runtime would be the next step for fully standalone browser and mobile execution without Python.

## Architecture

- `sglx.py`: lexer, parser, AST, runtime, standard library
- `ide/`: HTML/CSS/JS Studio frontend and local HTTP API server
- `projects/`: Studio project workspace
- `examples/`: language examples
- `sglx` / `sglx.bat`: command-line wrappers

This is still a tree-walking interpreter rather than a JIT/native compiler. The architecture is intentionally kept clean so a bytecode VM, optimizer, package manager, and native/WASM targets can be added later without changing the `.sglx` surface language.

## Browser-only Singulax Studio

`ide/index.html` is now a standalone browser IDE/runtime. It can open directly in Safari on iPhone and other modern browsers without Python or a local server. It includes code mode, blocks mode, live keyboard/touch/pointer input, a canvas game preview, local saving, and `.sglxproj.zip` import/export.
