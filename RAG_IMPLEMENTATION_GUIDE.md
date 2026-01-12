# RAG Implementation Guide for DocuParse

This guide documents the Hybrid RAG (Retrieval-Augmented Generation) schema and implementation patterns for DocuParse.

## Schema Overview

The RAG system adds 4 new tables to enable document-based Q&A and intelligent search:

```
┌─────────────────────┐         ┌─────────────────────┐
│ document_processed  │◄────────│   document_chunks   │
│   (existing)        │         │   (text segments)   │
└─────────────────────┘         └──────────┬──────────┘
                                           │
                                ┌──────────▼──────────┐
                                │ document_embeddings │
                                │  (vector storage)   │
                                └─────────────────────┘

┌─────────────────────┐         ┌─────────────────────┐
│  rag_conversations  │◄────────│    rag_messages     │
│   (chat sessions)   │         │  (user/AI messages) │
└─────────────────────┘         └─────────────────────┘
```

## Tables Reference

### document_chunks

Stores text segments extracted from processed documents.

| Column | Type | Description |
|--------|------|-------------|
| chunk_id | BIGSERIAL | Primary key |
| process_id | INTEGER | FK to document_processed |
| chunk_text | TEXT | The actual text content |
| chunk_index | INTEGER | Order within document (0-based) |
| chunk_start_page | INTEGER | Starting page number |
| chunk_end_page | INTEGER | Ending page number |
| status | ENUM | 'pending', 'embedded', 'failed', 'archived' |
| metadata | JSONB | Additional searchable metadata |
| client_id | INTEGER | FK to client (multi-tenancy) |

### document_embeddings

Stores vector embeddings for similarity search.

| Column | Type | Description |
|--------|------|-------------|
| embedding_id | BIGSERIAL | Primary key |
| chunk_id | BIGINT | FK to document_chunks |
| embedding | vector(1536) | The vector embedding |
| model | ENUM | Embedding model used |
| tokens_used | INTEGER | Tokens consumed |
| embedding_cost | DECIMAL | Cost tracking |

### rag_conversations

Stores chat/query sessions.

| Column | Type | Description |
|--------|------|-------------|
| conversation_id | UUID | Primary key |
| userid | INTEGER | FK to user_profile |
| client_id | INTEGER | FK to client |
| title | VARCHAR | Conversation title |
| status | ENUM | 'active', 'completed', 'archived' |
| model_name | VARCHAR | LLM model (e.g., 'gpt-4') |
| top_k | INTEGER | Number of chunks to retrieve |
| similarity_threshold | DECIMAL | Minimum similarity score |
| total_cost | DECIMAL | Running cost total |

### rag_messages

Individual messages within conversations.

| Column | Type | Description |
|--------|------|-------------|
| message_id | BIGSERIAL | Primary key |
| conversation_id | UUID | FK to rag_conversations |
| role | ENUM | 'system', 'user', 'assistant', 'function' |
| content | TEXT | Message content |
| retrieved_chunks | BIGINT[] | Array of chunk_ids used for context |
| retrieval_scores | DECIMAL[] | Similarity scores for each chunk |
| total_tokens | INTEGER | Tokens used |
| message_cost | DECIMAL | Cost for this message |
| user_rating | INTEGER | 1-5 user feedback rating |

---

## Implementation Patterns

### 1. Chunking Documents

After document processing, split text into chunks:

```javascript
// services/ragService.js

const CHUNK_SIZE = 1000;      // Characters per chunk
const CHUNK_OVERLAP = 200;    // Overlap between chunks

async function chunkDocument(processId, extractedText, clientId) {
  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < extractedText.length) {
    const end = Math.min(start + CHUNK_SIZE, extractedText.length);
    const chunkText = extractedText.slice(start, end);

    chunks.push({
      process_id: processId,
      chunk_text: chunkText,
      chunk_index: index,
      chunk_start_char: start,
      chunk_end_char: end,
      chunk_size: chunkText.length,
      chunk_overlap: index > 0 ? CHUNK_OVERLAP : 0,
      status: 'pending',
      client_id: clientId
    });

    start = end - CHUNK_OVERLAP;
    index++;
  }

  // Insert chunks into Supabase
  const { data, error } = await supabase
    .from('document_chunks')
    .insert(chunks)
    .select('chunk_id');

  return data;
}
```

### 2. Generating Embeddings

