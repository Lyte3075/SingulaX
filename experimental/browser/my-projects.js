import { supabase } from './supabase.js';

const $ = id => document.getElementById(id);
let currentUser = null;

function esc(s='') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function setStatus(text, error=false) {
  $('status').textContent = text;
  $('status').className = error ? 'status error' : 'status';
}

function blankProject(name='MyProject') {
  return {
    name,
    files: {'main.sglx': 'say("Welcome to SingulaX!")\n'},
    assets: {},
    folders: [],
    settings: {theme:'midnight',fontSize:15,autosave:true}
  };
}

function openProject(id, ide='full-ide.html') {
  location.href = ide + '?project=' + encodeURIComponent(id);
}

async function loadProjects() {
  const { data, error } = await supabase.from('projects')
    .select('id,name,description,created_at,updated_at')
    .order('updated_at', { ascending:false });
  if (error) throw error;
  $('grid').innerHTML = '';
  if (!data?.length) {
    $('grid').innerHTML = '<div class="empty">No cloud projects yet. Create your first one above.</div>';
    $('count').textContent = '0 projects';
    return;
  }
  $('count').textContent = data.length + (data.length === 1 ? ' project' : ' projects');
  for (const p of data) {
    const card = document.createElement('article');
    card.className = 'project';
    card.innerHTML =
      '<div class="projectTop"><div><h2>'+esc(p.name)+'</h2><p>'+esc(p.description||'No description.')+'</p></div><span>☁</span></div>' +
      '<div class="meta">Updated '+new Date(p.updated_at).toLocaleString()+'</div>' +
      '<div class="actions"><button class="primary">Open</button><button class="rename">Rename</button><button class="delete danger">Delete</button></div>';
    $('grid').appendChild(card);
    card.querySelector('.primary').onclick = () => openProject(p.id);
    card.querySelector('.rename').onclick = async () => {
      const name = prompt('Project name', p.name);
      if (!name || name.trim() === p.name) return;
      const { error } = await supabase.from('projects').update({name:name.trim()}).eq('id',p.id);
      if (error) setStatus(error.message,true); else loadProjects();
    };
    card.querySelector('.delete').onclick = async () => {
      if (!confirm('Delete '+p.name+'? This cannot be undone.')) return;
      const { error } = await supabase.from('projects').delete().eq('id',p.id);
      if (error) setStatus(error.message,true); else loadProjects();
    };
  }
}

async function createProject() {
  const name = prompt('Project name', 'MyProject');
  if (!name) return;
  const description = prompt('Description (optional)', '') ?? '';
  const project = blankProject(name.trim());
  const { data, error } = await supabase.from('projects').insert({
    owner_id: currentUser.id,
    name: project.name,
    description,
    data: project
  }).select('id').single();
  if (error) throw error;
  openProject(data.id);
}

$('newProject').onclick = async () => {
  try { await createProject(); } catch(e) { setStatus(e.message || 'Could not create project.', true); }
};

$('signOut').onclick = async () => {
  await supabase.auth.signOut();
  location.href = 'account.html';
};

$('account').onclick = () => location.href = 'account.html';

const { data, error } = await supabase.auth.getSession();
if (error || !data?.session) {
  location.href = 'account.html';
} else {
  currentUser = data.session.user;
  $('email').textContent = currentUser.email || 'Account';
  try { await loadProjects(); } catch(e) { setStatus(e.message || 'Could not load projects.', true); }
}
