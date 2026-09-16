# SingulaX repeat logic

## Counted repeat
```sglx
repeat(10)
  say("Hello World")
end
```

`repeat(10)` runs the body 10 times.

## Task/state repeat
```sglx
repeat.until(ui(), done)
  say("running ui")
end
```

The first argument is evaluated as a task/function/value and the second is the target state. The body runs between checks until the state matches.

## Statement/state repeat
```sglx
repeat.until.statement(player.health <= 50, true)
  say("checking player health")
end
```

The first argument is a SingulaX statement/expression and the second is the target state.

## Comments
SingulaX supports paired comments:
```sglx
// This entire section is ignored by the runtime //
```
They may span multiple lines. Standard `#` and `--` full-line comments remain supported.
