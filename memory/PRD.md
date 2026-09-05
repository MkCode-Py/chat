# PRD — Ponte (bilingual AI chat)

## Original problem statement
App mobile de mensagens com tradução automática por IA entre português e espanhol, para dois usuários fixos (um brasileiro, uma paraguaia). Diferencial: tradução contextual natural; na conversa a mensagem traduzida é a principal e o texto original fica menor/discreto abaixo. Recursos: mensagens em tempo real, reações, resposta a mensagem, editar/apagar, identificação clara do remetente, cadastro por e-mail com @username único, busca/adição por username, mensagens de voz enviadas já traduzidas no idioma do destinatário. Interface moderna estilo WhatsApp/Telegram.

## User choices
- IA: chave própria OpenAI do usuário; modelo de tradução `gpt-5.6-terra`; Whisper (`whisper-1`) para voz; TTS (`tts-1`).
- Auth: e-mail + senha (JWT) com @username único.
- Tempo real: polling (react-query).
- Tema: azul das bandeiras (#0038A8) + âmbar; claro e escuro.
- Voz: gravar -> transcrever -> traduzir -> ouvir no idioma do destinatário.

## Architecture
- Backend: FastAPI + MongoDB (motor). Áudio em GridFS servido por /api/media/{id}. Tradução/STT/TTS via emergentintegrations com OPENAI_API_KEY.
- Frontend: Expo Router (grupos (auth)/(app)), react-query (polling), react-native-keyboard-controller, expo-audio, @gorhom/bottom-sheet, Ionicons.
- Auth: JWT HS256 (30 dias), bcrypt. Token em SecureStore.

## Personas
- Bruno (brasileiro, pt 🇧🇷). Lucía (paraguaia, es 🇵🇾).

## Core requirements (static)
- Cadastro/login por e-mail + @username único.
- Busca por username e iniciar conversa.
- Conversa em tempo real com bolha dual-text (traduzida primária, original secundária).
- Reações, responder, editar, apagar.
- Mensagens de voz traduzidas (transcrição + TTS no idioma destino).

## Implemented (2026-06)
- [x] Backend completo: auth, users/search, conversations, messages (send/edit/delete/react), voice (whisper+translate+tts), media GridFS. (2026-06)
- [x] Tradução contextual pt<->es natural (voseo rioplatense) com gpt-5.6-terra. (2026-06)
- [x] Telas: Welcome, Registro (com idioma), Login, Chats (inbox + FAB), Busca, Conversa (hero), Perfil. (2026-06)
- [x] Bolha dual-text, reações, reply, editar, apagar, gravação de voz + player. (2026-06)
- [x] Tema claro/escuro, ícones Ionicons via expo-font, teclado com keyboard-controller. (2026-06)
- [x] Testado: 24/24 backend + e2e frontend, sem bugs. (2026-06)

## Backlog (prioritized)
- P1: Indicador "digitando…" e recibos de leitura (visto/entregue).
- P1: Reprodução de voz com waveform animado real e velocidade.
- P2: Foto de perfil (upload via Object Storage) e status online.
- P2: Busca dentro da conversa; fixar mensagens.
- P2: Notificações push (requer deploy + build nativo).

## Next tasks
- Recibos de leitura + typing indicator (via polling).
- Avatares com foto (Object Storage).
