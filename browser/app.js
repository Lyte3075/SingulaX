// SingulaX browser runtime is loaded by the HTML before this file.

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

function log(value) {
  if (!consoleEl) return;

  consoleEl.textContent +=
    (consoleEl.textContent ? '\n' : '') +
    String(value);

  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function save() {
  if (!editor) return;

  project.files[current] = editor.value;

  const projectName = $('projectName');

  if (projectName) {
    project.name = projectName.value || 'MyProject';
  }

  project.settings = {
    theme: $('theme')?.value || project.settings.theme || 'midnight',
    fontSize: +( $('fontSize')?.value || project.settings.fontSize || 15 ),
    autosave: $('autosave')?.checked ?? project.settings.autosave
  };

  localStorage.setItem(
    'singulax-project',
    JSON.stringify(project)
  );
}

function renderTree() {
  const tree = $('tree');

  if (!tree) return;

  const paths = Object.keys(project.files).sort();

  const folders = new Set();

  for (const file of paths) {
    const parts = file.split('/');

    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join('/'));
    }
  }

  const folderHTML = folder => {
    const depth = folder.split('/').length;

    return `
      <div class="folder"
           style="padding-left:${8 + depth * 12}px">

        <span>
          📁 ${esc(folder.split('/').at(-1))}
        </span>

        <button
          class="mini"
          data-new-in-folder="${encodeURIComponent(folder)}">
          ＋
        </button>

        <button
          class="mini"
          data-rename-folder="${encodeURIComponent(folder)}">
          ✎
        </button>

        <button
          class="mini"
          data-delete-folder="${encodeURIComponent(folder)}">
          ×
        </button>

      </div>
    `;
  };

  const fileHTML = file => {
    const depth = file.split('/').length - 1;
    const name = file.split('/').at(-1);

    return `
      <div
        class="treeitem ${file === current ? 'active' : ''}"
        style="padding-left:${8 + depth * 18}px">

        <button
          class="name"
          data-file="${encodeURIComponent(file)}">
          📄 ${esc(name)}
        </button>

        <button
          class="mini"
          title="Move"
          data-move="${encodeURIComponent(file)}">
          ↗
        </button>

        <button
          class="mini"
          title="Rename"
          data-rename="${encodeURIComponent(file)}">
          ✎
        </button>

        <button
          class="mini"
          title="Delete"
          data-delete="${encodeURIComponent(file)}">
          ×
        </button>

      </div>
    `;
  };

  const assetHTML = Object.keys(project.assets)
    .sort()
    .map(asset => `
      <div class="treeitem">

        <button
          class="name"
          data-asset="${encodeURIComponent(asset)}">
          🧩 ${esc(asset)}
        </button>

        <button
          class="mini"
          title="Rename"
          data-rename-asset="${encodeURIComponent(asset)}">
          ✎
        </button>

        <button
          class="mini"
          title="Delete"
          data-delete-asset="${encodeURIComponent(asset)}">
          ×
        </button>

      </div>
    `)
    .join('');

  tree.innerHTML = `
    <b>Scripts</b>

    ${[...folders]
      .sort()
      .map(folderHTML)
      .join('')}

    ${paths.map(fileHTML).join('')}

    <hr>

    <b>Assets</b>

    ${assetHTML}

    <hr>

    <b>Folders</b>

    <div class="treeitem">
      <button
        class="name"
        id="sidebarNewFolder">
        📁 New Folder
      </button>
    </div>
  `;

  $('sidebarNewFolder')?.addEventListener(
    'click',
    createFolder
  );
}

function render() {
  renderTree();

  if ($('projectName')) {
    $('projectName').value = project.name;
  }

  if (editor) {
    editor.value = project.files[current] ?? '';
  }

  if ($('fileTitle')) {
    $('fileTitle').textContent = current;
  }

  applySettings();
  diagnose();
}

function openFile(file) {
  if (!project.files[file]) {
    project.files[file] = '';
  }

  if (editor && current) {
    project.files[current] = editor.value;
  }

  current = file;

  render();
}

function createFolder() {
  const name = prompt(
    'Folder name',
    'scripts'
  );

  if (!name) return;

  const clean = name
    .trim()
    .replace(/^\/+|\/+$/g, '');

  if (!clean) return;

  const firstScript = clean + '/main.sglx';

  if (!project.files[firstScript]) {
    project.files[firstScript] = '';
  }

  current = firstScript;

  render();
  save();
}

