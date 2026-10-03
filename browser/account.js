import { supabase } from './supabase.js';

const $ = id => document.getElementById(id);
const syntheticDomain = 'auth.singulax.internal';

function authEmail(username) { return username.trim().toLowerCase() + '@' + syntheticDomain; }
function message(text, error=false) { $('status').textContent=text; $('status').className=error?'status error':'status'; }

async function getProfile(userId) {
  const {data,error}=await supabase.from('profiles').select('username,avatar_url').eq('id',userId).maybeSingle();
  if(error) throw error;
  return data;
}
function showAvatar(profile, username) {
  const url=profile?.avatar_url||'';
  $('avatarFallback').textContent=(username||'S').charAt(0).toUpperCase();
  $('avatarPreview').hidden=!url; $('avatarFallback').hidden=!!url;
  if(url) $('avatarPreview').src=url;
}
async function refresh() {
  const {data}=await supabase.auth.getSession();
  const session=data?.session;
  $('signedIn').hidden=!session; $('authForm').hidden=!!session;
  if(session){
    const profile=await getProfile(session.user.id);
    const username=profile?.username||session.user.user_metadata?.username||'SingulaX user';
    $('username').textContent=username; showAvatar(profile,username);
  }
}

$('authForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const username=$('usernameInput').value.trim(), password=$('passwordInput').value, mode=$('mode').value;
  if(!/^[A-Za-z0-9_]{3,24}$/.test(username)){message('Username must be 3–24 characters using letters, numbers, or _.',true);return;}
  if(password.length<6){message('Password must be at least 6 characters.',true);return;}
  $('submit').disabled=true; message(mode==='signup'?'Creating your SingulaX account…':'Signing you in…');
  try{
    if(mode==='signup'){
      const {data,error}=await supabase.auth.signUp({email:authEmail(username),password,options:{data:{username:username.toLowerCase()}}});
      if(error) throw error; if(!data.user) throw new Error('Account creation failed.');
      const {error:profileError}=await supabase.from('profiles').insert({id:data.user.id,username:username.toLowerCase()});
      if(profileError){await supabase.auth.signOut();if(profileError.code==='23505') throw new Error('That username is already taken.');throw profileError;}
      if(data.session) location.href='my-projects.html'; else message('Account created. Sign in with your username and password.');
    }else{
      const {data:profile,error:profileError}=await supabase.from('profiles').select('username').eq('username',username.toLowerCase()).maybeSingle();
      if(profileError) throw profileError; if(!profile) throw new Error('Username not found.');
      const {error}=await supabase.auth.signInWithPassword({email:authEmail(profile.username),password});
      if(error) throw error; location.href='my-projects.html';
    }
  }catch(error){message(error.message||'Authentication failed.',true);}finally{$('submit').disabled=false;}
});
$('mode').addEventListener('change',()=>{$('submit').textContent=$('mode').value==='signup'?'Create account':'Sign in';$('passwordInput').autocomplete=$('mode').value==='signup'?'new-password':'current-password';});

$('avatarInput').addEventListener('change',async event=>{
  const file=event.target.files?.[0]; if(!file)return;
  if(file.size>5*1024*1024){message('Profile pictures must be 5 MB or smaller.',true);event.target.value='';return;}
  const session=(await supabase.auth.getSession()).data?.session; if(!session){message('Sign in first.',true);return;}
  message('Uploading profile picture…');
  try{
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const path=session.user.id+'/avatar.'+ext;
    const {error:uploadError}=await supabase.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type});
    if(uploadError) throw uploadError;
    const {data:publicData}=supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl=publicData.publicUrl+'?v='+Date.now();
    const {error:updateError}=await supabase.from('profiles').update({avatar_url:avatarUrl}).eq('id',session.user.id);
    if(updateError) throw updateError;
    showAvatar({avatar_url:avatarUrl},$('username').textContent); message('Profile picture updated! ✨');
  }catch(error){message(error.message||'Could not upload profile picture.',true);}
  event.target.value='';
});
$('removeAvatar').onclick=async()=>{
  const session=(await supabase.auth.getSession()).data?.session; if(!session)return;
  message('Removing profile picture…');
  try{
    const {data:profile}=await supabase.from('profiles').select('avatar_url').eq('id',session.user.id).maybeSingle();
    if(profile?.avatar_url){
      const clean=profile.avatar_url.split('?')[0], marker='/storage/v1/object/public/avatars/', index=clean.indexOf(marker);
      if(index>=0){const path=decodeURIComponent(clean.slice(index+marker.length));await supabase.storage.from('avatars').remove([path]);}
    }
    const {error}=await supabase.from('profiles').update({avatar_url:null}).eq('id',session.user.id);
    if(error) throw error; showAvatar(null,$('username').textContent); message('Profile picture removed.');
  }catch(error){message(error.message||'Could not remove profile picture.',true);}
};
$('signOut').onclick=async()=>{await supabase.auth.signOut();await refresh();message('Signed out.');};
$('projects').onclick=()=>location.href='my-projects.html';
await refresh();