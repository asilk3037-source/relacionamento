# Elo — Arte necessária e prompts para gerar em uma IA de imagem

Este documento lista **toda a arte que o aplicativo precisa**, com o nome exato do arquivo, tamanho, onde aparece e um **prompt pronto** para colar em uma IA de imagens (Midjourney, DALL·E / ChatGPT, Imagen, Firefly, Ideogram, Flux, etc.).

> **Como usar**
> 1. Copie o **Bloco de estilo global** (abaixo) e cole **antes de cada prompt** (ou salve-o como "estilo fixo" na sua ferramenta). Isso mantém o conjunto coerente.
> 2. Gere a imagem, escolha a melhor, exporte no formato indicado e **salve com o nome exato** indicado.
> 3. Coloque o arquivo em `public/assets/art/` (ilustrações), `public/assets/art/demo/` (retratos demo) ou nas pastas indicadas em cada seção.
> 4. **Não é preciso mexer em código**: o app já usa um placeholder `.svg` e passa a usar automaticamente `<nome>.webp` (preferido), `.png` ou `.jpg` assim que o arquivo existir. Reinicie o servidor (`npm start`) para atualizar `/art-manifest.json`.
> 5. Para o app Android, depois de adicionar as imagens finais rode `npx cap sync android` (veja `docs/ANDROID.md`) para copiá-las para o projeto nativo.

**Regras de ouro (valem para tudo)**
- **Pessoas sempre adultas** (27–40 anos), diversas (etnia, corpo, gênero, idade), **fictícias** — nunca parecidas com pessoas reais ou famosas. Em perfis de demonstração o app já mostra a etiqueta "Perfil de demonstração"; **não** use essas imagens como se fossem usuários reais.
- **Sem texto dentro das imagens** (a IA erra acentos; o app escreve os textos). Exceções estão marcadas.
- **Sem logotipos de terceiros, sem telas de celular, sem marcas d'água.**
- Estética: **elegante, acolhedora, contemporânea, brasileira, inclusiva — "não infantil"**. Nada de corações clichê, casais abraçados em pôr do sol ou erotização.
- Todas as artes de **cena/ponto de interesse** devem funcionar em **modo claro (branco + azul)** e **modo escuro (grafite + laranja)** — por isso pedimos **fundo transparente** nas ilustrações pontuais e cores de acento azul `#2865EB` e laranja `#FF672E`.

---

## 0. Bloco de estilo global (cole antes de cada prompt)

```
Brand style for "Elo", a Brazilian dating app for adults: modern editorial illustration with soft
semi-flat shapes and subtle paper/clay texture, generous negative space, gentle rounded forms.
Palette: electric blue #2865EB, warm orange #FF672E, deep navy #182334, soft ice-blue #DCE7FF,
warm cream #FFE3D6, white. The recurring motif is "elo" (link): two interlocking rounded loops and
soft curved dotted paths that connect people. Mood: warm, welcoming, respectful, confident,
contemporary Brazilian city life. Inclusive and diverse adults aged 27–40 only. Premium, restrained,
not childish, not cartoonish, no clichés (no big hearts, no cupids). No text, no letters, no logos,
no phone screens, no watermark.
```

**Negative prompt (para ferramentas que aceitam):** `text, letters, watermark, logo, minors, children, nudity, lingerie, clichéd hearts, cupid, stock-photo look, distorted hands, extra fingers, uncanny face, cluttered background`

**Exportação:** ilustrações pontuais → PNG/WebP **com fundo transparente** (ou use "remove background" depois). Cenas largas → WebP 1600 px de largura. Mantenha cada arquivo **< 400 KB** (use squoosh.app para comprimir).

---

## 1. Identidade e ícone do app

| Arquivo | Tamanho | Onde aparece |
|---|---|---|
| `public/assets/icons/icon.svg` + `icon-192.png`, `icon-512.png` | vetor / 192 / 512 | Ícone PWA, aba do navegador |
| `public/assets/icons/icon-maskable-512.png` | 512×512 (conteúdo no centro 66%) | Ícone adaptativo Android |
| `resources/icon.png` | 1024×1024 | Ícone de loja / Android (Capacitor Assets) |
| `resources/icon-foreground.png` | 1024×1024, transparente | Primeiro plano do ícone adaptativo |
| `resources/icon-background.png` | 1024×1024 | Fundo do ícone adaptativo (azul liso ou gradiente sutil) |
| `resources/splash.png` | 2732×2732 | Tela de abertura (claro) |
| `resources/splash-dark.png` | 2732×2732 | Tela de abertura (escuro) |
| `public/assets/icons/notification.png` | 96×96, **branco sobre transparente** | Ícone pequeno de notificação push (Android exige monocromático) |