if ($('tree')) {
  $('tree').addEventListener('click', event => {
    const target = event.target.closest('[data-file],[data-rename],[data-delete],[data-move],[data-new-in-folder],[data-rename-folder],[data-delete-folder],[data-asset],[data-rename-asset],[data-delete-asset]');

    if (!target) return;

    const data = target.dataset;

    if (data.file) {
      openFile(
        decodeURIComponent(data.file)
      );
      return;
    }

    if (data.rename) {
      const old = decodeURIComponent(data.rename);
      const base = old.split('/').at(-1);

      const name = prompt(
        'Rename script',
        base
      );

      if (!name || name === base) return;

      const folder = old.includes('/')
        ? old.slice(0, old.lastIndexOf('/') + 1)
        : '';

      const newPath = folder + name;

      project.files[newPath] =
        project.files[old];

      delete project.files[old];

      if (current === old) {
        current = newPath;
      }

      render();
      save();

      return;
    }

    if (data.delete) {
      const file = decodeURIComponent(data.delete);

      if (
        Object.keys(project.files).length <= 1
      ) {
        alert(
          'SingulaX projects must contain at least one script.'
        );
        return;
      }

      if (
        !confirm(
          'Delete ' + file + '?'
        )
      ) {
        return;
      }

      delete project.files[file];

      if (current === file) {
        current =
          Object.keys(project.files)[0];
      }

      render();
      save();

      return;
    }

    if (data.move) {
      const file =
        decodeURIComponent(data.move);

      const folder = prompt(
        'Move script into folder.\n\nLeave blank to move it to the project root.',
        ''
      );

      if (folder === null) return;

      const clean = folder
        .trim()
        .replace(/^\/+|\/+$/g, '');

      const name =
        file.split('/').at(-1);

      const newPath = clean
        ? clean + '/' + name
        : name;

      if (newPath === file) return;

      project.files[newPath] =
        project.files[file];

      delete project.files[file];

      if (current === file) {
        current = newPath;
      }

      render();
      save();

      return;
    }

    if (data.newInFolder) {
      const folder =
        decodeURIComponent(
          data.newInFolder
        );

      let name = prompt(
        'New script name',
        'script.sglx'
      );

      if (!name) return;

      if (!name.endsWith('.sglx')) {
        name += '.sglx';
      }

      const path =
        folder + '/' + name;

      project.files[path] = '';

      current = path;

      render();
      save();

      return;
    }

    if (data.renameFolder) {
      const old =
        decodeURIComponent(
          data.renameFolder
        );

      const base =
        old.split('/').at(-1);

      const name = prompt(
        'Rename folder',
        base
      );

      if (!name || name === base) {
        return;
      }

      const parent =
        old.includes('/')
          ? old.slice(
              0,
              old.lastIndexOf('/') + 1
            )
          : '';

      const newPath =
        parent + name;

      const updated = {};

      for (
        const file of Object.keys(
          project.files
        )
      ) {
        if (
          file === old ||
          file.startsWith(old + '/')
        ) {
          const replacement =
            newPath +
            file.slice(old.length);

          updated[replacement] =
            project.files[file];

          delete project.files[file];
        }
      }

      Object.assign(
        project.files,
        updated
      );

      if (
        current === old ||
        current.startsWith(old + '/')
      ) {
        current =
          newPath +
          current.slice(old.length);
      }

      render();
      save();

      return;
    }

    if (data.deleteFolder) {
      const folder =
        decodeURIComponent(
          data.deleteFolder
        );

      if (
        !confirm(
          'Delete folder and all scripts inside it?\n\n' +
          folder
        )
      ) {
        return;
      }

      for (
        const file of Object.keys(
          project.files
        )
      ) {
        if (
          file === folder ||
          file.startsWith(folder + '/')
        ) {
          delete project.files[file];
        }
      }

      const remaining =
        Object.keys(project.files);

      if (!remaining.length) {
        project.files['main.sglx'] =
          'say("Welcome to SingulaX!")\n';
      }

      current =
        remaining[0] ||
        'main.sglx';

      render();
      save();

      return;
    }

    if (data.asset) {
      previewAsset(
        decodeURIComponent(
          data.asset
        )
      );

      return;
    }

    if (data.renameAsset) {
      const old =
        decodeURIComponent(
          data.renameAsset
        );

      const name = prompt(
        'Rename asset',
        old
      );

      if (!name || name === old) {
        return;
      }

      project.assets[name] =
        project.assets[old];

      delete project.assets[old];

      render();
      save();

      return;
    }

    if (data.deleteAsset) {
      const asset =
        decodeURIComponent(
          data.deleteAsset
        );

      if (
        !confirm(
          'Delete asset ' +
          asset +
          '?'
        )
      ) {
        return;
      }

      delete project.assets[asset];

      render();
      save();
    }
  });
}

