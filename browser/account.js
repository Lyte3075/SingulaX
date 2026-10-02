import { supabase } from './supabase.js';

const $ = id => document.getElementById(id);

function message(text, error = false) {
  $('status').textContent = text;
  $('status').className = error ? 'status error' : 'status';
}

async function refresh() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  $('signedIn').hidden = !session;
  $('authForm').hidden = !!session;
  if (session) {
    $('email').textContent = session.user.email || 'Signed-in account';
  }
}

$('authForm').addEventListener('submit', async event => {
  event.preventDefault();
  const email = $('emailInput').value.trim();
  const password = $('passwordInput').value;
  const mode = $('mode').value;
  if (!email || !password) {
    message('Enter your email and password.', true);
    return;
  }
  $('submit').disabled = true;
  message(mode === 'signup' ? 'Creating your account…' : 'Signing you in…');
  try {
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        message('Account created. Check your email to confirm your address, then sign in.');
      } else {
        message('Account created and signed in.');
        location.href = 'my-projects.html';
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      location.href = 'my-projects.html';
    }
  } catch (error) {
    message(error.message || 'Authentication failed.', true);
  } finally {
    $('submit').disabled = false;
  }
});

$('mode').addEventListener('change', () => {
  $('submit').textContent = $('mode').value === 'signup' ? 'Create account' : 'Sign in';
  $('passwordInput').autocomplete = $('mode').value === 'signup' ? 'new-password' : 'current-password';
});

$('signOut').onclick = async () => {
  await supabase.auth.signOut();
  await refresh();
  message('Signed out.');
};

$('projects').onclick = () => {
  location.href = 'my-projects.html';
};

$('emailInput').focus();
await refresh();
