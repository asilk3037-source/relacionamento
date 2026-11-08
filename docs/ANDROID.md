# Elo para Android (Capacitor)

O app do cliente (`public/`) é uma aplicação web instalável (PWA) que também pode ser empacotada como **app Android nativo** com o [Capacitor](https://capacitorjs.com). A API (`server/`) roda separada, em um servidor seu.

> Este ambiente não tem Android SDK; os passos abaixo devem ser executados na sua máquina (ou CI) com **Node 22+**, **JDK 17** e **Android Studio**.

## 1. Aponte o app para a sua API
Edite `public/config.js`:
```js
window.ELO_API_BASE = 'https://api.seudominio.com.br';
```
No servidor, libere a origem do WebView (CORS):
```
CORS_ORIGINS=https://localhost,capacitor://localhost
```

## 2. Crie o projeto Android
```bash
npm i -D @capacitor/core @capacitor/cli @capacitor/android @capacitor/assets
npx cap add android
npx cap sync android
```
`capacitor.config.json` já está pronto (`appId: br.app.elo`, `webDir: public`). **Troque o `appId`** pelo seu pacote definitivo antes de publicar.

## 3. Ícone e splash (arte gerada por IA)
Coloque em `resources/` os arquivos descritos em `docs/ARTE-PROMPTS.md` (seção 1) e rode:
```bash
npx capacitor-assets generate --android
```

## 4. Permissões (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```
**Não** declare `ACCESS_BACKGROUND_LOCATION`: os Caminhos, por decisão do documento, coletam só em primeiro plano nesta fase.
A permissão de localização é pedida no contexto de uso (ao tocar "Definir minha região" ou ao ativar os Caminhos); se negada, o app oferece escolher a cidade.

## 5. Cobrança (Google Play Billing)
O servidor já tem o modelo de assinatura, o endpoint `POST /api/plans/google/verify` e o webhook `POST /api/webhooks/google-play`. Falta:
1. Instalar um plugin de compras in-app (ex.: `cordova-plugin-purchase` ou RevenueCat) no app.
2. Criar no Play Console os produtos de assinatura `elo_plus_month`, `elo_plus_year`, `elo_premium_month`, `elo_premium_year`.
3. Implementar `ctx.googleVerifier.verify({ productId, purchaseToken })` em `server/` usando a **Google Play Developer API** (`purchases.subscriptionsv2.get`) e configurar `GOOGLE_PLAY_PACKAGE` e `GOOGLE_PLAY_WEBHOOK_SECRET` (RTDN via Pub/Sub → seu endpoint).
4. Testar em faixa de teste interno com contas de licença.
O estado da compra (pendente, ativa, renovação cancelada, tolerância, expirada, reembolsada, revogada) já é tratado; **compra pendente não libera benefício**.

## 6. Notificações push
Hoje as notificações ficam in-app (`/api/notifications`). Para push nativo: Firebase Cloud Messaging + `@capacitor/push-notifications`, registrando o token por dispositivo e enviando a partir de `ctx.notify` (respeitando as preferências do usuário e **sem nome/foto/identificador do remetente nas curtidas do plano Free**).

## 7. Publicação
Gere o AAB (`Build > Generate Signed Bundle`), preencha a classificação etária (18+), a declaração de segurança de dados, a política de privacidade (`/legal.html` é só um rascunho) e o canal de suporte. Veja a seção 8 de `DOCUMENTACAO` ("Revisão de lançamento").