function wireBasicButtons() {
  $('saveBtn')?.addEventListener(
    'click',
    save
  );

  $('clearConsole')?.addEventListener(
    'click',
    () => {
      if (consoleEl) {
        consoleEl.textContent = '';
      }
    }
  );

  $('newFileBtn')?.addEventListener(
    'click',
    () => {
      let name = prompt(
        'File name',
        'script.sglx'
      );

      if (!name) return;

      if (!/\.[\w-]+$/.test(name)) {
        name += '.sglx';
      }

      project.files[name] = '';

      current = name;

      render();
      save();
    }
  );

  $('newFolderBtn')?.addEventListener(
    'click',
    createFolder
  );

  $('newBtn')?.addEventListener(
    'click',
    () => {
      if (
        !confirm(
          'Create a new project?'
        )
      ) {
        return;
      }

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

      current = 'main.sglx';

      render();
      save();
    }
  );
}

let latestFrame = [];
let paintHandle = 0;

function draw(frame = []) {
  latestFrame =
    Array.isArray(frame)
      ? frame.slice()
      : [];
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
  if (!canvas) return;

  const ctx =
    canvas.getContext('2d');

  if (!ctx) return;

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.fillStyle = '#05060a';

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  for (const item of frame) {
    ctx.fillStyle =
      item.fill || 'white';

    ctx.strokeStyle =
      item.fill || 'white';

    if (item.type === 'rect') {
      ctx.fillRect(
        item.x,
        item.y,
        item.w,
        item.h
      );
    }

    if (item.type === 'circle') {
      ctx.beginPath();

      ctx.arc(
        item.x,
        item.y,
        item.r,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    if (item.type === 'line') {
      ctx.lineWidth =
        item.width || 2;

      ctx.beginPath();

      ctx.moveTo(
        item.x1,
        item.y1
      );

      ctx.lineTo(
        item.x2,
        item.y2
      );

      ctx.stroke();
    }

    if (item.type === 'text') {
      ctx.font =
        (item.size || 20) +
        'px sans-serif';

      ctx.fillText(
        item.text,
        item.x,
        item.y
      );
    }

    if (item.type === 'cube') {
      drawCube(ctx, item);
    }

    if (item.type === 'image') {
      const url =
        project.assets[item.asset];

      if (url) {
        paintCanvas.images ??=
          new Map();

        let image =
          paintCanvas.images.get(
            url
          );

        if (!image) {
          image = new Image();
          image.src = url;

          paintCanvas.images.set(
            url,
            image
          );
        }

        if (image.complete) {
          ctx.drawImage(
            image,
            item.x,
            item.y,
            item.w || image.width,
            item.h || image.height
          );
        }
      }
    }
  }
}

function drawCube(ctx, item) {
  const size =
    70 * (item.size || 1);

  const cx =
    400 +
    (item.x || 0) * 60;

  const cy =
    240 -
    (item.z || 0) * 40 -
    (item.y || 0) * 60;

  ctx.beginPath();

  ctx.moveTo(
    cx - size,
    cy - size
  );

  ctx.lineTo(
    cx,
    cy - size * 0.55
  );

  ctx.lineTo(
    cx + size,
    cy - size
  );

  ctx.lineTo(
    cx + size,
    cy
  );

  ctx.lineTo(
    cx,
    cy + size * 0.45
  );

  ctx.lineTo(
    cx - size,
    cy
  );

  ctx.closePath();

  ctx.strokeStyle =
    item.fill || '#7cf';

  ctx.stroke();

  ctx.beginPath();

  ctx.moveTo(
    cx - size,
    cy
  );

  ctx.lineTo(
    cx,
    cy + size * 0.45
  );

  ctx.lineTo(
    cx + size,
    cy
  );

  ctx.stroke();
}

async function run() {
  if (
    typeof SingulaxRuntime ===
    'undefined'
  ) {
    alert(
      'SingulaX runtime.js could not be loaded.'
    );

    return;
  }

  save();

  stop();

  if (consoleEl) {
    consoleEl.textContent = '';
  }

  if ($('diagnostics')) {
    $('diagnostics').textContent = '';
  }

  latestFrame = [];

  runtime =
    new SingulaxRuntime({
      output: log,

      frame: draw,

      input: async promptText => {
        log(promptText);

        return await new Promise(
          resolve => {
            window._inputResolve =
              resolve;

            $('stdin')?.focus();
          }
        );
      },

      fileRead: async path =>
        project.files[path] ??
        project.assets[path] ??
        '',

      fileWrite: async (
        path,
        content
      ) => {
        project.files[path] =
          String(content);

        renderTree();
        save();

        return true;
      },

      playAudio,

      mode3d: value => {
        if ($('previewMode')) {
          $('previewMode').value =
            value
              ? '3d'
              : '2d';
        }
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

  } catch (error) {
    showError(error);

  } finally {
    if (paintHandle) {
      cancelAnimationFrame(
        paintHandle
      );

      paintHandle = 0;
    }

    runtime = null;
  }
}

function stop() {
  if (runtime) {
    runtime.running = false;
    runtime = null;
  }

  if (paintHandle) {
    cancelAnimationFrame(
      paintHandle
    );

    paintHandle = 0;
  }

  paintCanvas(
    latestFrame
  );

  log('[stopped]');
}

function wireRunStop() {
  const runButton =
    $('runBtn');

  const stopButton =
    $('stopBtn');

  if (runButton) {
    runButton.onclick = run;
  }

  if (stopButton) {
    stopButton.onclick = stop;
  }
}

if ($('stdin')) {
  $('stdin').addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Enter' &&
        window._inputResolve
      ) {
        const value =
          event.target.value;

        event.target.value = '';

        const resolve =
          window._inputResolve;

        window._inputResolve =
          null;

        resolve(value);
      }
    }
  );
}

window.addEventListener(
  'keydown',
  event => {
    keys.add(event.key);

    runtime?.setInput({
      keys: [event.key],
      pressed: [event.key]
    });
  }
);

window.addEventListener(
  'keyup',
  event => {
    keys.delete(event.key);

    runtime?.setInput({
      up: [event.key]
    });
  }
);

function readGamepads() {
  try {
    return navigator
      .getGamepads?.()
      ?.filter(Boolean)
      .map(gamepad => ({
        id: gamepad.id,
        index: gamepad.index,
        buttons:
          gamepad.buttons.map(
            button => ({
              pressed:
                button.pressed,
              value:
                button.value
            })
          ),
        axes:
          [...gamepad.axes]
      })) || [];
  } catch {
    return [];
  }
}

function pointerPosition(event) {
  if (!canvas) {
    return {
      x: 0,
      y: 0
    };
  }

  const rect =
    canvas.getBoundingClientRect();

  return {
    x:
      (event.clientX -
        rect.left) *
      (canvas.width /
        rect.width),

    y:
      (event.clientY -
        rect.top) *
      (canvas.height /
        rect.height)
  };
}

if (canvas) {
  canvas.addEventListener(
    'pointermove',
    event => {
      const p =
        pointerPosition(event);

      mouse.x = p.x;
      mouse.y = p.y;

      if (event.pointerType === 'touch') {
        touch.x = p.x;
        touch.y = p.y;
      }

      runtime?.setInput({
        mouse,
        touch
      });
    }
  );

  canvas.addEventListener(
    'pointerdown',
    event => {
      const p =
        pointerPosition(event);

      mouse.x = p.x;
      mouse.y = p.y;

      mouse.down = true;

      if (
        event.pointerType ===
        'touch'
      ) {
        touch.x = p.x;
        touch.y = p.y;
        touch.active = true;
      }

      runtime?.setInput({
        mouse,
        touch
      });
    }
  );

  canvas.addEventListener(
    'pointerup',
    event => {
      mouse.down = false;

      if (
        event.pointerType ===
        'touch'
      ) {
        touch.active = false;
      }

      runtime?.setInput({
        mouse,
        touch
      });
    }
  );
}

function showError(error) {
  const message =
    error?.message ||
    String(error);

  log(
    '[error] ' +
    message
  );

  if ($('diagnostics')) {
    $('diagnostics').innerHTML =
      `<div>● ${esc(message)}</div>`;
  }

  console.error(
    'SingulaX error:',
    error
  );
}

function diagnose() {
  if (!$('diagnostics') || !editor) {
    return;
  }

  const source =
    editor.value;

  const lines =
    source.split(/\r?\n/);

  const diagnostics = [];

  let depth = 0;

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const raw =
      lines[i];

    const line =
      raw.trim();

    if (!line) continue;

    if (
      line.startsWith('//')
    ) {
      continue;
    }

    if (
      /^(if|while|forever|for|function|repeat(?:\.until(?:\.statement)?)?)\b/.test(
        line
      )
    ) {
      depth++;
    }

    if (
      line === 'end'
    ) {
      depth--;

      if (depth < 0) {
        diagnostics.push(
          `Line ${i + 1}: unexpected end`
        );

        depth = 0;
      }
    }

    if (
      /\botherwise\b/.test(
        line
      )
    ) {
      diagnostics.push(
        `Line ${i + 1}: "otherwise" is not SingulaX syntax. Use "else".`
      );
    }
  }

  if (depth > 0) {
    diagnostics.push(
      'A block is missing an "end".'
    );
  }

  if (diagnostics.length) {
    $('diagnostics').innerHTML =
      diagnostics
        .map(
          d =>
            `<div>● ${esc(d)}</div>`
        )
        .join('');
  } else {
    $('diagnostics').textContent =
      '';
  }
}

