# Ponte — Documentação técnica e handoff para desenvolvedores

> App mobile de mensagens com tradução automática por IA entre **Português (Brasil)** e
> **Espanhol (Paraguai)**. Feito em **Expo / React Native** (app) + **FastAPI** (backend)
> + **MongoDB** (banco). Este documento explica o estado atual, a arquitetura e tudo que
> um dev precisa para continuar.

---

## 1. Visão geral do produto

- Dois usuários (um em PT 🇧🇷, outra em ES 🇵🇾) trocam mensagens.
- A IA traduz de forma **contextual e natural** (entende gírias e erros de digitação).
- Na conversa, a bolha mostra a **mensagem traduzida como principal** e o **texto original
  menor/discreto abaixo**.
- Recursos: cadastro por e-mail com @username único, busca por username, mensagens em
  tempo real, reações, responder, editar, apagar, e **mensagens de voz** (grava → transcreve
  → traduz → destinatário ouve a voz já no idioma dele).

### Estado atual (o que está pronto)
- Backend 100% funcional e testado (24/24 testes) — auth, usuários, conversas, mensagens,
  voz, mídia.
- App funcional em iOS/Android (Expo Go) e Web (react-native-web), tema claro/escuro.
- Tradução, transcrição (Whisper) e TTS validados com a chave OpenAI do usuário.

### Pendências conhecidas / não implementado
- **PWA instalável no iOS** (adicionar à tela de início como app standalone): SOLICITADO
  pelo usuário, **ainda NÃO implementado**. Ver seção 9.
- Recibos de leitura ("visto"), indicador de "digitando…", foto de perfil, notificações
  push (push só funciona em build nativo e a pedido).

---

## 2. Como a conexão entre os usuários funciona (importante)

Os celulares **não** se conectam diretamente entre si. Ambos falam com um **servidor
central** (o backend FastAPI) pela internet:

1. Celular A envia o texto para o backend.
2. O backend chama a OpenAI para traduzir para o idioma do destinatário e salva no MongoDB.
3. Celular B busca as mensagens do backend (polling) e mostra a versão traduzida.

Por isso funciona à distância (redes diferentes, países diferentes) — basta internet.
**Tempo real** é feito por *polling* com react-query (não há WebSocket):
- Mensagens da conversa aberta: refetch a cada **2500 ms**.
- Lista de conversas: refetch a cada **4000 ms**.

Para evoluir para tempo real "instantâneo", trocar polling por WebSocket/SSE no backend
e no cliente.

---

## 3. Arquitetura e stack

- **Frontend**: Expo SDK 57, React Native 0.86, expo-router (file-based routing),
  @tanstack/react-query (dados), react-native-keyboard-controller (teclado), expo-audio
  (gravação/reprodução), @gorhom/bottom-sheet, @react-native-vector-icons/ionicons.
- **Backend**: FastAPI, Motor (MongoDB async), GridFS (áudio), PyJWT + bcrypt (auth),
  emergentintegrations (wrapper OpenAI: chat, Whisper STT, TTS).
- **Banco**: MongoDB (coleções `users`, `conversations`, `messages` + GridFS `fs.files`/`fs.chunks`).

### Regras de ambiente (não quebrar)
- Rotas do backend SEMPRE com prefixo `/api` (o ingress redireciona `/api/*` → porta 8001).
- Backend faz bind em `0.0.0.0:8001`.
- Frontend chama a API via `process.env.EXPO_PUBLIC_BACKEND_URL` + `/api`.
- NÃO alterar `EXPO_PACKAGER_PROXY_URL`, `EXPO_PACKAGER_HOSTNAME`, `MONGO_URL`.
- Serviços rodam via supervisor: `backend` e `expo` (frontend). Reiniciar com
  `sudo supervisorctl restart backend|expo`. Logs em `/var/log/supervisor/`.

---

## 4. Variáveis de ambiente

`/app/backend/.env`:
- `MONGO_URL` — conexão local do MongoDB (não mexer).
- `DB_NAME` — `ponte_chat`.
- `OPENAI_API_KEY` — chave OpenAI do usuário (usada em tradução, Whisper e TTS).
- `JWT_SECRET` — segredo para assinar tokens JWT (HS256).
- `TRANSLATION_MODEL` — `gpt-5.6-terra` (modelo de tradução).

`/app/frontend/.env` (não mexer nas chaves de proxy/hostname):
- `EXPO_PUBLIC_BACKEND_URL` — URL pública do backend (preview ou produção).

> Observação: os segredos do preview são copiados para produção no primeiro deploy. Depois,
> preview e produção divergem; alterar segredos de produção pelo painel de Secrets.

---

## 5. Backend — modelo de dados e endpoints

### Coleções (documentos usam `id` = uuid string, nunca expõem `_id`)
- **users**: `{ id, email, username, display_name, language(pt|es), avatar_color,
  password_hash, created_at }`. Índices únicos em `email` e `username`.