> **O símbolo do Elo já existe** (dois anéis arredondados entrelaçados — veja `public/assets/elo-simbolo.svg` e o ícone atual). Se quiser explorar uma versão mais refinada, use o prompt 1.1; senão, apenas use o ícone gerado em `icon.svg`.

**1.1 Símbolo / ícone do app (exploração)**
```
[ESTILO GLOBAL]
App icon for "Elo": two thick rounded-rectangle loops interlocking diagonally, one tilted left and one
tilted right, forming a refined chain link / infinity-like mark. White loops on a solid electric blue
#2865EB rounded-square background, with a very subtle inner shadow and a tiny orange #FF672E accent
where the loops overlap. Perfectly centered, high contrast, flat vector look, simple enough to read at
48px, no text, 1024x1024.
```

**1.2 Primeiro plano do ícone adaptativo** (`icon-foreground.png`)
```
[ESTILO GLOBAL]
Only the interlocking double-loop mark, in white, centered, occupying about 55% of the canvas width,
on a fully transparent background, flat vector look, crisp edges, 1024x1024. No background, no shadow.
```

**1.3 Fundo do ícone adaptativo** (`icon-background.png`)
```
Smooth subtle gradient from #2865EB (top-left) to #1B4FC4 (bottom-right), no shapes, no texture,
1024x1024, perfectly flat and clean.
```

**1.4 Tela de abertura (claro)** (`splash.png`)
```
[ESTILO GLOBAL]
Splash screen artwork: a soft ice-blue to white vertical gradient background (#EAF1FF to #FFFFFF); in
the center the blue #2865EB double-loop "elo" mark at 28% of canvas width; two faint curved dotted
paths (blue and orange) drifting across the lower third. Generous empty space, calm, premium.
Square 2732x2732, keep all important content inside the central 1200x1200 safe area. No text.
```

**1.5 Tela de abertura (escuro)** (`splash-dark.png`)
```
[ESTILO GLOBAL]
Same composition as the light splash but dark mode: graphite background #191A1D with a very subtle
vertical gradient to #232428; the double-loop mark in warm orange #FF672E; faint dotted curved paths in
orange and soft off-white. Square 2732x2732, important content within the central 1200x1200. No text.
```

**1.6 Ícone de notificação** (`notification.png`)
```
Single-color white silhouette of the interlocking double-loop "elo" mark, bold simple shapes, fully
transparent background, 96x96, no gradients, no shadow.
```

---

## 2. Ilustrações do app (as 24 artes que o código já referencia)

Todas são exibidas via `art('<nome>')`. Salve como `public/assets/art/<nome>.webp`.
Formato **quadrado 1:1** (1024×1024) com **fundo transparente**, exceto as duas marcadas como **largas 4:3 (1600×1200)**, que podem ter fundo próprio (cantos arredondados são aplicados pelo app).

### 2.1 Entrada e cadastro

**`welcome-hero`** — *largo 4:3, tela inicial.*
```
[ESTILO GLOBAL]
Wide editorial scene in a welcoming contemporary Brazilian city plaza at golden-hour: four clearly
adult, diverse, stylish people aged 27–35 (two women, two men; varied skin tones, one with natural
curly hair, one with a short beard), candid warm smiles, standing near a small coffee kiosk with a
mix of casual-smart outfits in blue, orange, navy and cream. Abstract curved dotted paths in blue and
orange float softly across the ground and between them, subtly connecting the group, like threads
linking people. Soft textured semi-flat clay-editorial style, depth of field, lots of breathing room
at the top for an overlay. Palette cream/ice-blue background. No text, no phones, no logos. 4:3
landscape.
```

**`age-gate`** — *quadrado, cadastro (maioridade).*
```
[ESTILO GLOBAL]
Spot illustration: the interlocking double-loop mark in blue and orange resting on a small circular
badge-like shape, with a tiny subtle "adult-only" feel conveyed by a thin shield outline (no numbers,
no text). Calm, trustworthy, transparent background, centered, square.
```

**`verify-email`** — *quadrado, confirmação de e-mail.*
```
[ESTILO GLOBAL]
Spot illustration: an open white envelope with a soft blue interior, a small orange check-mark seal
floating above it, and a short curved dotted path leading into the envelope. Transparent background,
centered, square.
```