if (editor) {
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
          JSON.stringify(project)
        );
      }

      diagnose();
      showCompletions();
    }
  );

  editor.addEventListener(
    'scroll',
    () => {
      if ($('gutter')) {
        $('gutter').scrollTop =
          editor.scrollTop;
      }
    }
  );

  editor.addEventListener(
    'keydown',
    event => {
      if (event.key === 'Tab') {
        if (
          !$('suggestions')?.hidden
        ) {
          acceptCompletion();
          event.preventDefault();
          return;
        }

        event.preventDefault();

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
        event.key === 'Enter'
      ) {
        if (
          !$('suggestions')?.hidden
        ) {
          acceptCompletion();
          event.preventDefault();
          return;
        }

        setTimeout(
          diagnose,
          0
        );
      }

      if (
        event.key === 'ArrowDown' &&
        !$('suggestions')?.hidden
      ) {
        moveCompletion(1);
        event.preventDefault();
      }

      if (
        event.key === 'ArrowUp' &&
        !$('suggestions')?.hidden
      ) {
        moveCompletion(-1);
        event.preventDefault();
      }

      if (
        event.key === 'Escape'
      ) {
        hideCompletions();
      }

      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.code ===
          'Space'
      ) {
        event.preventDefault();
        showCompletions(true);
      }
    }
  );
}

