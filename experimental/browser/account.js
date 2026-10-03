import { supabase } from './supabase.js';

const $ = id => document.getElementById(id);

// Supabase password auth requires an email or phone internally.
// This address is never shown to users and is only an internal auth identifier.
// Confirm Email must be disabled so username signup does not send an email.
const syntheticDomain = 'users.singulax.local';
const EMAIL_REDIRECT = 'https://lyte3075.github.io/SingulaX/browser/account.html';

function authEmail(username) {
  return username.trim().toLowerCase() + '@' + syntheticDomain;
}
function message(text, error=false) {
  $('status').textContent=text;
  $('status').className=error?'status error':'status';
}
async function getProfile(userId) {
  const {data,error}=await supabase.from('profiles').select('username,email').eq('id',userId).maybeSingle();
  if(error) throw error;
  return data;
}
async function refresh() {
  const {data} = await supabase.auth.getSession();
  const session=data?.session;
  if(session && session.user?.email && !session.user.email.endsWith('@'+syntheticDomain)) {
    await supabase.from('profiles').update({email:session.user.email}).eq('id',session.user.id);
  }
  $('signedIn').hidden=!session;
  $('authForm').hidden=!!session;
  if(session){
    const profile=await getProfile(session.user.id);
    $('username').textContent=profile?.username || session.user.user_metadata?.username || 'SingulaX user';
    $('verifiedEmail').textContent=profile?.email ? 'Email added: '+profile.email : 'No verification email added';
    $('emailSettings').hidden=!!profile?.email;
  }
}
$('authForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const username=$('usernameInput').value.trim();
  const password=$('passwordInput').value;
  const mode=$('mode').value;
  if(!/^[A-Za-z0-9_]{3,24}$/.test(username)){
    message('Username must be 3–24 characters using letters, numbers, or _.',true); return;
  }
  if(password.length<6){message('Password must be at least 6 characters.',true);return;}
  $('submit').disabled=true;
  message(mode==='signup'?'Creating your username account…':'Signing you in…');
  try{
    if(mode==='signup'){
      // The user supplies only a username and password.
      // Supabase receives the hidden internal identifier above because
      // password auth requires email or phone; it must not require verification.
      const email=authEmail(username);
      const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username}}});
      if(error) throw error;
      if(!data.user) throw new Error('Account creation failed.');
      const {error:profileError}=await supabase.from('profiles').insert({id:data.user.id,username:username.toLowerCase(),email:null});
      if(profileError){
        await supabase.auth.signOut();
        if(profileError.code==='23505') throw new Error('That username is already taken.');
        throw profileError;
      }
      if(data.session) location.href='my-projects.html';
      else message('Account created. Sign in with your username and password.');
    }else{
      const {data:profile,error:profileError}=await supabase.from('profiles').select('email').eq('username',username.toLowerCase()).maybeSingle();
      if(profileError) throw profileError;
      if(!profile) throw new Error('Username not found.');
      // Username is the only credential the user enters.
      // If a real verification email was later added, it becomes the
      // internal Supabase login address while the username stays unchanged.
      const loginEmail=profile.email || authEmail(username);
      const {error}=await supabase.auth.signInWithPassword({email:loginEmail,password});
      if(error) throw error;
      location.href='my-projects.html';
    }
  }catch(error){message(error.message||'Authentication failed.',true);}
  finally{$('submit').disabled=false;}
});
$('mode').addEventListener('change',()=>{
  $('submit').textContent=$('mode').value==='signup'?'Create account':'Sign in';
  $('passwordInput').autocomplete=$('mode').value==='signup'?'new-password':'current-password';
});
$('addEmail').onclick=async()=>{
  const email=$('emailInput').value.trim();
  if(!email || !email.includes('@')){message('Enter a valid email address.',true);return;}
  try{
    const {data:sessionData}=await supabase.auth.getSession();
    if(!sessionData?.session) return;
    const {error}=await supabase.auth.updateUser({email},{emailRedirectTo:EMAIL_REDIRECT});
    if(error) throw error;
    message('Verification email sent. Confirm it to verify your email.');
    await refresh();
  }catch(error){message(error.message||'Could not add email.',true);}
};
$('signOut').onclick=async()=>{await supabase.auth.signOut();await refresh();message('Signed out.');};
$('projects').onclick=()=>location.href='my-projects.html';
await refresh();