**`suspended`** — *quadrado, conta restrita (tom sério, não assustador).*
```
[ESTILO GLOBAL]
Spot illustration: a rounded blue shield with a soft exclamation-like vertical mark in orange, calm and
respectful tone (not alarming, no red, no skulls, no warning-triangle clichés), a small gentle
magnifying glass beside it suggesting "under review". Transparent background, centered, square.
```

### 2.2 Onboarding

**`onb-profile`** — *quadrado.*
```
[ESTILO GLOBAL]
Spot illustration: one adult person (about 30, gender-ambiguous, warm brown skin, stylish casual
outfit in blue) in a friendly three-quarter bust view holding a small floating frame/card that
suggests a profile, with tiny orange sparkle accents. Transparent background, centered, square.
```

**`onb-interests`** — *quadrado.*
```
[ESTILO GLOBAL]
Spot illustration: five soft overlapping circular "bubbles" in blue, orange, navy, ice-blue and cream,
each containing a very simple line icon (coffee cup, music note, hiking boot, camera, book) —
icons only, no letters — clustered playfully around a small double-loop mark. Transparent
background, centered, square.
```

**`onb-prefs`** — *quadrado.*
```
[ESTILO GLOBAL]
Spot illustration: three horizontal slider tracks with round blue and orange knobs at different
positions, one small map pin and one small person silhouette sitting on the sliders, suggesting
"choose who you want to meet". Transparent background, centered, square.
```

**`onb-location`** — *quadrado.*
```
[ESTILO GLOBAL]
Spot illustration: a large soft rounded location pin in blue with a white circle in the center,
standing on an abstract rolling ground with a curved dotted orange path below, small stylized buildings
as simple rounded shapes behind. NO real map, NO street names. Transparent background, centered,
square.
```

### 2.3 Descobrir

**`empty-discover`** — *"você viu todo mundo".*
```
[ESTILO GLOBAL]
Spot illustration: a calm scene of a double-loop mark floating above a small stack of soft rounded
profile cards, with a curved dotted orange path leading off into the distance and a tiny crescent moon
and sun suggesting "come back later". Transparent background, centered, square.
```

**`empty-paused`** — *descoberta pausada.*
```
[ESTILO GLOBAL]
Spot illustration: two thick rounded "pause" bars (one blue, one orange) with a soft cushion-like
shadow, plus a tiny sleeping-moon accent and a faint dotted path resting beside them. Transparent
background, centered, square.
```

**`empty-profile`** — *perfil incompleto.*
```
[ESTILO GLOBAL]
Spot illustration: a half-finished profile card with a soft person silhouette outline in dashed blue
lines, a small orange pencil adding the last details, and two floating tag chips (no text). Transparent
background, centered, square.
```

**`match`** — *celebração de match.*
```
[ESTILO GLOBAL]
Spot illustration, celebratory but elegant: two interlocking rounded loops (one blue, one orange)
joined at the center with a small burst of confetti dots and tiny sparkles radiating, no hearts, no
people. Joyful and premium. Transparent background, centered, square.
```

**`limit`** — *limite diário de curtidas.*
```
[ESTILO GLOBAL]
Spot illustration: a circular progress ring almost closed in blue on an ice-blue track, a small orange
hourglass/clock hand at the center, a tiny crescent moon at the ring's end to hint "renews at
midnight". Calm, not punitive. Transparent background, centered, square.
```

**`no-photo`** — *marcador quando não há foto.*
```
Minimal neutral placeholder: soft ice-blue circle head and rounded shoulders silhouette in a slightly
darker blue, gentle gradient, no face details, transparent background, centered, square.
```

### 2.4 Matches, curtidas e conversas

**`empty-matches`**
```
[ESTILO GLOBAL]
Spot illustration: two empty rounded speech-bubble-like cards, one blue and one orange, slightly
overlapping like the beginning of a connection, with a thin dotted orange path between them and a few
tiny sparkles. Transparent background, centered, square.
```

**`likes-locked`** — *"Quem curtiu você" bloqueado (Free).*
```
[ESTILO GLOBAL]
Spot illustration: a softly blurred stack of three rounded profile-photo frames (blurred abstract
color blobs, no faces) behind a small elegant padlock in blue with an orange keyhole, signaling
"discover who liked you with Plus". Premium and tasteful, not manipulative. Transparent background,
centered, square.
```