- **conversations**: `{ id, participant_ids:[a,b], created_at, last_message_at,
  last_read:{ userId: isoTimestamp } }`.
- **messages**: `{ id, conversation_id, sender_id, type(text|voice), original_text,
  original_lang, translated_text, translated_lang, audio_media_id, tts_media_id, duration,
  reply_to(msgId|null), reactions:[{user_id,emoji}], edited, deleted, created_at, updated_at }`.
- **GridFS**: áudio original e áudio TTS (servidos por `/api/media/{id}`).

### Formatos públicos
- `user` = `{ id, username, display_name, language, avatar_color, email }`.
- `message` (serializado) = igual ao doc, com `reply_to` resolvido como
  `{ id, sender_id, preview }` (preview no idioma de quem visualiza) e datas em ISO.

### Endpoints (todos sob `/api`, auth via header `Authorization: Bearer <token>`)
Auth:
- `POST /auth/register` `{email,password,username,display_name,language}` → `{access_token,user}` (409 se email/username duplicado)
- `POST /auth/login` `{email,password}` → `{access_token,user}` (401 se inválido)
- `GET /auth/me` → `user`

Usuários:
- `GET /users/search?q=<prefixo>` → `[user]` (busca por prefixo de username, exclui o próprio)

Conversas:
- `POST /conversations` `{username}` → `{id}` (cria ou retorna existente; 404 se usuário não existe; 400 se for você mesmo)
- `GET /conversations` → `[{id, other_user, last_message, last_message_at, unread_count}]`
- `GET /conversations/{id}` → `{id, other_user}`
- `GET /conversations/{id}/messages` → `[message]` (ordem crescente; marca como lida)
- `POST /conversations/{id}/messages` `{text, reply_to?}` → `message` (traduz e salva)
- `POST /conversations/{id}/voice` multipart `{file, duration, reply_to?}` → `message`
  (Whisper transcreve no idioma do remetente → traduz → TTS no idioma do destinatário)

Mensagens:
- `PATCH /messages/{id}` `{text}` → `message` (só dono; re-traduz; só tipo texto)
- `DELETE /messages/{id}` → `{ok:true}` (só dono; **soft delete** `deleted=true`)
- `POST /messages/{id}/react` `{emoji}` → `message` (toggle: uma reação por usuário)

Mídia:
- `GET /media/{media_id}` → binário do áudio (GridFS)

### Regra de tradução
- `source` = idioma do remetente; `target` = idioma do outro participante.
- Se `source == target`, não traduz.
- Direção da bolha no app: se a mensagem é minha → principal = original, secundária =
  traduzida; se é do outro → principal = traduzida, secundária = original.

### IA (via emergentintegrations, biblioteca interna já instalada)
- Tradução: `LlmChat(...).with_model("openai","gpt-5.6-terra")`, `send_message`.
- STT: `OpenAISpeechToText.transcribe(file, model="whisper-1", language=...)`.
- TTS: `OpenAITextToSpeech.generate_speech(text, model="tts-1", voice=...)`; vozes:
  PT→`onyx`, ES→`nova`; formato mp3. (TTS tem sotaque "inglês" em outros idiomas — limite
  do provedor; para voz nativa premium usar ElevenLabs.)

---

## 6. Frontend — estrutura e telas

Roteamento (expo-router, grupos `(auth)` e `(app)`):
- `app/_layout.tsx` — providers (GestureHandler, SafeArea, KeyboardProvider, ReactQuery,
  AuthProvider, BottomSheetModal, ErrorBoundary), carrega a fonte Ionicons via expo-font,
  e o `RootNavigator` faz o *gate* de auth (redireciona logado → `(app)/chats`, deslogado
  → `(auth)/welcome`).
- `app/index.tsx` — splash enquanto a auth inicializa.
- `app/(auth)/welcome.tsx` `login.tsx` `register.tsx` — onboarding e autenticação.
- `app/(app)/chats.tsx` — lista de conversas (inbox) + FAB "nova conversa".
- `app/(app)/search.tsx` — busca por @username e inicia conversa.
- `app/(app)/conversation/[id].tsx` — tela principal (hero) da conversa.
- `app/(app)/profile.tsx` — perfil + logout.

Código de apoio (`src/`):
- `src/api/client.ts` — cliente HTTP (fetch), tipos e todas as funções da API; guarda o
  token; `mediaUrl(id)` para áudio.
- `src/context/auth.tsx` — `AuthProvider`, `useAuth`, `useProtectedRoute` (gate).
- `src/audio.ts` — player único (module-level) para tocar um áudio por vez.
- `src/lib/format.ts` — formatação de horários/duração e iniciais do avatar (dayjs pt-br).
- `src/theme.ts` — tokens de cor **claro + escuro** (segue o sistema), `makeStyles()` e
  `useTheme()`. Cor de marca: azul da bandeira `#0038A8` + âmbar `#F5A623`.
