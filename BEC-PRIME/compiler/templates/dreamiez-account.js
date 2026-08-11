(() => {
  const $ = id => document.getElementById(id);
  let mode = 'create';
  let avatarStyle = 'dream';
  const msg = text => { $('msg').textContent = text || ''; };
  function orb(style) { return style === 'night' ? '☾' : style === 'gold' ? '◆' : '✦'; }
  function renderAccount(data) {
    $('authPanel').style.display = 'none';
    $('accountPanel').style.display = 'block';
    const a = data.account;
    $('accountName').textContent = a.name;
    $('accountOrb').textContent = orb(a.avatar_style);
    $('accountOrb').className = 'orb ' + (a.avatar_style === 'dream' ? '' : a.avatar_style);
    $('streak').textContent = `${a.streak} day${a.streak === 1 ? '' : 's'}`;
    const rewards = data.rewards || [];
    $('rewards').innerHTML = rewards.map(r => `<div class="reward"><strong>${r.name}</strong><span>Day ${r.day} · ${r.description}</span></div>`).join('');
  }
  async function api(path, options) {
    const r = await fetch(path, { headers: {'Content-Type':'application/json'}, ...options });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  }
  async function submit() {
    msg('Working...');
    try {
      const payload = { email: $('email').value, password: $('password').value };
      if (mode === 'create') { payload.name = $('name').value; payload.avatar_style = avatarStyle; }
      const data = await api(mode === 'create' ? '/api/dreamiez/account/create' : '/api/dreamiez/account/login', { method:'POST', body:JSON.stringify(payload) });
      renderAccount(data);
    } catch (e) { msg(e.message); }
  }
  async function checkin() { try { renderAccount(await api('/api/dreamiez/checkin', {method:'POST',body:'{}'})); } catch(e) { msg(e.message); } }
  async function logout() { await api('/api/dreamiez/account/logout', {method:'POST',body:'{}'}); location.reload(); }
  $('createTab').onclick = () => { mode='create'; $('createTab').classList.add('active'); $('loginTab').classList.remove('active'); $('nameField').style.display='block'; $('avatarField').style.display='block'; $('submit').textContent='Create my Dreamiez'; msg(''); };
  $('loginTab').onclick = () => { mode='login'; $('loginTab').classList.add('active'); $('createTab').classList.remove('active'); $('nameField').style.display='none'; $('avatarField').style.display='none'; $('submit').textContent='Log in'; msg(''); };
  document.querySelectorAll('.avatar').forEach(b => b.onclick = () => { avatarStyle=b.dataset.style; document.querySelectorAll('.avatar').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); });
  $('submit').onclick = submit;
  $('checkin').onclick = checkin;
  $('logout').onclick = logout;
  api('/api/dreamiez/me').then(renderAccount).catch(() => {});
})();
