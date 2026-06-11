# AI Medical Assistant

Standalone AI module for the 3elagi platform using LangChain, Gemini, Supabase pgvector, and Redis caching.

## Architecture

```
User question
  → Auth + rate limit
  → Redis cache lookup (response / retrieval)
  → Question embedding (LangChain / Gemini)
  → pgvector similarity search (authorization-filtered)
  → Prompt assembly (safety rules + retrieved context)
  → Gemini stream / response
  → Persist chat history + usage log
```

### Swappable LLM

LLM and embeddings are behind provider interfaces in `src/ai/llm/`. Gemini is the default implementation. To switch providers later, add a new provider class and change the `LLM_PROVIDER` / `EMBEDDINGS_PROVIDER` bindings in `ai.module.ts`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `GEMINI_CHAT_MODEL` | No | Default `gemini-2.0-flash` |
| `GEMINI_EMBEDDING_MODEL` | No | Default `text-embedding-004` |
| `REDIS_URL` | No | Redis connection URL; falls back to in-memory cache |
| `AI_CACHE_TTL_SECONDS` | No | Cache TTL (default `3600`) |

Never commit API keys. Read them from environment only.

## API endpoints

Base prefix: `/3eyadahub-api/ai`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | Chat (set `"stream": true` for SSE) |
| `GET` | `/history` | List conversations + messages |
| `DELETE` | `/history/:id` | Delete a conversation |

### Chat request

```json
{
  "message": "What allergies do I have?",
  "conversationId": "optional-uuid",
  "patientUserId": "optional-for-doctors",
  "stream": true
}
```

### SSE events

```json
{ "type": "token", "content": "..." }
{ "type": "done", "conversationId": "...", "messageId": "..." }
{ "type": "error", "error": "..." }
```

## Socket.io

Emit `ai:chat` with:

```json
{
  "message": "When was my last blood test?",
  "conversationId": "optional",
  "patientUserId": "optional",
  "userId": "current-user-id",
  "role": "patient"
}
```

Listen for `ai:token`, `ai:done`, `ai:error`.

## RAG knowledge base

Table: `ai_knowledge_chunks`

| Column | Description |
|--------|-------------|
| `entity_type` | `patient_profile`, `diagnosis`, `lab_result`, etc. |
| `entity_id` | Source record id |
| `patient_id` | Patient user id (authorization scope) |
| `doctor_id` | Optional doctor id |
| `text` | Searchable text |
| `metadata` | JSON metadata |
| `embedding` | `vector(768)` |

### Indexing pipeline

`KnowledgeIndexerService` runs automatically when:

- Patient profile / allergies / notes change (`PatientPortalService`)
- Diagnoses are created or updated (`DiagnosisService`)
- Medical documents are created or deleted (`MedicalDocumentsService`)

Call `reindexPatient(userId)` to rebuild all chunks for a patient.

## Authorization

- **Patients**: only their own `patient_id`
- **Doctors**: patients with `records_allowed` in `doctor_patient_access`
- **Admins**: optional `patientUserId` context

Vector search applies patient filters **before** retrieval.

## Safety

The system prompt enforces:

- Answers only from retrieved records
- No invented diagnoses or prescriptions
- No emergency medical advice
- Fallback: "I cannot find that information in your records."

## Frontend

- **Web desktop**: `app/(tabs)/assistant.web.tsx` + `AssistantWebView` (sidebar | history | chat)
- **Native / mobile web**: `app/(tabs)/assistant.tsx`

## Migration

Run with the API (migrations auto-run on boot):

`1778120000000-AiAssistant.ts` — enables `vector` extension and AI tables.

Ensure Supabase project has the `vector` extension enabled.
