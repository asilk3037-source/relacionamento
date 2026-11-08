import { html, raw, api, view, art, icon, logoMark, on, onForm, route, go, token, setMe, store, toast, errMsg, sheet, closeSheet, applyTheme, $ } from '../core.js';

const nav = false;

export function bootAuth() {
  route('/welcome', () => view(html`
    <section class="welcome">
      ${art('welcome-hero', 'Quatro pessoas adultas conversando numa praça, ligadas por caminhos curvos', 'hero-art')}
      <div class="brand" style="font-size:2.4rem">${logoMark()} elo</div>
      <h1>Conexões que fazem sentido.</h1>
      <p class="muted">Conheça pessoas por interesses e proximidade, com controle sobre quem vê o quê. Para maiores de 18 anos.</p>
      <div class="row-actions" style="margin-top:auto">
        <a class="btn primary block" href="#/signup">Criar conta</a>
        <a class="btn secondary block" href="#/login">Já tenho conta</a>
      </div>
      <p class="small muted center">Ao continuar, você confirma que tem 18 anos ou mais.</p>
    </section>`, { nav }));

  route('/signup', () => view(html`
    <a class="link" href="#/welcome">${icon('back')} Voltar</a>
    ${art('age-gate', '', 'spot-art')}
    <h1>Criar sua conta</h1>
    <p class="muted">O Elo é só para pessoas com 18 anos ou mais. Sua data de nascimento fica privada; só a idade aparece no perfil.</p>
    <form data-form="signup" novalidate>
      <label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" required>
      <label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required aria-describedby="pwh">
      <div class="field-hint" id="pwh">Mínimo de 8 caracteres, com letras e números.</div>
      <label for="birthDate">Data de nascimento</label><input id="birthDate" name="birthDate" type="date" required max="${new Date().toISOString().slice(0, 10)}">
      <label class="check"><input type="checkbox" name="acceptTerms" required><span>Tenho 18 anos ou mais e li e aceito os <a href="/legal.html#termos" target="_blank" rel="noopener">Termos de uso</a> e a <a href="/legal.html#privacidade" target="_blank" rel="noopener">Política de privacidade</a>.</span></label>
      <div class="form-error" id="signup-error" role="alert"></div>
      <button class="btn primary block" type="submit">Continuar</button>
    </form>`, { nav }));

  route('/login', () => view(html`
    <a class="link" href="#/welcome">${icon('back')} Voltar</a>
    <h1>Entrar</h1>
    <form data-form="login" novalidate>
      <label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" required>
      <label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" required>
      <div class="form-error" id="login-error" role="alert"></div>
      <button class="btn primary block" type="submit" style="margin-top:16px">Entrar</button>
    </form>
    <p class="center" style="margin-top:14px"><a class="link" href="#/forgot">Esqueci minha senha</a></p>`, { nav }));

  route('/forgot', () => view(html`
    <a class="link" href="#/login">${icon('back')} Voltar</a>
    <h1>Recuperar acesso</h1>
    <p class="muted">Informe seu e-mail. Se ele estiver cadastrado, enviaremos um código para criar uma nova senha.</p>
    <form data-form="forgot"><label for="email">E-mail</label><input id="email" name="email" type="email" required autocomplete="email"><button class="btn primary block" type="submit" style="margin-top:16px">Enviar código</button></form>
    <form data-form="reset" style="margin-top:28px"><h3>Já tenho o código</h3>
      <label for="token">Código</label><input id="token" name="token" required autocomplete="one-time-code">
      <label for="np">Nova senha</label><input id="np" name="password" type="password" minlength="8" required autocomplete="new-password">
      <button class="btn secondary block" type="submit" style="margin-top:16px">Criar nova senha</button></form>`, { nav }));

  route('/verify', () => view(html`
    ${art('verify-email', '', 'spot-art')}
    <h1>Confirme seu e-mail</h1>
    <p class="muted">Enviamos um código para ${store.get().me?.user?.email || 'seu e-mail'}. Digite-o abaixo para liberar a descoberta e as conversas.</p>
    <form data-form="verify"><label for="code">Código</label><input id="code" name="token" required autocomplete="one-time-code"><button class="btn primary block" type="submit" style="margin-top:16px">Confirmar</button></form>
    <div class="row-actions"><button class="btn ghost" data-act="resend">Reenviar código</button><button class="btn ghost" data-act="logout">Sair</button></div>`, { nav }));

  route('/suspended', () => view(html`
    ${art('suspended', '', 'spot-art')}
    <h1>Sua conta está restrita</h1>
    <p class="muted">Identificamos algo que pode ferir as regras da comunidade e restringimos o acesso enquanto revisamos. Se você acha que foi um engano, envie um recurso.</p>
    <form data-form="appeal"><label for="at">Seu recurso</label><textarea id="at" name="text" maxlength="1500" required placeholder="Conte o que aconteceu"></textarea><button class="btn primary block" type="submit" style="margin-top:16px">Enviar para revisão</button></form>
    <div class="row-actions"><button class="btn ghost" data-act="logout">Sair</button></div>`, { nav }));

  const enter = async (data) => {
    token.set(data.token); setMe(data);
    const me = store.get().me;
    if (me.user.status === 'pending_verification') return go('#/verify');
    go(me.settings.onboardingDone ? '#/discover' : '#/onboarding/1');
  };
  onForm({
    async signup(f, v) {
      const err = $('#signup-error'); err.textContent = '';
      v.acceptTerms = v.acceptTerms === 'on';
      if (v.birthDate) { const d = new Date(v.birthDate), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; if (a < 18) { err.textContent = 'O Elo é apenas para pessoas com 18 anos ou mais.'; return; } }
      try { await enter(await api('POST', '/auth/register', v, { noAuthRedirect: true })); } catch (e) { err.textContent = errMsg(e); }
    },
    async login(f, v) {
      const err = $('#login-error'); err.textContent = '';
      try { await enter(await api('POST', '/auth/login', v, { noAuthRedirect: true })); } catch (e) { err.textContent = errMsg(e); }
    },
    async forgot(f, v) { const r = await api('POST', '/auth/forgot', v, { noAuthRedirect: true }); toast(r.message, 6000); },
    async reset(f, v) { await api('POST', '/auth/reset', v, { noAuthRedirect: true }); toast('Senha alterada. Entre com a nova senha.'); go('#/login'); },
    async verify(f, v) { await api('POST', '/auth/verify', v); const me = await api('GET', '/me'); setMe(me); toast('E-mail confirmado!'); go(me.settings.onboardingDone ? '#/discover' : '#/onboarding/1'); },
    async appeal(f, v) { await api('POST', '/me/appeal', v); toast('Recurso enviado. Nossa equipe vai analisar.', 5000); },
  });
  on({
    async resend() { await api('POST', '/auth/resend-verification'); toast('Código reenviado.'); },
    async logout() { try { await api('POST', '/auth/logout', undefined, { noAuthRedirect: true }); } catch { /* sessão já inválida */ } token.set(null); store.set({ me: null, deck: [] }); applyTheme('system'); go('#/welcome'); },
    reload() { location.reload(); },
  });
}