**`empty-likes`**
```
[ESTILO GLOBAL]
Spot illustration: an open mailbox-like rounded shape in blue with a single small orange heart-shaped
leaf (very abstract) floating above, waiting; gentle and optimistic. Transparent background, centered,
square.
```

**`empty-chat`**
```
[ESTILO GLOBAL]
Spot illustration: a blue and an orange speech bubble facing each other with three small typing dots
in one of them and a tiny coffee cup between them (hinting "bora tomar um café?"). Transparent
background, centered, square.
```

### 2.5 Caminhos cruzados

**`paths-art`** — *largo 4:3, cabeçalho da tela de Caminhos. ATENÇÃO: não é um mapa real.*
```
[ESTILO GLOBAL]
Wide abstract editorial illustration of "crossing paths": two long curved dotted paths, one blue and
one orange, flowing across a soft cream-to-ice-blue background and crossing at a single glowing
navy point with a white center. Two tiny stylized adult figures at opposite ends of the paths (small,
anonymous, seen from a distance, no faces). Absolutely NOT a real map: no streets, no labels, no
GPS-style pins. Dreamy, calm, privacy-respecting. No text. 4:3 landscape.
```

**`empty-paths`**
```
[ESTILO GLOBAL]
Spot illustration: two thin dotted curved paths (blue and orange) drifting almost parallel and about to
meet, with a small navy dot at the potential crossing point and a faint clock-like arc suggesting
"takes time". Transparent background, centered, square.
```

### 2.6 Planos e popularidade

**`plans-hero`**
```
[ESTILO GLOBAL]
Spot illustration: a large four-point sparkle star in blue, a smaller orange sparkle, a white
double-loop mark inside the big star, subtle glow and fine confetti dots. Premium, aspirational but not
flashy, no crowns, no money. Transparent background, centered, square.
```

**`popularity`**
```
[ESTILO GLOBAL]
Spot illustration: four rounded vertical bars of different heights in blue, orange and ice-blue
standing on a thin navy baseline, with a tiny eye-shaped icon and a tiny heart-shaped leaf floating
above the bars to hint "visits and likes". Calm analytics feel, NOT a ranking podium, no trophies,
no stars. Transparent background, centered, square.
```

### 2.7 Segurança e erros

**`safety`**
```
[ESTILO GLOBAL]
Spot illustration: a large rounded blue shield with a white check mark, a small orange coffee cup and a
tiny location pin next to it (hinting "meet in public places"), reassuring and warm. Transparent
background, centered, square.
```

**`error`**
```
[ESTILO GLOBAL]
Spot illustration: a friendly white circle outlined in blue with a soft orange exclamation mark,
two small disconnected curved dotted path fragments around it suggesting a lost connection. Gentle
tone, not alarming. Transparent background, centered, square.
```

---

## 3. Retratos de perfis de demonstração (opcional, só desenvolvimento/vídeos de apresentação)

Usados **apenas** pelo `npm run seed` e sempre exibidos com a etiqueta "Perfil de demonstração". Salve como `public/assets/art/demo/demo-1.webp` … `demo-10.webp` (**3:4 vertical, 1200×1600**). A ordem corresponde a: 1 Marina, 2 Rafael, 3 Júlia, 4 Lucas, 5 Bia, 6 Théo, 7 Alê, 8 Camila, 9 Pedro, 10 Larissa.

> ⚠️ **Obrigatório:** pessoas **adultas e fictícias**, claramente 27–38 anos, nada sexualizado, sem celebridades. Se usar a ferramenta para "variações" do mesmo rosto, verifique que não se pareçam com ninguém real.

**Prompt-base de retrato** (troque o trecho entre colchetes por cada pessoa)
```
[ESTILO GLOBAL — but photographic-editorial instead of illustration]
Natural, flattering portrait photograph of a fictional adult [PESSOA], upper body, soft natural daylight,
shallow depth of field with a softly blurred Brazilian city background (cafe, plaza or street), warm
genuine smile, looking slightly off-camera or at the camera, casual-smart outfit, clean skin texture,
realistic hands if visible, 3:4 vertical, no text, no logos, no watermark, not a celebrity.
```