if ($('settingsBtn')) {
  $('settingsBtn').onclick =
    () => $('settings')?.showModal();
}

if ($('closeSettings')) {
  $('closeSettings').onclick =
    () => {
      $('settings')?.close();
      applySettings();
      save();
    };
}

if ($('theme')) {
  $('theme').onchange =
    applySettings;
}

if ($('fontSize')) {
  $('fontSize').oninput =
    applySettings;
}

if ($('autosave')) {
  $('autosave').onchange =
    save;
}

function applySettings() {
  const settings =
    project.settings || {};

  document.documentElement.style.setProperty(
    '--code-size',
    (settings.fontSize || 15) +
      'px'
  );

  if ($('theme')) {
    document.body.dataset.theme =
      $('theme').value ||
      settings.theme ||
      'midnight';
  }
}

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
  if (!editor) return;

  const {
    word,
    member
  } = completionContext();

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
    const query =
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
      item =>
        item.startsWith(query)
    );

  } else {
    const names = [
      ...new Set([
        ...keywords,
        ...builtins,
        ...Object.keys(
          project.files
        ).map(
          name =>
            name.replace(
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
        name =>
          name
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
          item =>
            item.toLowerCase() !==
            word.toLowerCase()
        )
      ];
    }
  }

  completionItems =
    pool.slice(0, 12);

  completionIndex = 0;

  const box =
    $('suggestions');

  if (
    !box ||
    !completionItems.length
  ) {
    hideCompletions();
    return;
  }

  box.hidden = false;

  box.innerHTML =
    completionItems
      .map(
        (item, index) =>
          `
          <button
            class="completion ${
              index === 0
                ? 'selected'
                : ''
            }"
            data-sug-index="${index}">
            <b>${esc(item)}</b>
          </button>
          `
      )
      .join('');

  box.onclick =
    event => {
      const button =
        event.target.closest(
          '[data-sug-index]'
        );

      if (!button) return;

      completionIndex =
        Number(
          button.dataset
            .sugIndex
        );

      acceptCompletion();
    };

  positionCompletions();
}

function positionCompletions() {
  const box =
    $('suggestions');

  if (!box) return;

  box.style.left =
    '58px';

  box.style.top =
    '36px';
}

function acceptCompletion() {
  if (
    !completionItems.length ||
    !editor
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

    end - prefixLength,
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
      (button, index) => {
        button.classList.toggle(
          'selected',
          index ===
            completionIndex
        );
      }
    );
}

function hideCompletions() {
  if ($('suggestions')) {
    $('suggestions').hidden =
      true;
  }

  completionItems = [];
}

async function previewAsset(
  name
) {
  const url =
    project.assets[name];

  if (
    url?.startsWith(
      'data:image/'
    )
  ) {
    const windowRef =
      window.open();

    if (!windowRef) return;

    windowRef.document.write(
      `<img src="${url}" style="max-width:100%">`
    );

  } else if (
    url?.startsWith(
      'data:audio/'
    )
  ) {
    const windowRef =
      window.open();

    if (!windowRef) return;

    windowRef.document.write(
      `<audio controls autoplay src="${url}"></audio>`
    );

  } else if (
    url?.startsWith(
      'data:video/'
    )
  ) {
    const windowRef =
      window.open();

    if (!windowRef) return;

    windowRef.document.write(
      `<video controls autoplay style="max-width:100%" src="${url}"></video>`
    );

  } else {
    alert(name);
  }
}

function playAudio(name) {
  const url =
    project.assets[name] ||
    name;

  if (!url) return;

  const audio =
    new Audio(url);

  audio.play().catch(
    () => {}
  );
}

// ------------------------------
// HELP
// ------------------------------

function ensureHelp() {
  if (!$('helpBtn')) {
    const button =
      document.createElement(
        'button'
      );

    button.id =
      'helpBtn';

    button.textContent =
      '? Help';

    button.title =
      'Open SingulaX examples';

    document
      .querySelector('header')
      ?.appendChild(
        button
      );

    button.onclick =
      openHelp;
  }

  if (!$('helpDialog')) {
    const dialog =
      document.createElement(
        'dialog'
      );

    dialog.id =
      'helpDialog';

    dialog.style.cssText =
      `
      width:min(900px,94vw);
      max-height:88vh;
      overflow:auto;
      `;

    dialog.innerHTML =
      `
      <h2>
        SingulaX Help & Examples
      </h2>

      <p>
        These examples use
        SingulaX syntax.
        Comments use
        <code>// ... //</code>.
      </p>

      <div id="exampleList">
        Loading examples...
      </div>

      <button id="closeHelp">
        Close
      </button>
      `;

    document.body.appendChild(
      dialog
    );

    $('closeHelp').onclick =
      () => dialog.close();
  }
}

async function openHelp() {
  ensureHelp();

  const dialog =
    $('helpDialog');

  const box =
    $('exampleList');

  if (!dialog || !box) {
    return;
  }

  dialog.showModal();

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
      `
      white-space:pre-wrap;
      background:#070910;
      padding:12px;
      border-radius:8px;
      overflow:auto;
      `;

    try {
      let text =
        await fetch(
          '../examples/' +
          encodeURIComponent(
            name
          )
        ).then(
          response => {
            if (!response.ok) {
              throw new Error(
                'HTTP ' +
                response.status
              );
            }

            return response.text();
          }
        );

      text =
        cleanExampleComments(
          text
        );

      pre.textContent =
        text;

    } catch (error) {
      pre.textContent =
        'Could not load this example: ' +
        error.message;
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

function cleanExampleComments(
  text
) {
  return String(text)
    .replace(
      /^\s*#\s?(.*)$/gm,
      '// $1 //'
    )
    .replace(
      /\s+#\s?(.*)$/gm,
      ' // $1 //'
    )
    .replace(
      /\botherwise\b/g,
      'else'
    );
}

// ------------------------------
// STUDIO TABS
// ------------------------------

const studioTabs = [
  'code',
  'console',
  'preview'
];

function setStudioTab(
  name
) {
  studioTabs.forEach(
    panel => {
      const element =
        $('window-' + panel);

      if (element) {
        element.classList.toggle(
          'active-window',
          panel === name
        );
      }

      const button =
        $('tab-' + panel);

      if (button) {
        button.classList.toggle(
          'active',
          panel === name
        );
      }
    }
  );

  document.body.dataset.focusPanel =
    name;
}

function initStudioTabs() {
  studioTabs.forEach(
    name => {
      const button =
        $('tab-' + name);

      if (!button) return;

      button.onclick =
        () =>
          setStudioTab(name);
    }
  );

  const multitask =
    $('multitaskBtn');

  if (multitask) {
    multitask.onclick =
      () =>
        document.body.classList.toggle(
          'multitask'
        );
  }

  const reset =
    $('resetLayoutBtn');

  if (reset) {
    reset.onclick =
      () => {
        document.body.classList.remove(
          'multitask'
        );

        setStudioTab(
          'code'
        );
      };
  }

  setStudioTab(
    'code'
  );
}

// ------------------------------
// PROJECT LOADING
// ------------------------------

function normalizeProject(
  value
) {
  let p =
    value &&
    typeof value ===
      'object'
      ? value
      : {};

  p.name =
    typeof p.name ===
      'string' &&
    p.name
      ? p.name
      : 'MyProject';

  p.files =
    p.files &&
    typeof p.files ===
      'object'
      ? p.files
      : {
          'main.sglx':
            'say("Welcome to SingulaX!")\n'
        };

  p.assets =
    p.assets &&
    typeof p.assets ===
      'object'
      ? p.assets
      : {};

  p.folders =
    Array.isArray(
      p.folders
    )
      ? p.folders
      : [];

  p.settings =
    p.settings &&
    typeof p.settings ===
      'object'
      ? p.settings
      : {
          theme: 'midnight',
          fontSize: 15,
          autosave: true
        };

  if (
    !Object.keys(
      p.files
    ).length
  ) {
    p.files['main.sglx'] =
      'say("Welcome to SingulaX!")\n';
  }

  return p;
}

function startStudio() {
  try {
    const saved =
      localStorage.getItem(
        'singulax-project'
      );

    if (saved) {
      try {
        project =
          normalizeProject(
            JSON.parse(
              saved
            )
          );
      } catch {
        project =
          normalizeProject(
            null
          );
      }
    } else {
      project =
        normalizeProject(
          project
        );
    }

    current =
      Object.keys(
        project.files
      )[0] ||
      'main.sglx';

    if ($('projectName')) {
      $('projectName').value =
        project.name;
    }

    if ($('theme')) {
      $('theme').value =
        project.settings.theme ||
        'midnight';
    }

    if ($('fontSize')) {
      $('fontSize').value =
        project.settings.fontSize ||
        15;
    }

    if ($('autosave')) {
      $('autosave').checked =
        project.settings.autosave !==
        false;
    }

    render();

    wireBasicButtons();
    wireRunStop();
    ensureHelp();
    initStudioTabs();

  } catch (error) {
    console.error(
      'SingulaX startup error:',
      error
    );

    const diagnostics =
      $('diagnostics');

    if (diagnostics) {
      diagnostics.innerHTML =
        `<div>● Studio startup error: ${esc(
          error.message ||
            error
        )}</div>`;
    }
  }

  if (
    'serviceWorker' in
    navigator
  ) {
    navigator.serviceWorker
      .register(
        'sw.js?v=8'
      )
      .catch(
        error =>
          console.warn(
            'Service worker:',
            error
          )
      );
  }
}

// Start only after the HTML exists.

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    startStudio,
    {
      once: true
    }
  );
} else {
  startStudio();
}
