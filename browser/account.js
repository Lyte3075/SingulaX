import { supabase } from './supabase.js';

const $ = id => document.getElementById(id);

// Supabase's native password provider requires an internal email/phone identifier.
// SingulaX does NOT expose that identifier to users. The public identity is only
// the username stored in public.profiles. Email and SMTP are not part of the UI.
const syntheticDomain = 'auth.singulax.internal';

function authEmail(username) {
  return username.trim().toLowerCase() + '@' + syntheticDomain;
}

function message(text, error=false) {
  $('status').textContent=text;
  $('status').className=error?'status error':'status';
}

async function getProfile(userId) {
  const {data,error}=await supabase
    .from('profiles')
    .select('username')
    .eq('id',userId)
    .maybeSingle();
  if(error) throw error;
  return data;
}

async function refresh() {
  const {data} = await supabase.auth.getSession();
  const session=data?.session;
  $('signedIn').hidden=!session;
  $('authForm').hidden=!!session;

  if(session){
    const profile=await getProfile(session.user.id);
    $('username').textContent=
      profile?.username ||
      session.user.user_metadata?.username ||
      'SingulaX user';
  }
}

$('authForm').addEventListener('submit',async event=>{
  event.preventDefault();

  const username=$('usernameInput').value.trim();
  const password=$('passwordInput').value;
  const mode=$('mode').value;

  if(!/^[A-Za-z0-9_]{3,24}$/.test(username)){
    message('Username must be 3–24 characters using letters, numbers, or _.',true);
    return;
  }
  if(password.length<6){
    message('Password must be at least 6 characters.',true);
    return;
  }

  $('submit').disabled=true;
  message(mode==='signup'?'Creating your SingulaX account…':'Signing you in…');

  try{
    if(mode==='signup'){
      // Users provide ONLY a username and password.
      // The hidden identifier exists solely because Supabase's native password
      // auth API requires an email or phone internally.
      const {data,error}=await supabase.auth.signUp({
        email:authEmail(username),
        password,
        options:{data:{username:username.toLowerCase()}}
      });
      if(error) throw error;
      if(!data.user) throw new Error('Account creation failed.');

      const {error:profileError}=await supabase.from('profiles').insert({
        id:data.user.id,
        username:username.toLowerCase()
      });

      if(profileError){
        await supabase.auth.signOut();
        if(profileError.code==='23505') throw new Error('That username is already taken.');
        throw profileError;
      }

      if(data.session){
        location.href='my-projects.html';
      }else{
        message('Account created. Sign in with your username and password.');
      }
    }else{
      const {data:profile,error:profileError}=await supabase
        .from('profiles')
        .select('username')
        .eq('username',username.toLowerCase())
        .maybeSingle();

      if(profileError) throw profileError;
      if(!profile) throw new Error('Username not found.');

      const {error}=await supabase.auth.signInWithPassword({
        email:authEmail(profile.username),
        password
      });

      if(error) throw error;
      location.href='my-projects.html';
    }
  }catch(error){
    message(error.message||'Authentication failed.',true);
  }finally{
    $('submit').disabled=false;
  }
});

$('mode').addEventListener('change',()=>{
  $('submit').textContent=$('mode').value==='signup'?'Create account':'Sign in';
  $('passwordInput').autocomplete=$('mode').value==='signup'?'new-password':'current-password';
});

$('signOut').onclick=async()=>{
  await supabase.auth.signOut();
  await refresh();
  message('Signed out.');
};

$('projects').onclick=()=>location.href='my-projects.html';

await refresh();