- `src/components/`: `Avatar.tsx`, `Field.tsx`, `MessageBubble.tsx` (bolha dual-text, voz,
  reações, reply), `MessageActions.tsx` (menu de long-press).

Estado/dados:
- react-query em tudo; após mutações, `invalidateQueries(["messages", id])` e
  `["conversations"]`.
- Token salvo em `@/src/utils/storage` (secure* → SecureStore no native, AsyncStorage/IndexedDB
  na web), chave `ponte_token`.

Permissões:
- Microfone pedido de forma contextual ao tocar no botão de gravar; se negado, mostra
  botão "Abrir ajustes" (`Linking.openSettings()`). Descrições em `app.json`
  (`ios.infoPlist.NSMicrophoneUsageDescription`, `android.permissions: ["RECORD_AUDIO"]`).

---

## 7. Como rodar e testar (ambiente atual)

- Serviços já rodam via supervisor. Backend em `:8001` (interno), exposto via `/api`.
  Frontend (Metro) em `:3000`, exposto na URL de preview.
- API externa para testes: `EXPO_PUBLIC_BACKEND_URL` + `/api` (curl funciona).
- Testar no celular: abrir **Expo Go** e escanear o QR do painel de preview.
- Recursos nativos (gravar/ouvir áudio, microfone) só funcionam 100% em aparelho real /
  build — não no preview do navegador.

### Usuários de teste (já existem no banco de preview)
- Brasileiro: `bruno@test.com` / `senha123` (username `bruno`, idioma pt)
- Paraguaia: `lucia@test.com` / `senha123` (username `lucia`, idioma es)
(Também documentado em `/app/memory/test_credentials.md`.)

---

## 8. Deploy, builds e "loja" (preview × produção)

- O ambiente atual é **preview/desenvolvimento** — diferente da produção.
- Para publicar: botão **Publish** (canto superior direito) → **Deploy**. No primeiro deploy,
  o banco e os segredos do preview vão para produção; depois eles divergem.
- Depois do deploy, gerar **builds iOS e Android** pelo mesmo fluxo (fornecendo as credenciais
  pedidas). Só então recursos dependentes de build funcionam plenamente.
- Publicar nas lojas (App Store / Play Store) e gerar APK/IPA é feito por esse fluxo da
  plataforma — **não** usar EAS CLI/externo, nem editar `eas.json` (gerenciado pela plataforma).
- Banco de produção: visualizar pelo **MongoDB Viewer** no painel de Publish. Diferenças
  entre dados de preview e produção são esperadas.

---

## 9. Próximo passo pedido: versão Web/PWA instalável no iOS (NÃO implementado ainda)

O usuário pediu uma versão web que o iOS possa "salvar na área de trabalho" (Adicionar à
Tela de Início) como app, sem precisar de modo desenvolvedor. Situação:

- O app **já roda na web** (react-native-web); o preview é a própria versão web.
- Falta transformá-lo em **PWA instalável** para abrir em tela cheia (standalone) no iOS.
  Escopo pequeno e barato, envolvendo apenas configuração web (sem lógica nova):
  1. Adicionar metatags PWA em `app/+html.tsx`: `apple-mobile-web-app-capable`,
     `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`,
     `apple-touch-icon`, `theme-color`, `viewport` com `viewport-fit=cover`, `manifest`.
  2. Adicionar `public/manifest.json` (name, icons 192/512, `display: standalone`,
     theme/background color) e ícones em `public/` (Expo serve a pasta `public/` na raiz web).
  3. Ajustar `app.json` → bloco `web` (name/description/themeColor).
- Depois de implementado, o uso "real e instalável" ainda depende de **deploy** (a URL de
  produção é o que o usuário abre no Safari e faz "Adicionar à Tela de Início").
- Limitação: gravação de áudio via web no iOS/Safari tem restrições; o chat de texto +
  tradução funciona normalmente no PWA.

---

## 10. Backlog sugerido (prioridade)
- P1: recibos de leitura (enviado/entregue/visto) e indicador de "digitando…".
- P1: PWA instalável (seção 9).
- P2: foto de perfil (upload via Object Storage), status online.
- P2: busca dentro da conversa; fixar mensagens; waveform de voz animado.
- P3 (a pedido): notificações push (só em build nativo; requer google-services.json).

---

## 11. Enviar para o GitHub
Conforme o suporte da plataforma: conectar a conta do GitHub no perfil, depois usar o botão
**Save to GitHub** na interface do chat → escolher/criar a branch → **PUSH TO GITHUB**.
Não há criação automática de repositório novo documentada. Salvar no GitHub exige plano pago;
em falha de permissão, reconectar o GitHub ou contatar o suporte.

> Observação: esta documentação foi escrita em `/app/plan/plan.md` (única pasta gravável no
> modo de planejamento). Para que ela apareça como `README.md` no repositório do GitHub,
> basta sair do modo de planejamento e solicitar que eu a copie para `/app/README.md` antes
> do push.
