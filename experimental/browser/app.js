// SingulaX browser runtime is loaded before this file.

const $ = id => document.getElementById(id);
const editor = $('editor');
const consoleEl = $('console');
const canvas = $('game');

let project = {
  name: 'MyProject',
  files: {
    'main.sglx': 'say("Welcome to SingulaX!")\n'
  },
  assets: {},
  folders: [],
  settings: {
    theme: 'midnight',
    fontSize: 15,
    autosave: true
  }
};

let current = 'main.sglx';
let mode = 'code';
let runtime = null;
let blocks = [];

const keys = new Set();
const buttons = new Set();

let mouse = {
  x: 0,
  y: 0
};

let touch = {
  x: 0,
  y: 0,
  active: false
};

const keywords = [
  'if',
  'then',
  'elseif',
  'else',
  'end',
  'while',
  'do',
  'forever',
  'for',
  'each',
  'in',
  'repeat',
  'times',
  'repeat.until',
  'repeat.until.statement',
  'wait',
  'wait.until',
  'ask',
  'answer',
  'result',
  'get',
  'find',
  'list',
  'push',
  'pop',
  'data',
  'data.store',
  'data.find',
  'function',
  'local',
  'var',
  'let',
  'return',
  'break',
  'continue'
];

const builtins = [
  'say',
  'print',
  'input',
  'random',
  'random_int',
  'random_choice',
  'abs',
  'floor',
  'ceil',
  'round',
  'sqrt',
  'pow',
  'sin',
  'cos',
  'tan',
  'min',
  'max',
  'clamp',
  'lerp',
  'length',
  'to_json',
  'from_json',
  'draw_rect',
  'draw_circle',
  'draw_line',
  'draw_text',
  'draw_image',
  'draw_cube',
  'clear_screen',
  'key_down',
  'key_pressed',
  'mouse_down',
  'mouse_clicked',
  'mouse_x',
  'mouse_y',
  'touching',
  'touch_x',
  'touch_y',
  'gamepad_connected',
  'gamepad_button',
  'gamepad_axis',
  'asset',
  'asset_url',
  'play_audio',
  'stop_audio',
  'ask',
  'answer',
  'result',
  'get',
  'find',
  'list',
  'push',
  'pop'
];

function log(s) {
  consoleEl.textContent +=
    (consoleEl.textContent ? '\n' : '') + s;

  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function esc(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function save() {
  project.files[current] = editor.value;

  project.name =
    $('projectName').value || 'MyProject';

  project.settings = {
    theme:
      $('theme')?.value ||
      project.settings.theme,

    fontSize:
      +(
        $('fontSize')?.value ||
        project.settings.fontSize
      ),

    autosave:
      $('autosave')?.checked ??
      project.settings.autosave
  };

  project.folders ??= {};
  project.assets ??= {};
  project.files ??= {};

  localStorage.setItem(
    'singulax-project',
    JSON.stringify(project)
  );

  if (project.settings.autosave) {
    log('Saved locally.');
  }
}

function renderTree() {
  const paths = Object.keys(project.files).sort();

  const folders = new Set();

  for (const f of paths) {
    const parts = f.split('/');

    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join('/'));
    }
  }

  for (const f of project.folders || []) {
    folders.add(f);
  }

  const folderHTML = f => `
    <div
      class="folder"
      style="padding-left:${8 + f.split('/').length * 12}px"
    >
      <span>📁 ${esc(f.split('/').at(-1))}</span>

      <button
        class="mini"
        data-new-in-folder="${encodeURIComponent(f)}"
      >＋</button>

      <button
        class="mini"
        data-rename-folder="${encodeURIComponent(f)}"
      >✎</button>

      <button
        class="mini"
        data-delete-folder="${encodeURIComponent(f)}"
      >×</button>
    </div>
  `;

  const fileHTML = f => {
    const depth = f.split('/').length - 1;
    const name = f.split('/').at(-1);

    return `
      <div
        class="treeitem ${f === current ? 'active' : ''}"
        style="padding-left:${8 + depth * 18}px"
      >
        <button
          class="name"
          data-file="${encodeURIComponent(f)}"
        >
          📄 ${esc(name)}
        </button>

        <button
          class="mini"
          data-move="${encodeURIComponent(f)}"
        >↗</button>

        <button
          class="mini"
          data-rename="${encodeURIComponent(f)}"
        >✎</button>

        <button
          class="mini"
          data-delete="${encodeURIComponent(f)}"
        >×</button>
      </div>
    `;
  };

  const assetHTML = Object.keys(project.assets)
    .sort()
    .map(a => `
      <div class="treeitem">
        <button
          class="name"
          data-asset="${encodeURIComponent(a)}"
        >
          🧩 ${esc(a)}
        </button>

        <button
          class="mini"
          data-rename-asset="${encodeURIComponent(a)}"
        >✎</button>

        <button
          class="mini"
          data-delete-asset="${encodeURIComponent(a)}"
        >×</button>
      </div>
    `)
    .join('');

  $('tree').innerHTML =
    '<b>Scripts</b>' +
    [...folders].sort().map(folderHTML).join('') +
    paths.map(fileHTML).join('') +
    '<hr>' +
    '<b>Assets</b>' +
    assetHTML +
    '<hr>' +
    '<b>Folders</b>' +
    ([...folders].sort().length
      ? ''
      : '<div class="tree-empty">No folders yet</div>');
}

function render() {
  renderTree();

  $('projectName').value = project.name;

  editor.value =
    project.files[current] ?? '';

  $('fileTitle').textContent = current;

  applySettings();

  diagnose();
}

function openFile(f) {
  project.files[current] = editor.value;

  current = f;

  render();
}

