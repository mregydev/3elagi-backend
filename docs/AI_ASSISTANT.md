# AI Medical Assistant

Production medical AI assistant using **LangChain**, **Gemini**, **Socket.io**, **Redis** (optional), **pgvector**, and an extensible context-source architecture.

## Architecture

```
Client (Socket.io)
  → JWT authentication on connect
  → ai:message:send
  → Intent classification
  → Context registry (patient / records / doctors / general knowledge)
  → pgvector retrieval (when relevant)
  → Redis or in-memory cache
  → Gemini streaming (LangChain)
  → Persist ai_conversations + ai_messages
  → Stream tokens via Socket.io
```

### Extensible context sources

Add a new entity without changing core AI logic:

1. Create `src/ai/context/sources/appointments.context-source.ts` implementing `AIContextSource`
2. Register it in `AiContextRegistryService`

Each source implements:

- `canHandle(question, intent)`
- `fetchContext(user, question)`
- `buildContextText(data)`
- `getVersionKey(user)`

### Swappable LLM

Providers live in `src/ai/llm/`. Bind a different class to `LLM_PROVIDER` in `ai.module.ts`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `GEMINI_CHAT_MODEL` | No | Default `gemini-3-flash-preview` (Gemini 3 Flash) |
| `GEMINI_EMBEDDING_MODEL` | No | Default `gemini-embedding-001` |
| `REDIS_URL` | No | Redis for answer cache (falls back to in-memory) |
| `AI_CACHE_TTL_SECONDS` | No | Cache TTL (default `3600`) |
| `JWT_SECRET` | Yes | Used for Socket.io authentication |

## Socket.io (primary transport)

Authenticate on connect:

```javascript
io(SOCKET_URL, { auth: { token: accessToken } });
```

### Client events

| Event | Payload |
|-------|---------|
| `ai:chat:create` | `{ title?, patientUserId? }` |
| `ai:chat:join` | `{ chatId }` |
| `ai:message:send` | `{ message, chatId?, patientUserId? }` |
| `ai:chat:history` | _(none)_ |

### Server events

| Event | Payload |
|-------|---------|
| `ai:chat:created` | conversation object |
| `ai:chat:joined` | `{ chatId }` |
| `ai:message:ack` | `{ conversationId, userMessageId }` |
| `ai:message:token` | `{ content, chatId? }` |
| `ai:message:done` | `{ chatId, messageId, cacheHit? }` |
| `ai:message:error` | `{ error }` |
| `ai:chat:history` | `{ conversations: [...] }` |

### Rooms

- `patient:{patientId}` — joined automatically on connect
- `ai-chat:{chatId}` — joined when opening/sending in a chat

## HTTP (legacy)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ai/chat` | **Deprecated** — returns 410 |
| `GET` | `/ai/history` | List conversations (bootstrap fallback) |
| `DELETE` | `/ai/history/:id` | Delete conversation |

## Intents

- `patient_profile_question`
- `medical_record_question`
- `health_recommendation_question` — lifestyle tips, foods to avoid, habits (patient)
- `doctor_recommendation_question` — find a doctor (patient)
- `doctor_coaching_question` — practice feedback, reviews, workload (doctor)
- `doctor_profile_question` / `doctor_practice_question`
- `general_medical_question`
- `mixed_question`

## Context sources

| Source | Role | Purpose |
|--------|------|---------|
| `patient_profile` | Patient | Profile data |
| `patient_health_insights` | Patient | Pattern extraction from history for personalized advice |
| `medical_records` | Both | Diagnoses, labs, imaging |
| `doctors` | Patient | Doctor listings + reviews for recommendations |
| `doctor_profile` | Doctor | Own profile |
| `doctor_patients` | Doctor | Patient list + diagnoses added |
| `doctor_practice_insights` | Doctor | Ratings, workload, peer feedback themes |
| `general_knowledge` | Both | Health education guardrails |

## Behaviour (prompt v5)

- **Wise companion tone** — supportive friend for patients; trusted colleague for doctors.
- **Bilingual** — replies in Arabic or English matching the user's message.
- **Patient recommendations** — things to avoid, habits, healthy foods based on medical history patterns.
- **Doctor coaching** — patient volume, diagnosis frequency, review feedback, platform benchmarks.
- **Strict safety** — never diagnoses or prescribes; may suggest possibilities but doctor must confirm and write official records.

## Cache keys

```
ai:answer:{patientId}:{userRole}:{questionHash}:{contextVersion}:{promptVersion}
```

Set `REDIS_URL` in production so cache is shared across API instances. Falls back to in-memory when unset.

Cache is never shared between patients. Invalidated when knowledge indexer bumps version or patient data changes.

## Database tables

- `ai_conversations` — chat threads per user
- `ai_messages` — user/assistant messages
- `ai_knowledge_chunks` — RAG vectors
- `ai_usage_logs` — analytics

## Safety

- Patient-scoped context only
- No invented doctors, ratings, or diagnoses
- Urgent symptom detection with emergency guidance
- General medical answers include non-diagnosis disclaimer
