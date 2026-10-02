import { supabase } from './supabase.js';

const IDE_QUERY = new URLSearchParams(location.search);
const cloudId = IDE_QUERY.get('project');

function setAccountBar() {
  const header = document.querySelector('header');
  if (!header || document.getElementById('accountNav')) return;
  const wrap = document.createElement('div');
  wrap.id = 'accountNav';
  wrap.style.cssText = 'display:flex;align-items:center;gap:7px;margin-left:auto;flex-wrap:wrap;';
  wrap.innerHTML = '<a href="my-projects.html" style="display:inline-flex;align-items:center;text-decoration:none;color:inherit;border:1px solid var(--border,#272e47);background:var(--panel,#151a2a);border-radius:10px;padding:8px 12px">My Projects</a><a href="account.html" style="display:inline-flex;align-items:center;text-decoration:none;color:inherit;border:1px solid var(--border,#272e47);background:var(--panel,#151a2a);border-radius:10px;padding:8px 12px">Account</a>';
  header.appendChild(wrap);
}

async function loadCloudProject() {
  if (!cloudId) return;
  const { data, error } = await supabase.from('projects').select('id,name,data').eq('id',cloudId).single();
  if (error) {
    alert('Could not load cloud project: '+error.message);
    return;
  }
  if (!data?.data) return;
  const project = {...data.data, cloudId:data.id, name:data.name || data.data.name || 'MyProject'};
  localStorage.setItem('singulax-project', JSON.stringify(project));
  const clean = location.pathname + location.hash;
  location.replace(clean);
}

let saveTimer = 0;
async function cloudSave() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return;
  let raw;
  try { raw = JSON.parse(localStorage.getItem('singulax-project') || 'null'); } catch { raw = null; }
  if (!raw) return;
  const payload = {name:raw.name || 'MyProject', data:raw, updated_at:new Date().toISOString()};
  if (raw.cloudId) {
    const { error } = await supabase.from('projects').update(payload).eq('id',raw.cloudId);
    if (error) console.warn('SingulaX cloud save:',error.message);
  } else {
    const { data, error } = await supabase.from('projects').insert({owner_id:user.id,...payload}).select('id').single();
    if (!error && data?.id) {
      raw.cloudId = data.id;
      localStorage.setItem('singulax-project',JSON.stringify(raw));
    } else if (error) {
      console.warn('SingulaX cloud save:',error.message);
    }
  }
}

function queueCloudSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(cloudSave, 650);
}

setAccountBar();
document.getElementById('saveBtn')?.addEventListener('click', queueCloudSave);
document.getElementById('editor')?.addEventListener('input', queueCloudSave);
document.getElementById('projectName')?.addEventListener('input', queueCloudSave);

if (cloudId) {
  loadCloudProject();
} else {
  supabase.auth.getSession().then(({data}) => {
    if (data?.session) queueCloudSave();
  });
}