$('tree').onclick = e => {
  const d = e.target.dataset;

  if (d.file) {
    openFile(decodeURIComponent(d.file));
    return;
  }

  if (d.rename) {
    const old =
      decodeURIComponent(d.rename);

    const base =
      old.split('/').at(-1);

    const n =
      prompt('Rename script', base);

    if (n && n !== base) {
      const to =
        old.includes('/')
          ? old.slice(0, old.lastIndexOf('/') + 1) + n
          : n;

      project.files[to] =
        project.files[old];

      delete project.files[old];

      if (current === old) {
        current = to;
      }

      render();
      save();
    }

    return;
  }

  if (d.delete) {
    const f =
      decodeURIComponent(d.delete);

    if (Object.keys(project.files).length === 1) {
      alert('Keep at least one script.');
      return;
    }

    if (confirm('Delete ' + f + '?')) {
      delete project.files[f];

      if (current === f) {
        current =
          Object.keys(project.files)[0];
      }

      render();
      save();
    }

    return;
  }

  if (d.move) {
    const f =
      decodeURIComponent(d.move);

    const folder =
      prompt(
        'Move script into folder. Leave blank for root.',
        ''
      );

    if (folder !== null) {
      const clean =
        folder
          .trim()
          .replace(/^\/+|\/+$/g, '');

      const name =
        f.split('/').at(-1);

      const to =
        clean
          ? clean + '/' + name
          : name;

      if (to !== f) {
        project.files[to] =
          project.files[f];

        delete project.files[f];

        if (current === f) {
          current = to;
        }

        render();
        save();
      }
    }

    return;
  }

  if (d.newInFolder) {
    const folder =
      decodeURIComponent(d.newInFolder);

    let n =
      prompt(
        'New script name',
        'script.sglx'
      );

    if (n) {
      if (!n.endsWith('.sglx')) {
        n += '.sglx';
      }

      const to =
        folder + '/' + n;

      project.files[to] = '';

      openFile(to);

      save();
    }

    return;
  }

  if (d.renameFolder) {
    const old =
      decodeURIComponent(
        d.renameFolder
      );

    const base =
      old.split('/').at(-1);

    const n =
      prompt('Rename folder', base);

    if (n && n !== base) {
      const parent =
        old.includes('/')
          ? old.slice(
              0,
              old.lastIndexOf('/') + 1
            )
          : '';

      const to = parent + n;

      for (const k of Object.keys(project.files)) {
        if (
          k === old ||
          k.startsWith(old + '/')
        ) {
          project.files[
            to + k.slice(old.length)
          ] = project.files[k];

          delete project.files[k];
        }
      }

      project.folders =
        (project.folders || []).map(f =>
          f === old ||
          f.startsWith(old + '/')
            ? to + f.slice(old.length)
            : f
        );

      if (
        current === old ||
        current.startsWith(old + '/')
      ) {
        current =
          to + current.slice(old.length);
      }

      render();
      save();
    }

    return;
  }

  if (d.deleteFolder) {
    const f =
      decodeURIComponent(
        d.deleteFolder
      );

    if (
      confirm(
        'Delete folder and its scripts: ' +
        f +
        '?'
      )
    ) {
      for (const k of Object.keys(project.files)) {
        if (
          k === f ||
          k.startsWith(f + '/')
        ) {
          delete project.files[k];
        }
      }

      project.folders =
        (project.folders || []).filter(
          x =>
            x !== f &&
            !x.startsWith(f + '/')
        );

      current =
        Object.keys(project.files)[0] ||
        'main.sglx';

      render();
      save();
    }

    return;
  }

  if (d.asset) {
    previewAsset(
      decodeURIComponent(d.asset)
    );

    return;
  }

  if (d.renameAsset) {
    const old =
      decodeURIComponent(
        d.renameAsset
      );

    const n =
      prompt('Rename asset', old);

    if (n && n !== old) {
      project.assets[n] =
        project.assets[old];

      delete project.assets[old];

      render();
      save();
    }

    return;
  }

  if (d.deleteAsset) {
    const a =
      decodeURIComponent(
        d.deleteAsset
      );

    if (
      confirm('Delete ' + a + '?')
    ) {
      delete project.assets[a];

      render();
      save();
    }
  }
};

$('saveBtn').onclick = save;

$('clearConsole').onclick = () => {
  consoleEl.textContent = '';
};

$('newFileBtn').onclick = () => {
  let n =
    prompt(
      'File name',
      'script.sglx'
    );

  if (!n) return;

  if (!/\.[\w-]+$/.test(n)) {
    n += '.sglx';
  }

  if (!n.endsWith('.sglx')) {
    alert(
      'Scripts should use the .sglx extension.'
    );

    return;
  }

  project.files[n] = '';

  openFile(n);

  save();
};

$('newFolderBtn').onclick = () => {
  const n =
    prompt(
      'Folder name',
      'scripts'
    );

  if (!n) return;

  const f =
    n
      .trim()
      .replace(/^\/+|\/+$/g, '');

  if (!f) return;

  project.folders ??= [];

  if (!project.folders.includes(f)) {
    project.folders.push(f);
  }

  const path =
    f + '/main.sglx';

  project.files[path] ??= '';

  current = path;

  render();

  save();
};

$('newBtn').onclick = () => {
  if (
    confirm(
      'Create a new project?'
    )
  ) {
    project = {
      name: 'MyProject',
      files: {
        'main.sglx':
          'say("Welcome to SingulaX!")\n'
      },
      assets: {},
      folders: [],
      settings: {
        ...project.settings
      }
    };

    current = 'main.sglx';

    render();

    save();
  }
};

let latestFrame = [];
let paintHandle = 0;

function draw(frame = []) {
  latestFrame =
    frame.slice();
}

function paintFrame() {
  if (paintHandle) {
    cancelAnimationFrame(
      paintHandle
    );
  }

  const tick = () => {
    if (!runtime) {
      paintHandle = 0;
      return;
    }

    paintCanvas(latestFrame);

    paintHandle =
      requestAnimationFrame(tick);
  };

  paintHandle =
    requestAnimationFrame(tick);
}