| # | [PESSOA] |
|---|---|
| 1 | woman, 28, warm brown skin, dark wavy shoulder-length hair, navy blue knit top, relaxed smile, café terrace |
| 2 | man, 31, deep brown skin, short hair and light stubble, denim jacket over white tee, trail/park background |
| 3 | woman, 26, light olive skin, auburn hair in a loose bun, round glasses, cardigan, bookstore background |
| 4 | man, 29, tan skin, dark short hair, camera strap on shoulder, street-market background |
| 5 | woman, 33, dark brown skin, natural curly hair, athletic jacket in orange, riverside running path |
| 6 | man, 35, light skin, brown wavy hair, trimmed beard, chef-style apron over shirt, bright kitchen |
| 7 | non-binary person, 30, androgynous style, short dark hair, loose blazer, theatre foyer background |
| 8 | woman, 27, light brown skin, long dark hair, linen shirt, beach promenade, sunny |
| 9 | man, 32, medium brown skin, short curly hair, football jersey under open shirt, lively bar terrace |
| 10 | woman, 29, fair skin, honey-blonde bob, vintage film camera in hand, thrift-shop background |

---

## 4. Loja Google Play (publicação)

Salve em `store/` (pasta fora do app).

| Arquivo | Tamanho | Observações |
|---|---|---|
| `store/play-icon-512.png` | 512×512 PNG, 32-bit | Use o ícone 1.1 (sem cantos arredondados — a loja arredonda) |
| `store/feature-graphic.png` | **1024×500** PNG/JPG | Imagem de destaque; sem texto pequeno |
| `store/screenshot-01..08.png` | 1080×1920 (9:16) | Capturas reais do app com moldura/legenda (prompts abaixo para o fundo) |

**4.1 Feature graphic**
```
[ESTILO GLOBAL]
Wide banner 1024x500: on the left a large clean area (reserve for the app name overlay), on the right a
group of three diverse adults aged 28–34 laughing together at a café table seen from a friendly
three-quarter angle, with flowing blue and orange dotted paths linking them and extending leftwards
into the empty area. Soft ice-blue to cream gradient background, premium editorial finish. No text,
no phones, no logos.
```

**4.2 Fundo para capturas de tela** (aplique as capturas reais do app por cima, no Figma/Canva)
```
[ESTILO GLOBAL]
Portrait background 1080x1920 for app-store screenshots: clean soft gradient from ice-blue #EAF1FF at
the top to cream #FFE9DF at the bottom, large faint curved dotted paths in blue and orange sweeping
diagonally behind, a lot of empty space in the center for a phone mockup, a small empty band at the top
for a caption. No text, no people, no phone.
```

Sugestões de legenda para cada captura (escreva você mesmo no Figma/Canva, **não** peça para a IA):
1. "Conexões que fazem sentido" (Descobrir) · 2. "Você escolhe quem vê o quê" (perfil/privacidade) · 3. "Match e conversa grátis" (chat) · 4. "Caminhos cruzados, só se você quiser" · 5. "Bloquear e denunciar em um toque" · 6. "Elo Plus e Premium: mais controle" · 7. "Modo claro e escuro" · 8. "Para maiores de 18 anos".

---

## 5. Checklist de entrega da arte

- [ ] Ícone adaptativo (`icon-foreground`, `icon-background`) e `icon-maskable-512.png`
- [ ] `splash.png` e `splash-dark.png`
- [ ] `notification.png` (branco, transparente)
- [ ] 2 artes largas: `welcome-hero`, `paths-art`
- [ ] 22 ilustrações quadradas (lista na seção 2) com fundo transparente
- [ ] (Opcional) 10 retratos demo
- [ ] Loja: ícone 512, feature graphic, 8 capturas
- [ ] Revisão: nenhum menor, nenhum texto com erro, nenhuma semelhança com pessoa real, tudo legível nos dois temas

**Mapa rápido: nome do arquivo → onde aparece**

| Arquivo | Tela |
|---|---|
| welcome-hero | Boas-vindas |
| age-gate | Cadastro |
| verify-email | Confirmar e-mail |
| suspended | Conta restrita / recurso |
| onb-profile / onb-interests / onb-prefs / onb-location | Onboarding (etapas 1, 3, 4, 5) |
| empty-discover / empty-paused / empty-profile | Descobrir (sem perfis / pausada / incompleto) |
| match | Pop-up "Um novo elo!" |
| limit | Limite diário atingido |
| no-photo | Cartão sem foto |
| empty-matches / likes-locked / empty-likes | Matches e "Quem curtiu você" |
| empty-chat | Conversas vazias |
| paths-art / empty-paths | Caminhos |
| plans-hero | Upsell de planos |
| popularity | Minha popularidade |
| safety | Ajuda e segurança |
| error | Falha ao carregar |