Generate embeddings using OpenAI:

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbeddings(chunks, clientId) {
  for (const chunk of chunks) {
    // Generate embedding
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk.chunk_text
    });

    const embedding = response.data[0].embedding;
    const tokensUsed = response.usage.total_tokens;
    const cost = tokensUsed * 0.00002 / 1000; // $0.00002 per 1K tokens

    // Store embedding
    await supabase.from('document_embeddings').insert({
      chunk_id: chunk.chunk_id,
      embedding: JSON.stringify(embedding),
      model: 'openai-3-small',
      dimensions: 1536,
      tokens_used: tokensUsed,
      embedding_cost: cost,
      client_id: clientId
    });

    // Update chunk status
    await supabase
      .from('document_chunks')
      .update({ status: 'embedded' })
      .eq('chunk_id', chunk.chunk_id);
  }
}
```

### 3. Similarity Search

Use the `match_documents` function:

```javascript
async function searchDocuments(queryText, clientId, options = {}) {
  const { topK = 5, threshold = 0.7, categoryId = null } = options;

  // Generate query embedding
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: queryText
  });
  const queryEmbedding = response.data[0].embedding;

  // Call match_documents function
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: topK,
    match_threshold: threshold,
    filter_client_id: clientId,
    filter_doc_category: categoryId,
    filter_process_ids: null
  });

  return data;
}
```

### 4. RAG Query Flow

Complete RAG flow for answering questions:

```javascript
async function askQuestion(conversationId, userQuestion, clientId) {
  // 1. Get conversation context
  const { data: conversation } = await supabase
    .from('rag_conversations')
    .select('*')
    .eq('conversation_id', conversationId)
    .single();

  // 2. Search for relevant chunks
  const relevantChunks = await searchDocuments(userQuestion, clientId, {
    topK: conversation.top_k,
    threshold: conversation.similarity_threshold,
    categoryId: conversation.doc_category_filter
  });

  // 3. Build context from chunks
  const context = relevantChunks
    .map(c => `[From: ${c.doc_name}]\n${c.chunk_text}`)
    .join('\n\n---\n\n');

  // 4. Get recent conversation history
  const { data: history } = await supabase
    .from('rag_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(10);

  // 5. Build messages for LLM
  const messages = [
    {
      role: 'system',
      content: `You are a helpful assistant answering questions about documents.
Use the following context to answer the user's question.
If the answer is not in the context, say so.

Context:
${context}`
    },
    ...history.reverse(),
    { role: 'user', content: userQuestion }
  ];

  // 6. Get LLM response
  const completion = await openai.chat.completions.create({
    model: conversation.model_name,
    messages,
    temperature: parseFloat(conversation.temperature),
    max_tokens: conversation.max_tokens
  });

  const assistantResponse = completion.choices[0].message.content;
  const tokensUsed = completion.usage.total_tokens;

  // 7. Save messages to database
  await supabase.from('rag_messages').insert([
    {
      conversation_id: conversationId,
      role: 'user',
      content: userQuestion
    },
    {
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantResponse,
      retrieved_chunks: relevantChunks.map(c => c.chunk_id),
      retrieval_scores: relevantChunks.map(c => c.similarity),
      total_tokens: tokensUsed,
      message_cost: tokensUsed * 0.00003 // Approximate GPT-4 cost
    }
  ]);

  return {
    answer: assistantResponse,
    sources: relevantChunks.map(c => ({
      document: c.doc_name,
      chunk: c.chunk_text.substring(0, 200) + '...',
      similarity: c.similarity
    }))
  };
}
```

---

## API Endpoints (Suggested)

### POST /api/rag/conversations
Create a new RAG conversation.

### GET /api/rag/conversations
List user's conversations.

### POST /api/rag/conversations/:id/messages
Send a message and get AI response.

### GET /api/rag/conversations/:id/messages
Get conversation history.

### POST /api/rag/index/:processId
Index a document for RAG (chunk + embed).

### DELETE /api/rag/index/:processId
Remove document from RAG index.

---

## Cost Estimates

| Operation | Model | Cost |
|-----------|-------|------|
| Embedding | text-embedding-3-small | $0.02 / 1M tokens |
| Embedding | text-embedding-3-large | $0.13 / 1M tokens |
| Query | GPT-4 | $30 / 1M input, $60 / 1M output |
| Query | GPT-4o-mini | $0.15 / 1M input, $0.60 / 1M output |

**Example: 100-page document**
- ~50,000 tokens for embedding = $0.001
- 50 queries with GPT-4o-mini = $0.05
- **Total: ~$0.05 per document lifecycle**

---

## Hybrid Search

The schema supports hybrid search combining:
1. **Vector similarity** (semantic meaning)
2. **Keyword matching** (exact terms)

Use the `hybrid_search` function:

```sql
SELECT * FROM hybrid_search(
    '[embedding vector]'::vector(1536),
    'search keywords',
    5,      -- match_count
    0.7,    -- vector_weight (70%)
    0.3,    -- keyword_weight (30%)
    1       -- client_id filter
);
```

---

## Performance Tips

1. **HNSW Index** - Already created, provides fast approximate nearest neighbor search
2. **Client filtering** - Always filter by `client_id` to reduce search space
3. **Chunk size** - 500-1500 characters typically works best
4. **Batch embeddings** - Process up to 2048 texts per API call
5. **Cache embeddings** - Query embeddings can be cached for repeated questions

---

## Schema File Location

```
database/rag_schema.sql
```

Run this file in Supabase SQL Editor to set up the RAG tables.