function paintCanvas(frame = []) {
  const c = canvas;
  const ctx = c.getContext('2d');

  ctx.clearRect(
    0,
    0,
    c.width,
    c.height
  );

  ctx.fillStyle = '#05060a';

  ctx.fillRect(
    0,
    0,
    c.width,
    c.height
  );

  for (const x of frame) {
    ctx.fillStyle =
      x.fill || 'white';

    ctx.strokeStyle =
      x.fill || 'white';

    if (x.type === 'rect') {
      ctx.fillRect(
        x.x,
        x.y,
        x.w,
        x.h
      );
    }

    if (x.type === 'circle') {
      ctx.beginPath();

      ctx.arc(
        x.x,
        x.y,
        x.r,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    if (x.type === 'line') {
      ctx.lineWidth =
        x.width || 2;

      ctx.beginPath();

      ctx.moveTo(
        x.x1,
        x.y1
      );

      ctx.lineTo(
        x.x2,
        x.y2
      );

      ctx.stroke();
    }

    if (x.type === 'text') {
      ctx.font =
        (x.size || 20) +
        'px sans-serif';

      ctx.fillText(
        x.text,
        x.x,
        x.y
      );
    }

    if (x.type === 'cube') {
      drawCube(ctx, x);
    }

    if (x.type === 'image') {
      const url =
        project.assets[x.asset];

      if (url) {
        paintCanvas.images ??=
          new Map();

        let im =
          paintCanvas.images.get(
            url
          );

        if (!im) {
          im = new Image();

          im.src = url;

          paintCanvas.images.set(
            url,
            im
          );
        }

        if (im.complete) {
          ctx.drawImage(
            im,
            x.x,
            x.y,
            x.w || im.width,
            x.h || im.height
          );
        }
      }
    }
  }
}

function drawCube(ctx, x) {
  const s =
    70 * (x.size || 1);

  const cx =
    400 + x.x * 60;

  const cy =
    240 -
    x.z * 40 -
    x.y * 60;

  ctx.beginPath();

  ctx.moveTo(
    cx - s,
    cy - s
  );

  ctx.lineTo(
    cx,
    cy - s * 0.55
  );

  ctx.lineTo(
    cx + s,
    cy - s
  );

  ctx.lineTo(
    cx + s,
    cy
  );

  ctx.lineTo(
    cx,
    cy + s * 0.45
  );

  ctx.lineTo(
    cx - s,
    cy
  );

  ctx.closePath();

  ctx.strokeStyle =
    x.fill || '#7cf';

  ctx.stroke();

  ctx.beginPath();

  ctx.moveTo(
    cx - s,
    cy
  );

  ctx.lineTo(
    cx,
    cy + s * 0.45
  );

  ctx.lineTo(
    cx + s,
    cy
  );

  ctx.stroke();
}

async function run() {
  save();

  stop();

  consoleEl.textContent = '';

  $('diagnostics').textContent = '';

  latestFrame = [];

  runtime =
    new SingulaxRuntime({
      output: log,

      frame: draw,

      input: async p => {
        log(p);

        return await new Promise(
          resolve => {
            window._inputResolve =
              resolve;

            $('stdin').focus();
          }
        );
      },

      fileRead: async p =>
        project.files[p] ??
        project.assets[p] ??
        '',

      fileWrite: async (p, c) => {
        project.files[p] =
          String(c);

        renderTree();

        save();

        return true;
      },

      playAudio: p =>
        playAudio(p),

      mode3d: v => {
        $('previewMode').value =
          v ? '3d' : '2d';
      }
    });

  runtime.setInput({
    keys: [...keys],
    buttons: [...buttons],
    mouse,
    touch,
    gamepads: readGamepads()
  });

  paintFrame();

  try {
    await runtime.runProject(
      project
    );

    paintCanvas(
      latestFrame
    );

    log('[finished]');

    if (paintHandle) {
      cancelAnimationFrame(
        paintHandle
      );
    }

    paintHandle = 0;

    runtime = null;
  } catch (e) {
    showError(e);

    if (paintHandle) {
      cancelAnimationFrame(
        paintHandle
      );
    }

    paintHandle = 0;

    runtime = null;
  }
}

function stop() {
  if (runtime) {
    runtime.running = false;

    runtime = null;

    if (paintHandle) {
      cancelAnimationFrame(
        paintHandle
      );
    }

    paintHandle = 0;

    paintCanvas(
      latestFrame
    );

    log('[stopped]');
  }
}

// Run and Stop buttons.
$('runBtn').addEventListener(
  'click',
  run
);

$('stopBtn').addEventListener(
  'click',
  stop
);

// Live input.
$('stdin').addEventListener(
  'keydown',
  e => {
    if (
      e.key === 'Enter' &&
      window._inputResolve
    ) {
      const value =
        e.target.value;

      e.target.value = '';

      const resolve =
        window._inputResolve;

      window._inputResolve = null;

      resolve(value);
    }
  }
);

window.addEventListener(
  'keydown',
  e => {
    keys.add(e.key);

    runtime?.setInput({
      keys: [e.key],
      pressed: [e.key]
    });
  }
);

window.addEventListener(
  'keyup',
  e => {
    keys.delete(e.key);

    runtime?.setInput({
      up: [e.key]
    });
  }
);

function pointerPos(e) {
  const r =
    canvas.getBoundingClientRect();

  return {
    x:
      (e.clientX - r.left) *
      canvas.width /
      r.width,

    y:
      (e.clientY - r.top) *
      canvas.height /
      r.height
  };
}

canvas.addEventListener(
  'pointermove',
  e => {
    mouse =
      pointerPos(e);

    runtime?.setInput({
      mouse
    });
  }
);

canvas.addEventListener(
  'pointerdown',
  e => {
    mouse =
      pointerPos(e);

    buttons.add('left');

    runtime?.setInput({
      buttons: ['left'],
      clicked: ['left'],
      mouse
    });

    canvas.setPointerCapture?.(
      e.pointerId
    );
  }
);

canvas.addEventListener(
  'pointerup',
  e => {
    buttons.delete('left');

    runtime?.setInput({
      buttonup: ['left']
    });
  }
);

canvas.addEventListener(
  'touchstart',
  e => {
    const t =
      e.touches[0];

    if (!t) return;

    touch = {
      ...pointerPos(t),
      active: true
    };

    runtime?.setInput({
      touch,
      touchStart: true
    });
  },
  {
    passive: true
  }
);

canvas.addEventListener(
  'touchmove',
  e => {
    const t =
      e.touches[0];

    if (t) {
      touch = {
        ...pointerPos(t),
        active: true
      };

      runtime?.setInput({
        touch
      });
    }
  },
  {
    passive: true
  }
);

canvas.addEventListener(
  'touchend',
  () => {
    touch.active = false;

    runtime?.setInput({
      touch,
      touchEnd: true
    });
  },
  {
    passive: true
  }
);

function readGamepads() {
  const out = {};

  for (
    const g of navigator.getGamepads?.() || []
  ) {
    if (g) {
      out[g.index] = {
        buttons:
          g.buttons.map(
            b => b.pressed
          ),
        axes: g.axes
      };
    }
  }

  return out;
}

window.addEventListener(
  'gamepadconnected',
  () => {
    runtime?.setInput({
      gamepads:
        readGamepads()
    });
  }
);

window.addEventListener(
  'gamepaddisconnected',
  () => {
    runtime?.setInput({
      gamepads:
        readGamepads()
    });
  }
);

$('touchPad').onclick = e => {
  const dir =
    e.target.dataset.touch;

  if (!dir) return;

  const map = {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight'
  };

  const key =
    map[dir];

  runtime?.setInput({
    keys: [key],
    pressed: [key]
  });

  setTimeout(
    () => {
      runtime?.setInput({
        up: [key]
      });
    },
    80
  );
};

// Blocks.

function parseBlocks() {
  blocks = [];

  for (
    const line of editor.value.split(/\r?\n/)
  ) {
    const s =
      line.trim();

    if (
      !s ||
      s.startsWith('#') ||
      s.startsWith('--') ||
      s.startsWith('//')
    ) {
      continue;
    }

    let m;

    if (/^say\(/i.test(s)) {
      blocks.push({
        type: 'say',
        value:
          s.replace(
            /^say\((.*)\)$/i,
            '$1'
          )
      });
    } else if (
      m =
        /^(?:local|var|let)\s+(\w+)\s*=\s*(.*)$/
          .exec(s)
    ) {
      blocks.push({
        type: 'var',
        name: m[1],
        value: m[2]
      });
    } else if (
      m =
        /^if\s+(.+?)\s+then$/i.exec(s)
    ) {
      blocks.push({
        type: 'if',
        cond: m[1],
        depth: 0
      });
    } else if (
      m =
        /^elseif\s+(.+?)\s+then$/i.exec(s)
    ) {
      blocks.push({
        type: 'elseif',
        cond: m[1]
      });
    } else if (
      /^else$/i.test(s)
    ) {
      blocks.push({
        type: 'else'
      });
    } else if (
      m =
        /^while\s+(.+?)\s+do$/i.exec(s)
    ) {
      blocks.push({
        type: 'while',
        cond: m[1]
      });
    } else if (
      /^forever/i.test(s)
    ) {
      blocks.push({
        type: 'forever'
      });
    } else if (
      m =
        /^repeat\.until\s*\((.*)\)$/i.exec(s)
    ) {
      const a =
        splitArgs(m[1]);

      blocks.push({
        type: 'repeatUntil',
        task: a[0] || 'task',
        state: a[1] || 'done'
      });
    } else if (
      m =
        /^repeat\.until\.statement\s*\((.*)\)$/i.exec(s)
    ) {
      const a =
        splitArgs(m[1]);

      blocks.push({
        type:
          'repeatUntilStatement',

        statement:
          a[0] || 'condition',

        state:
          a[1] || 'true'
      });
    } else if (
      m =
        /^repeat\s+(.+?)\s+times$/i.exec(s)
    ) {
      blocks.push({
        type: 'repeat',
        count: m[1]
      });
    } else if (
      /^wait\(/i.test(s)
    ) {
      blocks.push({
        type: 'wait',
        value:
          s.replace(
            /^wait\((.*)\)$/i,
            '$1'
          )
      });
    } else if (
      /^random\(/i.test(s)
    ) {
      blocks.push({
        type: 'random',
        value:
          s.replace(
            /^random\((.*)\)$/i,
            '$1'
          )
      });
    } else {
      blocks.push({
        type: 'code',
        line: s
      });
    }
  }
}

function splitArgs(s) {
  const result = [];

  let current = '';
  let depth = 0;
  let quote = null;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (
      quote
    ) {
      current += c;

      if (
        c === quote &&
        s[i - 1] !== '\\'
      ) {
        quote = null;
      }

      continue;
    }

    if (
      c === '"' ||
      c === "'"
    ) {
      quote = c;
      current += c;
      continue;
    }

    if (
      c === '('
    ) {
      depth++;
      current += c;
      continue;
    }

    if (
      c === ')'
    ) {
      depth--;
      current += c;
      continue;
    }

    if (
      c === ',' &&
      depth === 0
    ) {
      result.push(
        current.trim()
      );

      current = '';

      continue;
    }

    current += c;
  }

  if (current.trim()) {
    result.push(
      current.trim()
    );
  }

  return result;
}

function renderBlocks() {
  const box =
    $('blocks');

  box.innerHTML = '';

  blocks.forEach(
    (b, i) => {
      const d =
        document.createElement(
          'div'
        );

      d.className =
        'block ' +
        (
          [
            'if',
            'while',
            'forever',
            'repeat',
            'repeatUntil',
            'repeatUntilStatement'
          ].includes(b.type)
            ? 'loop'
            : ''
        );

      let body = '';

      if (
        b.type === 'say'
      ) {
        body = `
          <div class="row">
            <b>say</b>
            <input value="${esc(b.value)}">
          </div>
        `;
      } else if (
        b.type === 'var'
      ) {
        body = `
          <div class="row">
            <b>set local</b>
            <input value="${esc(b.name)}">
            <b>to</b>
            <input value="${esc(b.value)}">
          </div>
        `;
      } else if (
        [
          'if',
          'elseif',
          'while'
        ].includes(b.type)
      ) {
        body = `
          <div class="row">
            <b>${b.type}</b>
            <input value="${esc(
              b.cond || 'true'
            )}">
            ${
              b.type !== 'elseif'
                ? '<b>then</b>'
                : ''
            }
          </div>
        `;
      } else if (
        b.type ===
        'repeatUntilStatement'
      ) {
        body = `
          <div class="row">
            <b>
              repeat.until.statement
            </b>

            <input value="${esc(
              b.statement || 'true'
            )}">

            <b>,</b>

            <input value="${esc(
              b.state || 'true'
            )}">
          </div>
        `;
      } else if (
        b.type === 'repeatUntil'
      ) {
        body = `
          <div class="row">
            <b>repeat.until</b>

            <input value="${esc(
              b.task || 'task'
            )}">

            <b>,</b>

            <input value="${esc(
              b.state || 'done'
            )}">
          </div>
        `;
      } else if (
        b.type === 'repeat'
      ) {
        body = `
          <div class="row">
            <b>repeat</b>
            <input value="${esc(
              b.count || 5
            )}">
            <b>times</b>
          </div>
        `;
      } else if (
        b.type === 'wait'
      ) {
        body = `
          <div class="row">
            <b>wait</b>
            <input value="${esc(
              b.value || 1
            )}">
            <b>seconds</b>
          </div>
        `;
      } else if (
        b.type === 'random'
      ) {
        body = `
          <div class="row">
            <b>random</b>
            <input value="${esc(
              b.value || '0, 10'
            )}">
          </div>
        `;
      } else {
        body = `
          <div class="row">
            <b>${b.type}</b>
            <input value="${esc(
              b.line || ''
            )}">
          </div>
        `;
      }

      d.innerHTML =
        body +
        `
          <button
            class="del"
            data-del="${i}"
          >×</button>
        `;

      d.querySelectorAll(
        'input'
      ).forEach(
        (x, j) => {
          x.oninput = () => {
            if (
              b.type === 'say'
            ) {
              b.value = x.value;
            } else if (
              b.type === 'var'
            ) {
              if (j === 0) {
                b.name =
                  x.value;
              } else {
                b.value =
                  x.value;
              }
            } else if (
              b.type ===
              'repeatUntil'
            ) {
              if (j === 0) {
                b.task =
                  x.value;
              } else {
                b.state =
                  x.value;
              }
            } else if (
              b.type ===
              'repeatUntilStatement'
            ) {
              if (j === 0) {
                b.statement =
                  x.value;
              } else {
                b.state =
                  x.value;
              }
            } else if (
              b.cond !== undefined
            ) {
              b.cond =
                x.value;
            } else if (
              b.value !== undefined
            ) {
              b.value =
                x.value;
            } else {
              b.line =
                x.value;
            }
          };
        }
      );

      box.appendChild(d);
    }
  );

  box.onclick = e => {
    if (
      e.target.dataset.del
    ) {
      blocks.splice(
        +e.target.dataset.del,
        1
      );

      renderBlocks();
    }
  };
}

function blocksToCode() {
  return (
    blocks
      .map(b => {
        if (
          b.type === 'say'
        ) {
          return `say(${
            b.value || '"Hello!"'
          })`;
        }

        if (
          b.type === 'var'
        ) {
          return `local ${
            b.name || 'x'
          } = ${
            b.value || '0'
          }`;
        }

        if (
          b.type === 'repeatUntil'
        ) {
          return `repeat.until(${
            b.task || 'task'
          }, ${
            b.state || 'done'
          })`;
        }

        if (
          b.type ===
          'repeatUntilStatement'
        ) {
          return `repeat.until.statement(${
            b.statement || 'condition'
          }, ${
            b.state || 'true'
          })`;
        }

        if (
          b.type === 'if'
        ) {
          return `if ${
            b.cond || 'true'
          } then`;
        }

        if (
          b.type === 'elseif'
        ) {
          return `elseif ${
            b.cond || 'true'
          } then`;
        }

        if (
          b.type === 'else'
        ) {
          return 'else';
        }

        if (
          b.type === 'while'
        ) {
          return `while ${
            b.cond || 'true'
          } do`;
        }

        if (
          b.type === 'forever'
        ) {
          return 'forever do';
        }

        if (
          b.type === 'repeat'
        ) {
          return `repeat ${
            b.count || 5
          } times`;
        }

        if (
          b.type === 'wait'
        ) {
          return `wait(${
            b.value || 1
          })`;
        }

        if (
          b.type === 'random'
        ) {
          return `say(random(${
            b.value || '0, 10'
          }))`;
        }

        return b.line || '';
      })
      .join('\n') +
    '\n' +
    (
      blocks.some(
        b =>
          [
            'if',
            'while',
            'forever',
            'repeat',
            'repeatUntil',
            'repeatUntilStatement'
          ].includes(b.type)
      )
        ? 'end\n'
        : ''
    )
  );
}

$('modeBtn').onclick = () => {
  if (mode === 'code') {
    project.files[current] =
      editor.value;

    parseBlocks();

    renderBlocks();

    mode = 'blocks';

    editor.parentElement.parentElement.hidden =
      true;

    $('blocksPane').hidden =
      false;

    $('modeBtn').textContent =
      '⌨ Code';
  } else {
    editor.value =
      blocksToCode();

    project.files[current] =
      editor.value;

    mode = 'code';

    editor.parentElement.parentElement.hidden =
      false;

    $('blocksPane').hidden =
      true;

    $('modeBtn').textContent =
      '🧩 Blocks';

    diagnose();
  }
};

document
  .querySelectorAll('[data-block]')
  .forEach(
    b => {
      b.onclick = () => {
        blocks.push({
          type:
            b.dataset.block
        });

        renderBlocks();
      };
    }
  );

// IMPORT / EXPORT

async function importFiles(files) {
  for (const f of files) {
    if (
      /\.zip$/i.test(f.name)
    ) {
      await importZipFile(f);
      continue;
    }

    const isAsset =
      !f.name.endsWith('.sglx') &&
      !f.name.endsWith('.sglxproj');

    if (isAsset) {
      project.assets[f.name] =
        await readData(f);
    } else if (
      f.name.endsWith('.sglxproj')
    ) {
      try {
        const imported =
          JSON.parse(
            await f.text()
          );

        project =
          imported.project ||
          imported;

        project.files ??= {};
        project.assets ??= {};
        project.folders ??= [];
        project.settings ??=
          {
            theme: 'midnight',
            fontSize: 15,
            autosave: true
          };
      } catch (e) {
        alert(
          'Invalid .sglxproj file: ' +
          e.message
        );
      }
    } else {
      project.files[f.name] =
        await f.text();
    }
  }

  current =
    Object.keys(project.files)[0] ||
    'main.sglx';

  render();

  save();

  log(
    'Imported ' +
    files.length +
    ' file(s).'
  );
}

function readData(f) {
  return new Promise(
    (resolve, reject) => {
      const r =
        new FileReader();

      r.onload = () =>
        resolve(
          String(r.result)
        );

      r.onerror = reject;

      r.readAsDataURL(f);
    }
  );
}

// Import button.
$('importBtn').onclick = () => {
  $('importFile').value = '';
  $('importFile').click();
};

$('importFile').onchange = e => {
  importFiles(
    [...e.target.files]
  );
};

// Add asset button.
$('addAssetBtn').onclick = () => {
  $('assetFile').value = '';
  $('assetFile').click();
};

$('assetFile').onchange = e => {
  importFiles(
    [...e.target.files]
  );
};

// Extract ZIP into project.
async function importZipFile(file) {
  try {
    const entries =
      await readZip(
        await file.arrayBuffer()
      );

    let imported = 0;

    for (const entry of entries) {
      const path =
        entry.name
          .replace(/^\.\//, '')
          .replace(/\\/g, '/');

      if (
        !path ||
        path.endsWith('/')
      ) {
        continue;
      }

      const bytes =
        entry.data;

      if (
        path ===
          'project.sglxproj' ||
        path ===
          'project.json'
      ) {
        try {
          const text =
            new TextDecoder().decode(
              bytes
            );

          const obj =
            JSON.parse(text);

          if (obj.project) {
            project =
              obj.project;

            project.files ??= {};
            project.assets ??= {};
            project.folders ??= [];

            imported++;

            continue;
          }

          if (obj.files) {
            project = {
              ...project,
              ...obj
            };

            project.files ??= {};
            project.assets ??= {};
            project.folders ??= [];

            imported++;

            continue;
          }
        } catch {
        }
      }

      if (
        path.startsWith(
          'scripts/'
        ) &&
        path
          .toLowerCase()
          .endsWith('.sglx')
      ) {
        project.files[
          path.slice(8)
        ] =
          new TextDecoder().decode(
            bytes
          );

        imported++;

        continue;
      }

      if (
        path
          .toLowerCase()
          .endsWith('.sglx')
      ) {
        project.files[path] =
          new TextDecoder().decode(
            bytes
          );

        imported++;

        continue;
      }

      if (
        path.startsWith(
          'assets/'
        )
      ) {
        project.assets[
          path.slice(7)
        ] =
          bytesToDataUrl(
            bytes,
            guessMime(path)
          );

        imported++;

        continue;
      }

      project.assets[path] =
        bytesToDataUrl(
          bytes,
          guessMime(path)
        );

      imported++;
    }

    current =
      Object.keys(project.files)[0] ||
      'main.sglx';

    render();

    save();

    log(
      'Extracted ' +
      imported +
      ' file(s) from ' +
      file.name +
      '.'
    );
  } catch (e) {
    alert(
      'Could not extract ZIP: ' +
      e.message
    );

    log(
      'ZIP error: ' +
      e.message
    );
  }
}

function bytesToDataUrl(
  bytes,
  mime = 'application/octet-stream'
) {
  let s = '';

  const chunk = 0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunk
  ) {
    s += String.fromCharCode(
      ...bytes.subarray(
        i,
        i + chunk
      )
    );
  }

  return (
    'data:' +
    mime +
    ';base64,' +
    btoa(s)
  );
}

function guessMime(name) {
  const ext =
    name
      .toLowerCase()
      .split('.')
      .pop();

  return (
    {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      mp4: 'video/mp4',
      webm: 'video/webm',
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
      html: 'text/html',
      css: 'text/css',
      js: 'text/javascript'
    }[ext] ||
    'application/octet-stream'
  );
}

// ZIP creation.

function crc32(bytes) {
  let table =
    crc32.table;

  if (!table) {
    table =
      crc32.table = [];

    for (
      let n = 0;
      n < 256;
      n++
    ) {
      let c = n;

      for (
        let k = 0;
        k < 8;
        k++
      ) {
        c =
          c & 1
            ? 0xedb88320 ^
              (c >>> 1)
            : c >>> 1;
      }

      table[n] =
        c >>> 0;
    }
  }

  let c =
    0xffffffff;

  for (
    const b of bytes
  ) {
    c =
      table[
        (c ^ b) & 255
      ] ^
      (c >>> 8);
  }

  return (
    c ^
    0xffffffff
  ) >>> 0;
}

function u16(v) {
  const a =
    new Uint8Array(2);

  new DataView(
    a.buffer
  ).setUint16(
    0,
    v,
    true
  );

  return a;
}

function u32(v) {
  const a =
    new Uint8Array(4);

  new DataView(
    a.buffer
  ).setUint32(
    0,
    v >>> 0,
    true
  );

  return a;
}

function concatBytes(parts) {
  const n =
    parts.reduce(
      (a, b) =>
        a + b.length,
      0
    );

  const out =
    new Uint8Array(n);

  let p = 0;

  for (const b of parts) {
    out.set(
      b,
      p
    );

    p +=
      b.length;
  }

  return out;
}

function zipStore(entries) {
  const enc =
    new TextEncoder();

  const local = [];
  const central = [];

  let offset = 0;

  for (
    const e of entries
  ) {
    const name =
      enc.encode(
        e.name
      );

    const data =
      e.data;

    const crc =
      crc32(data);

    const head =
      concatBytes([
        u32(0x04034b50),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        name,
        data
      ]);

    local.push(head);

    central.push({
      name,
      crc,
      size: data.length,
      offset
    });

    offset +=
      head.length;
  }

  const cd = [];

  let cdSize = 0;

  for (
    const e of central
  ) {
    const h =
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(e.crc),
        u32(e.size),
        u32(e.size),
        u16(e.name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(e.offset),
        e.name
      ]);

    cd.push(h);

    cdSize +=
      h.length;
  }

  const end =
    concatBytes([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(central.length),
      u16(central.length),
      u32(cdSize),
      u32(offset),
      u16(0)
    ]);

  return concatBytes([
    ...local,
    ...cd,
    end
  ]);
}

async function dataUrlBytes(url) {
  const b64 =
    url.split(',')[1] ||
    '';

  const bin =
    atob(b64);

  const out =
    new Uint8Array(
      bin.length
    );

  for (
    let i = 0;
    i < bin.length;
    i++
  ) {
    out[i] =
      bin.charCodeAt(i);
  }

  return out;
}

async function exportProject() {
  const choice =
    prompt(
      'Export format:\n' +
      '1 = SingulaX project (.sglxproj)\n' +
      '2 = Single script (.sglx)\n' +
      '3 = Standalone HTML game\n' +
      '4 = Project JSON backup\n' +
      '5 = Full project ZIP',
      '5'
    );

  if (choice === '1') {
    save();

    download(
      JSON.stringify(
        project,
        null,
        2
      ),
      project.name +
        '.sglxproj',
      'application/json'
    );
  } else if (
    choice === '2'
  ) {
    save();

    download(
      project.files[current] ||
        '',
      current,
      'text/plain'
    );
  } else if (
    choice === '3'
  ) {
    save();

    const code =
      project.files[current] ||
      '';

    const html =
      '<!doctype html>' +
      '<meta charset="utf-8">' +
      '<title>' +
      esc(project.name) +
      '</title>' +
      '<style>' +
      'body{margin:0;background:#000}' +
      'canvas{width:100vw;height:100vh}' +
      '</style>' +
      '<canvas id="c" width="800" height="450"></canvas>' +
      '<script>' +
      standaloneRuntime() +
      '<\\/script>';

    download(
      html,
      project.name +
        '.html',
      'text/html'
    );
  } else if (
    choice === '4'
  ) {
    save();

    download(
      JSON.stringify(
        {
          format:
            'singulax-project',
          version: 2,
          project
        },
        null,
        2
      ),
      project.name +
        '.json',
      'application/json'
    );
  } else if (
    choice === '5'
  ) {
    await exportZip();
  }
}

async function exportZip() {
  save();

  const entries = [];

  const enc =
    new TextEncoder();

  const meta = {
    format:
      'singulax-project',
    version: 2,
    project: {
      name:
        project.name,
      settings:
        project.settings,
      folders:
        project.folders || []
    }
  };

  entries.push({
    name:
      'project.sglxproj',

    data:
      enc.encode(
        JSON.stringify(
          meta
        )
      )
  });

  for (
    const [
      name,
      code
    ] of Object.entries(
      project.files
    )
  ) {
    entries.push({
      name:
        'scripts/' +
        name,

      data:
        enc.encode(
          String(code)
        )
    });
  }

  for (
    const [
      name,
      url
    ] of Object.entries(
      project.assets
    )
  ) {
    let data;

    try {
      data =
        await dataUrlBytes(
          url
        );
    } catch {
      data =
        enc.encode(
          String(url)
        );
    }

    entries.push({
      name:
        'assets/' +
        name,

      data
    });
  }

  const bytes =
    zipStore(
      entries
    );

  download(
    bytes,
    project.name +
      '.zip',
    'application/zip'
  );
}

// ZIP extraction.
async function readZip(buffer) {
  const bytes =
    new Uint8Array(
      buffer
    );

  const view =
    new DataView(
      buffer
    );

  const out = [];

  let p = 0;

  while (
    p + 4 <=
    bytes.length
  ) {
    const sig =
      view.getUint32(
        p,
        true
      );

    if (
      sig ===
      0x04034b50
    ) {
      const method =
        view.getUint16(
          p + 8,
          true
        );

      const compSize =
        view.getUint32(
          p + 18,
          true
        );

      const nameLen =
        view.getUint16(
          p + 26,
          true
        );

      const extraLen =
        view.getUint16(
          p + 28,
          true
        );

      const name =
        new TextDecoder().decode(
          bytes.subarray(
            p + 30,
            p +
              30 +
              nameLen
          )
        );

      const start =
        p +
        30 +
        nameLen +
        extraLen;

      const comp =
        bytes.subarray(
          start,
          start +
            compSize
        );

      let data;

      if (
        method === 0
      ) {
        data =
          comp.slice();
      } else if (
        method === 8
      ) {
        if (
          typeof DecompressionStream !==
          'function'
        ) {
          throw new Error(
            'This browser does not support deflated ZIP extraction.'
          );
        }

        const ds =
          new DecompressionStream(
            'deflate-raw'
          );

        data =
          new Uint8Array(
            await new Response(
              new Blob([
                comp
              ])
                .stream()
                .pipeThrough(
                  ds
                )
            ).arrayBuffer()
          );
      } else {
        throw new Error(
          'Unsupported ZIP compression method: ' +
          method
        );
      }

      out.push({
        name,
        data
      });

      p =
        start +
        compSize;

      continue;
    }

    if (
      sig ===
        0x02014b50 ||
      sig ===
        0x06054b50
    ) {
      break;
    }

    throw new Error(
      'Invalid ZIP file'
    );
  }

  return out;
}

function download(
  data,
  name,
  type
) {
  const a =
    document.createElement(
      'a'
    );

  a.href =
    URL.createObjectURL(
      new Blob(
        [data],
        { type }
      )
    );

  a.download =
    name;

  document.body.appendChild(
    a
  );

  a.click();

  a.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        a.href
      ),
    1000
  );
}

function standaloneRuntime() {
  return `
    console.log(
      ${JSON.stringify(
        project.name
      )}
    );
  `;
}

$('exportBtn').onclick =
  exportProject;

// Diagnostics.

function diagnose() {
  const src =
    editor.value;

  const ds = [];

  const clean =
    src.replace(
      /\/\/[\s\S]*?\/\//g,
      m =>
        m
          .split('\n')
          .map(() => '')
          .join('\n')
    );

  const lines =
    clean.split(/\r?\n/);

  let depth = 0;

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const s =
      lines[i].trim();

    if (
      !s ||
      s.startsWith('#') ||
      s.startsWith('--')
    ) {
      continue;
    }

    if (
      /^(if|while|forever|repeat\s*(?:\(|.+\s+times)|for\s+.+\s+do|function\s+)/i.test(
        s
      )
    ) {
      depth++;
    }

    if (
      /^end\b/i.test(s)
    ) {
      depth--;

      if (depth < 0) {
        ds.push({
          line:
            i + 1,
          msg:
            'Unexpected end'
        });

        depth = 0;
      }
    }

    if (
      /^(elseif|else)\b/i.test(
        s
      ) &&
      depth === 0
    ) {
      ds.push({
        line:
          i + 1,
        msg:
          'Unexpected else/elseif'
      });
    }

    if (
      /^(if|elseif)\b/i.test(
        s
      ) &&
      !/then$/i.test(s)
    ) {
      ds.push({
        line:
          i + 1,
        msg:
          'Conditional needs then'
      });
    }

    if (
      /^while\b/i.test(s) &&
      !/do$/i.test(s)
    ) {
      ds.push({
        line:
          i + 1,
        msg:
          'while needs do'
      });
    }

    if (
      /^repeat\s*\(/i.test(s) &&
      !/\)$/i.test(s)
    ) {
      ds.push({
        line:
          i + 1,
        msg:
          'repeat needs closing )'
      });
    }

    if (
      /^repeat\.until(?:\.statement)?\s*\(/i.test(
        s
      ) &&
      !/\)$/i.test(s)
    ) {
      ds.push({
        line:
          i + 1,
        msg:
          'repeat.until needs closing )'
      });
    }

    if (
      /^repeat\s+.+$/i.test(s) &&
      !/^repeat\.until/i.test(s) &&
      !/times$/i.test(s) &&
      !/^repeat\s*\(/i.test(s)
    ) {
      ds.push({
        line:
          i + 1,
        msg:
          'repeat needs times or repeat(count)'
      });
    }

    if (
      /^(wait|random|random_int|draw_rect|draw_circle|draw_text)\b/i.test(
        s
      ) &&
      !s.includes('(')
    ) {
      ds.push({
        line:
          i + 1,
        msg:
          'Function call needs parentheses'
      });
    }
  }

  if (depth > 0) {
    ds.push({
      line:
        lines.length,
      msg:
        `Missing ${depth} end${
          depth > 1
            ? 's'
            : ''
        }`
    });
  }

  $('diagnostics').innerHTML =
    ds.length
      ? ds
          .map(
            d =>
              `<div>● Line ${d.line}: ${esc(
                d.msg
              )}</div>`
          )
          .join('')
      : '<span class="diagOk">✓ No basic syntax errors detected</span>';

  $('diagCount').textContent =
    ds.length
      ? `⚠ ${ds.length}`
      : '✓';

  $('gutter').innerHTML =
    lines
      .map(
        (_, i) =>
          `<div>${i + 1}</div>`
      )
      .join('');

  return ds;
}

function showError(e) {
  const m =
    String(
      e.message || e
    );

  const match =
    m.match(
      /line\s+(\d+)(?:,\s*column\s+(\d+))?/i
    );

  $('diagnostics').innerHTML =
    `<div>● ${esc(m)}</div>`;

  if (match) {
    const line =
      +match[1];

    const lines =
      editor.value.split(
        /\r?\n/
      );

    let pos = 0;

    for (
      let i = 0;
      i < line - 1;
      i++
    ) {
      pos +=
        lines[i].length +
        1;
    }

    editor.focus();

    editor.setSelectionRange(
      pos,
      pos +
        (
          lines[line - 1]
            ?.length || 0
        )
    );
  }
}

// Editor.

editor.addEventListener(
  'input',
  () => {
    if (
      project.settings.autosave
    ) {
      project.files[current] =
        editor.value;

      localStorage.setItem(
        'singulax-project',
        JSON.stringify(
          project
        )
      );
    }

    diagnose();

    showCompletions();
  }
);

editor.addEventListener(
  'scroll',
  () => {
    $('gutter').scrollTop =
      editor.scrollTop;
  }
);

editor.addEventListener(
  'keydown',
  e => {
    if (
      e.key === 'Tab'
    ) {
      if (
        !$('suggestions').hidden
      ) {
        acceptCompletion();

        e.preventDefault();

        return;
      }

      e.preventDefault();

      const a =
        editor.selectionStart;

      const b =
        editor.selectionEnd;

      editor.setRangeText(
        '  ',
        a,
        b,
        'end'
      );

      return;
    }

    if (
      e.key === 'Enter'
    ) {
      if (
        !$('suggestions').hidden
      ) {
        acceptCompletion();

        e.preventDefault();

        return;
      }

      setTimeout(
        diagnose,
        0
      );
    }

    if (
      e.key === 'ArrowDown' &&
      !$('suggestions').hidden
    ) {
      moveCompletion(1);

      e.preventDefault();
    }

    if (
      e.key === 'ArrowUp' &&
      !$('suggestions').hidden
    ) {
      moveCompletion(-1);

      e.preventDefault();
    }

    if (
      e.key === 'Escape'
    ) {
      hideCompletions();
    }

    if (
      (e.ctrlKey ||
        e.metaKey) &&
      e.code === 'Space'
    ) {
      e.preventDefault();

      showCompletions(true);
    }
  }
);

// Settings.

$('settingsBtn').onclick =
  () =>
    $('settings').showModal();

$('closeSettings').onclick =
  () => {
    $('settings').close();

    applySettings();

    save();
  };

$('theme').onchange =
  applySettings;

$('fontSize').oninput =
  applySettings;

$('autosave').onchange =
  save;

function applySettings() {
  const st =
    project.settings ||
    {};

  document.documentElement.style.setProperty(
    '--code-size',
    (st.fontSize || 15) +
      'px'
  );

  document.body.dataset.theme =
    $('theme')?.value ||
    st.theme ||
    'midnight';
}

// Autocomplete.

let completionItems = [];
let completionIndex = 0;

function completionContext() {
  const before =
    editor.value.slice(
      0,
      editor.selectionStart
    );

  const word =
    (
      before.match(
        /[A-Za-z_]\w*$/
      ) || ['']
    )[0];

  const member =
    before.match(
      /([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/
    );

  return {
    word,
    member
  };
}

function showCompletions(
  force = false
) {
  const {
    word,
    member
  } =
    completionContext();

  if (
    !force &&
    !word &&
    !member
  ) {
    hideCompletions();

    return;
  }

  const snippets = {
    if:
      'if condition then\n  \nend',

    elseif:
      'elseif condition then',

    while:
      'while condition do\n  \nend',

    forever:
      'forever do\n  \nend',

    for:
      'for i = 1, 10 do\n  \nend',

    function:
      'function name()\n  \nend',

    repeat:
      'repeat(10)\n  \nend',

    'repeat.until':
      'repeat.until(task(), done)\n  \nend',

    'repeat.until.statement':
      'repeat.until.statement(condition, true)\n  \nend',

    wait:
      'wait(1)',

    'wait.until':
      'wait.until(task, done)'
  };

  let pool = [];

  if (member) {
    const q =
      member[2].toLowerCase();

    pool = [
      'state',
      'value',
      'length',
      'x',
      'y',
      'z',
      'health',
      'position',
      'ready',
      'done',
      'starts',
      'during',
      'update',
      'destroy',
      'play',
      'stop'
    ].filter(
      x =>
        x.startsWith(q)
    );
  } else {
    const names =
      [
        ...new Set([
          ...keywords,
          ...builtins,
          ...Object.keys(
            project.files
          ).map(
            x =>
              x.replace(
                /\.sglx$/,
                ''
              )
          ),
          ...Object.keys(
            project.assets
          )
        ])
      ];

    pool =
      names.filter(
        x =>
          x
            .toLowerCase()
            .startsWith(
              word.toLowerCase()
            )
      );

    if (
      snippets[
        word.toLowerCase()
      ]
    ) {
      pool = [
        word.toLowerCase(),
        ...pool.filter(
          x =>
            x.toLowerCase() !==
            word.toLowerCase()
        )
      ];
    }
  }

  completionItems =
    pool.slice(
      0,
      12
    );

  completionIndex = 0;

  const box =
    $('suggestions');

  if (
    !completionItems.length
  ) {
    hideCompletions();

    return;
  }

  box.hidden = false;

  box.innerHTML =
    completionItems
      .map(
        (x, i) =>
          `<button class="completion ${
            i === 0
              ? 'selected'
              : ''
          }" data-sug-index="${i}"><b>${esc(
            x
          )}</b></button>`
      )
      .join('');

  box.onclick =
    e => {
      const b =
        e.target.closest(
          '[data-sug-index]'
        );

      if (!b) return;

      completionIndex =
        Number(
          b.dataset.sugIndex
        );

      acceptCompletion();
    };

  positionCompletions();
}

function positionCompletions() {
  const box =
    $('suggestions');

  box.style.left =
    '58px';

  box.style.top =
    '36px';
}

function acceptCompletion() {
  if (
    !completionItems.length
  ) {
    return;
  }

  const {
    word,
    member
  } =
    completionContext();

  const end =
    editor.selectionStart;

  const prefixLength =
    member
      ? member[2].length
      : word.length;

  const chosen =
    completionItems[
      completionIndex
    ];

  const snippets = {
    if:
      'if condition then\n  \nend',

    while:
      'while condition do\n  \nend',

    forever:
      'forever do\n  \nend',

    for:
      'for i = 1, 10 do\n  \nend',

    function:
      'function name()\n  \nend',

    repeat:
      'repeat(10)\n  \nend',

    'repeat.until':
      'repeat.until(task(), done)\n  \nend',

    'repeat.until.statement':
      'repeat.until.statement(condition, true)\n  \nend',

    wait:
      'wait(1)',

    'wait.until':
      'wait.until(task, done)'
  };

  editor.setRangeText(
    snippets[chosen] ||
      chosen,

    end -
      prefixLength,

    end,

    'end'
  );

  hideCompletions();

  editor.focus();

  diagnose();
}

function moveCompletion(delta) {
  if (
    !completionItems.length
  ) {
    return;
  }

  completionIndex =
    (
      completionIndex +
      delta +
      completionItems.length
    ) %
    completionItems.length;

  document
    .querySelectorAll(
      '.completion'
    )
    .forEach(
      (b, i) =>
        b.classList.toggle(
          'selected',
          i ===
            completionIndex
        )
    );
}

function hideCompletions() {
  $('suggestions').hidden =
    true;

  completionItems = [];
}

// Assets.

async function previewAsset(name) {
  const url =
    project.assets[name];

  if (
    url?.startsWith(
      'data:image/'
    )
  ) {
    const w =
      window.open();

    if (w) {
      w.document.write(
        `<img src="${url}" style="max-width:100%">`
      );
    }
  } else if (
    url?.startsWith(
      'data:audio/'
    )
  ) {
    const w =
      window.open();

    if (w) {
      w.document.write(
        `<audio controls autoplay src="${url}"></audio>`
      );
    }
  } else if (
    url?.startsWith(
      'data:video/'
    )
  ) {
    const w =
      window.open();

    if (w) {
      w.document.write(
        `<video controls autoplay style="max-width:100%" src="${url}"></video>`
      );
    }
  } else {
    alert(name);
  }
}

function playAudio(name) {
  const u =
    project.assets[name] ||
    name;

  if (u) {
    const a =
      new Audio(u);

    a.play().catch(
      () => {}
    );
  }
}

// Help and examples.

function ensureHelp() {
  if (!$('helpBtn')) {
    const b =
      document.createElement(
        'button'
      );

    b.id =
      'helpBtn';

    b.textContent =
      '? Help';

    b.title =
      'Open SingulaX examples';

    document
      .querySelector(
        'header'
      )
      ?.appendChild(b);

    b.onclick =
      openHelp;
  }

  if (!$('helpDialog')) {
    const d =
      document.createElement(
        'dialog'
      );

    d.id =
      'helpDialog';

    d.style.cssText =
      'width:min(900px,94vw);max-height:88vh;overflow:auto';

    d.innerHTML =
      '<h2>SingulaX Help & Examples</h2>' +
      '<p>These examples use actual SingulaX syntax supported by the current browser runtime. Comments use <code>// ... //</code>.</p>' +
      '<div id="exampleList">Loading examples...</div>' +
      '<button id="closeHelp">Close</button>';

    document.body.appendChild(d);

    $('closeHelp').onclick =
      () => d.close();
  }
}

async function openHelp() {
  ensureHelp();

  const box =
    $('exampleList');

  $('helpDialog').showModal();

  box.textContent =
    'Loading examples...';

  const names = [
    '01_basics.sglx',
    '02_functions.sglx',
    '03_blueprints.sglx',
    '04_error_handling.sglx',
    '05_modules.sglx',
    '06_todo_app.sglx',
    '07_advanced.sglx',
    '08_control_flow.sglx',
    '09_game_input.sglx',
    '10_singulax_showcase.sglx',
    '11_repeat_until.sglx',
    'geometry.sglx'
  ];

  box.innerHTML = '';

  for (
    const name of names
  ) {
    const section =
      document.createElement(
        'details'
      );

    const title =
      document.createElement(
        'summary'
      );

    title.textContent =
      name;

    const pre =
      document.createElement(
        'pre'
      );

    pre.style.cssText =
      'white-space:pre-wrap;background:#070910;padding:12px;border-radius:8px;overflow:auto';

    try {
      let text =
        await fetch(
          '../examples/' +
            encodeURIComponent(
              name
            )
        ).then(
          r => {
            if (!r.ok) {
              throw new Error(
                'HTTP ' +
                  r.status
              );
            }

            return r.text();
          }
        );

      text =
        cleanExampleComments(
          text
        );

      pre.textContent =
        text;
    } catch (e) {
      pre.textContent =
        'Could not load this example: ' +
        e.message;
    }

    section.append(
      title,
      pre
    );

    box.appendChild(
      section
    );
  }
}

function cleanExampleComments(text) {
  return String(text)
    .replace(
      /^\s*#\s?(.*)$/gm,
      '// $1 //'
    )
    .replace(
      /\s+#\s?(.*)$/gm,
      ' // $1 //'
    );
}

ensureHelp();

// Studio tabs.

const studioTabs = [
  'code',
  'console',
  'preview'
];

function setStudioTab(name) {
  studioTabs.forEach(
    n => {
      const el =
        $('window-' + n);

      if (el) {
        el.classList.toggle(
          'active-window',
          n === name
        );
      }

      const b =
        $('tab-' + n);

      if (b) {
        b.classList.toggle(
          'active',
          n === name
        );
      }
    }
  );

  document.body.dataset.focusPanel =
    name;
}

function initStudioTabs() {
  studioTabs.forEach(
    n =>
      $(
        'tab-' + n
      )?.addEventListener(
        'click',
        () =>
          setStudioTab(n)
      )
  );

  $('multitaskBtn')
    ?.addEventListener(
      'click',
      () =>
        document.body.classList.toggle(
          'multitask'
        )
    );

  $('resetLayoutBtn')
    ?.addEventListener(
      'click',
      () => {
        document.body.classList.remove(
          'multitask'
        );

        setStudioTab(
          'code'
        );
      }
    );

  setStudioTab('code');
}

initStudioTabs();

// Load saved project.

const old =
  localStorage.getItem(
    'singulax-project'
  );

if (old) {
  try {
    project =
      JSON.parse(old);

    project.files ??= {};

    project.assets ??= {};

    project.folders ??= [];

    project.settings ??= {
      theme: 'midnight',
      fontSize: 15,
      autosave: true
    };

    if (
      !Object.keys(
        project.files
      ).length
    ) {
      project.files[
        'main.sglx'
      ] =
        'say("Welcome to SingulaX!")\n';
    }

    current =
      Object.keys(
        project.files
      )[0] ||
      'main.sglx';
  } catch {
    project = {
      name: 'MyProject',
      files: {
        'main.sglx':
          'say("Welcome to SingulaX!")\n'
      },
      assets: {},
      folders: [],
      settings: {
        theme: 'midnight',
        fontSize: 15,
        autosave: true
      }
    };

    current =
      'main.sglx';
  }
}

$('theme').value =
  project.settings?.theme ||
  'midnight';

$('fontSize').value =
  project.settings?.fontSize ||
  15;

$('autosave').checked =
  project.settings?.autosave !==
  false;

render();

// Service worker.
if (
  'serviceWorker' in
  navigator
) {
  navigator.serviceWorker
    .register(
      'sw.js?v=8'
    )
    .catch(
      () => {}
    );
}
