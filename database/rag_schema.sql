-- ============================================================================
-- RAG (Retrieval-Augmented Generation) Schema for DocuParse
-- ============================================================================
-- This schema adds vector search capabilities for hybrid RAG features
--
-- IMPACT: Creates NEW tables only - NO changes to existing tables/data
--
-- Tables created:
--   - document_chunks: Stores text segments from processed documents
--   - document_embeddings: Stores vector embeddings for similarity search
--   - rag_conversations: Stores chat/query sessions
--   - rag_messages: Individual messages in conversations
--
-- Prerequisites:
--   - Supabase project with existing schema
--   - pgvector extension (enabled below)
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable Required Extensions
-- ============================================================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for fuzzy text matching (hybrid search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- STEP 2: Create ENUM Types for RAG
-- ============================================================================

-- Embedding model types
CREATE TYPE embedding_model_enum AS ENUM (
    'openai-ada-002',           -- OpenAI text-embedding-ada-002 (1536 dim)
    'openai-3-small',           -- OpenAI text-embedding-3-small (1536 dim)
    'openai-3-large',           -- OpenAI text-embedding-3-large (3072 dim)
    'cohere-english',           -- Cohere embed-english-v3.0 (1024 dim)
    'cohere-multilingual',      -- Cohere embed-multilingual-v3.0 (1024 dim)
    'vertex-gecko',             -- Google Vertex AI textembedding-gecko (768 dim)
    'custom'                    -- Custom/other models
);

-- Chunk status
CREATE TYPE chunk_status_enum AS ENUM (
    'pending',      -- Waiting for embedding generation
    'embedded',     -- Embedding generated successfully
    'failed',       -- Embedding generation failed
    'archived'      -- Soft deleted / archived
);

-- Conversation status
CREATE TYPE conversation_status_enum AS ENUM (
    'active',       -- Ongoing conversation
    'completed',    -- User ended conversation
    'archived'      -- Admin archived
);

-- Message role (following OpenAI convention)
CREATE TYPE message_role_enum AS ENUM (
    'system',       -- System prompt
    'user',         -- User message
    'assistant',    -- AI response
    'function'      -- Function call result
);

-- ============================================================================
-- STEP 3: Create RAG Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: document_chunks
-- Stores text segments extracted from processed documents
-- ----------------------------------------------------------------------------
CREATE TABLE document_chunks (
    chunk_id BIGSERIAL PRIMARY KEY,

    -- Reference to source document (existing table)
    process_id INTEGER NOT NULL REFERENCES document_processed(process_id) ON DELETE CASCADE,

    -- Chunk content and metadata
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,              -- Order within document (0-based)
    chunk_start_page INTEGER,                  -- Starting page number
    chunk_end_page INTEGER,                    -- Ending page number
    chunk_start_char INTEGER,                  -- Character offset start
    chunk_end_char INTEGER,                    -- Character offset end

    -- Chunking metadata
    chunk_method VARCHAR(50) DEFAULT 'fixed_size',  -- 'fixed_size', 'sentence', 'paragraph', 'semantic'
    chunk_size INTEGER,                        -- Size in characters/tokens
    chunk_overlap INTEGER DEFAULT 0,           -- Overlap with previous chunk

    -- Processing status
    status chunk_status_enum DEFAULT 'pending',
    error_message TEXT,

    -- Searchable metadata (for filtering)
    metadata JSONB DEFAULT '{}',

    -- Multi-tenancy
    client_id INTEGER REFERENCES client(client_id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for document_chunks
CREATE INDEX idx_chunks_process_id ON document_chunks(process_id);
CREATE INDEX idx_chunks_client_id ON document_chunks(client_id);
CREATE INDEX idx_chunks_status ON document_chunks(status);
CREATE INDEX idx_chunks_metadata ON document_chunks USING gin(metadata);

-- Full-text search index for hybrid search
CREATE INDEX idx_chunks_text_search ON document_chunks USING gin(to_tsvector('english', chunk_text));

-- Trigram index for fuzzy matching
CREATE INDEX idx_chunks_text_trgm ON document_chunks USING gin(chunk_text gin_trgm_ops);

-- Unique constraint: one chunk per position per document
CREATE UNIQUE INDEX idx_chunks_unique_position ON document_chunks(process_id, chunk_index);

-- ----------------------------------------------------------------------------
-- Table: document_embeddings
-- Stores vector embeddings for similarity search
-- ----------------------------------------------------------------------------
CREATE TABLE document_embeddings (
    embedding_id BIGSERIAL PRIMARY KEY,

    -- Reference to chunk
    chunk_id BIGINT NOT NULL REFERENCES document_chunks(chunk_id) ON DELETE CASCADE,

    -- Vector embedding (1536 dimensions for OpenAI ada-002/3-small)
    -- Can store up to 2000 dimensions with pgvector
    embedding vector(1536) NOT NULL,

    -- Embedding metadata
    model embedding_model_enum DEFAULT 'openai-3-small',
    model_version VARCHAR(50),
    dimensions INTEGER DEFAULT 1536,

    -- Cost tracking
    tokens_used INTEGER,
    embedding_cost DECIMAL(10,6) DEFAULT 0.000000,

    -- Multi-tenancy (denormalized for query performance)
    client_id INTEGER REFERENCES client(client_id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- HNSW index for fast approximate nearest neighbor search
-- m = 16 (connections per layer), ef_construction = 64 (build quality)
CREATE INDEX idx_embeddings_vector_hnsw ON document_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (faster build, slightly less accurate)
-- Uncomment if you prefer IVFFlat over HNSW
-- CREATE INDEX idx_embeddings_vector_ivfflat ON document_embeddings
--     USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);

-- Other indexes
CREATE INDEX idx_embeddings_chunk_id ON document_embeddings(chunk_id);
CREATE INDEX idx_embeddings_client_id ON document_embeddings(client_id);
CREATE INDEX idx_embeddings_model ON document_embeddings(model);

-- Unique constraint: one embedding per chunk per model
CREATE UNIQUE INDEX idx_embeddings_unique_chunk_model ON document_embeddings(chunk_id, model);

-- ----------------------------------------------------------------------------
-- Table: rag_conversations
-- Stores conversation/chat sessions for RAG queries
-- ----------------------------------------------------------------------------
CREATE TABLE rag_conversations (
    conversation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- User who started the conversation
    userid INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
    client_id INTEGER REFERENCES client(client_id) ON DELETE SET NULL,

    -- Conversation metadata
    title VARCHAR(255),                        -- Auto-generated or user-set title
    status conversation_status_enum DEFAULT 'active',

    -- Context configuration
    doc_category_filter INTEGER REFERENCES doc_category(category_id) ON DELETE SET NULL,
    document_filter INTEGER[] DEFAULT '{}',    -- Specific document IDs to search
    date_range_start DATE,                     -- Filter documents by date
    date_range_end DATE,

    -- RAG configuration
    model_name VARCHAR(100) DEFAULT 'gpt-4',   -- LLM model for responses
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    top_k INTEGER DEFAULT 5,                   -- Number of chunks to retrieve
    similarity_threshold DECIMAL(3,2) DEFAULT 0.7,

    -- Usage tracking
    total_messages INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0.0000,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP
);

-- Indexes for rag_conversations
CREATE INDEX idx_conversations_userid ON rag_conversations(userid);
CREATE INDEX idx_conversations_client_id ON rag_conversations(client_id);
CREATE INDEX idx_conversations_status ON rag_conversations(status);
CREATE INDEX idx_conversations_created_at ON rag_conversations(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: rag_messages
-- Individual messages within a conversation
-- ----------------------------------------------------------------------------
CREATE TABLE rag_messages (
    message_id BIGSERIAL PRIMARY KEY,

    -- Reference to conversation
    conversation_id UUID NOT NULL REFERENCES rag_conversations(conversation_id) ON DELETE CASCADE,

    -- Message content
    role message_role_enum NOT NULL,
    content TEXT NOT NULL,

    -- For assistant messages: retrieved context
    retrieved_chunks BIGINT[] DEFAULT '{}',    -- Array of chunk_ids used
    retrieval_scores DECIMAL(5,4)[] DEFAULT '{}',  -- Similarity scores

    -- Token usage for this message
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,

    -- Cost tracking
    message_cost DECIMAL(10,6) DEFAULT 0.000000,

    -- Feedback
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_feedback TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for rag_messages
CREATE INDEX idx_messages_conversation_id ON rag_messages(conversation_id);
CREATE INDEX idx_messages_role ON rag_messages(role);
CREATE INDEX idx_messages_created_at ON rag_messages(created_at);

-- ============================================================================
-- STEP 4: Create Helper Functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: match_documents
-- Performs vector similarity search with optional filters
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_count INTEGER DEFAULT 5,
    match_threshold DECIMAL DEFAULT 0.7,
    filter_client_id INTEGER DEFAULT NULL,
    filter_doc_category INTEGER DEFAULT NULL,
    filter_process_ids INTEGER[] DEFAULT NULL
)
RETURNS TABLE (
    chunk_id BIGINT,
    process_id INTEGER,
    chunk_text TEXT,
    chunk_index INTEGER,
    similarity DECIMAL,
    doc_name VARCHAR,
    doc_category INTEGER,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.chunk_id,
        dc.process_id,
        dc.chunk_text,
        dc.chunk_index,
        (1 - (de.embedding <=> query_embedding))::DECIMAL as similarity,
        dp.doc_name,
        dp.doc_category,
        dc.metadata
    FROM document_embeddings de
    JOIN document_chunks dc ON de.chunk_id = dc.chunk_id
    JOIN document_processed dp ON dc.process_id = dp.process_id
    WHERE
        dc.status = 'embedded'
        AND (filter_client_id IS NULL OR dc.client_id = filter_client_id)
        AND (filter_doc_category IS NULL OR dp.doc_category = filter_doc_category)
        AND (filter_process_ids IS NULL OR dc.process_id = ANY(filter_process_ids))
        AND (1 - (de.embedding <=> query_embedding)) >= match_threshold
    ORDER BY de.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- Function: hybrid_search
-- Combines vector similarity with keyword search (BM25-like)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION hybrid_search(
    query_embedding vector(1536),
    query_text TEXT,
    match_count INTEGER DEFAULT 5,
    vector_weight DECIMAL DEFAULT 0.7,
    keyword_weight DECIMAL DEFAULT 0.3,
    filter_client_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    chunk_id BIGINT,
    process_id INTEGER,
    chunk_text TEXT,
    vector_score DECIMAL,
    keyword_score DECIMAL,
    combined_score DECIMAL,
    doc_name VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT
            dc.chunk_id,
            dc.process_id,
            dc.chunk_text,
            (1 - (de.embedding <=> query_embedding))::DECIMAL as v_score
        FROM document_embeddings de
        JOIN document_chunks dc ON de.chunk_id = dc.chunk_id
        WHERE dc.status = 'embedded'
        AND (filter_client_id IS NULL OR dc.client_id = filter_client_id)
    ),
    keyword_results AS (
        SELECT
            dc.chunk_id,
            ts_rank(to_tsvector('english', dc.chunk_text), plainto_tsquery('english', query_text))::DECIMAL as k_score
        FROM document_chunks dc
        WHERE dc.status = 'embedded'
        AND (filter_client_id IS NULL OR dc.client_id = filter_client_id)
        AND to_tsvector('english', dc.chunk_text) @@ plainto_tsquery('english', query_text)
    )
    SELECT
        vr.chunk_id,
        vr.process_id,
        vr.chunk_text,
        vr.v_score as vector_score,
        COALESCE(kr.k_score, 0) as keyword_score,
        (vr.v_score * vector_weight + COALESCE(kr.k_score, 0) * keyword_weight)::DECIMAL as combined_score,
        dp.doc_name
    FROM vector_results vr
    LEFT JOIN keyword_results kr ON vr.chunk_id = kr.chunk_id
    JOIN document_chunks dc ON vr.chunk_id = dc.chunk_id
    JOIN document_processed dp ON dc.process_id = dp.process_id
    ORDER BY (vr.v_score * vector_weight + COALESCE(kr.k_score, 0) * keyword_weight) DESC
    LIMIT match_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- Function: get_conversation_context
-- Retrieves recent messages from a conversation for context
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_conversation_context(
    p_conversation_id UUID,
    max_messages INTEGER DEFAULT 10
)
RETURNS TABLE (
    role message_role_enum,
    content TEXT,
    created_at TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rm.role,
        rm.content,
        rm.created_at
    FROM rag_messages rm
    WHERE rm.conversation_id = p_conversation_id
    ORDER BY rm.created_at DESC
    LIMIT max_messages;
END;
$$;

-- ============================================================================
-- STEP 5: Create Triggers
-- ============================================================================

-- Trigger to update updated_at on document_chunks
CREATE TRIGGER update_document_chunks_updated_at
    BEFORE UPDATE ON document_chunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on rag_conversations
CREATE TRIGGER update_rag_conversations_updated_at
    BEFORE UPDATE ON rag_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update conversation stats when message is added
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE rag_conversations
    SET
        total_messages = total_messages + 1,
        total_tokens_used = total_tokens_used + COALESCE(NEW.total_tokens, 0),
        total_cost = total_cost + COALESCE(NEW.message_cost, 0),
        last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE conversation_id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_on_message
    AFTER INSERT ON rag_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- STEP 6: Enable Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on RAG tables
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Create RLS Policies (customize based on your auth strategy)
-- ============================================================================

-- Policy: Service role can do everything (for backend operations)
CREATE POLICY "Service role full access on document_chunks"
    ON document_chunks FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on document_embeddings"
    ON document_embeddings FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on rag_conversations"
    ON rag_conversations FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on rag_messages"
    ON rag_messages FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- STEP 8: Create Views for Common Queries
-- ============================================================================

-- View: Document chunks with embedding status
CREATE OR REPLACE VIEW v_document_chunks_status AS
SELECT
    dc.chunk_id,
    dc.process_id,
    dp.doc_name,
    dp.original_filename,
    dc.chunk_index,
    LENGTH(dc.chunk_text) as chunk_length,
    dc.status,
    dc.client_id,
    c.client_name,
    de.embedding_id IS NOT NULL as has_embedding,
    de.model as embedding_model,
    dc.created_at
FROM document_chunks dc
JOIN document_processed dp ON dc.process_id = dp.process_id
LEFT JOIN client c ON dc.client_id = c.client_id
LEFT JOIN document_embeddings de ON dc.chunk_id = de.chunk_id;

-- View: RAG usage statistics by client
CREATE OR REPLACE VIEW v_rag_usage_by_client AS
SELECT
    c.client_id,
    c.client_name,
    COUNT(DISTINCT rc.conversation_id) as total_conversations,
    SUM(rc.total_messages) as total_messages,
    SUM(rc.total_tokens_used) as total_tokens,
    SUM(rc.total_cost) as total_cost,
    COUNT(DISTINCT dc.process_id) as documents_indexed,
    COUNT(dc.chunk_id) as total_chunks
FROM client c
LEFT JOIN rag_conversations rc ON c.client_id = rc.client_id
LEFT JOIN document_chunks dc ON c.client_id = dc.client_id AND dc.status = 'embedded'
GROUP BY c.client_id, c.client_name;

-- ============================================================================
-- STEP 9: Insert Default Configuration (Optional)
-- ============================================================================

-- You can uncomment and customize this section to add default RAG settings
-- INSERT INTO system_config (config_key, config_value, description) VALUES
-- ('rag_default_model', 'gpt-4', 'Default LLM model for RAG responses'),
-- ('rag_default_top_k', '5', 'Default number of chunks to retrieve'),
-- ('rag_chunk_size', '1000', 'Default chunk size in characters'),
-- ('rag_chunk_overlap', '200', 'Default chunk overlap in characters'),
-- ('rag_embedding_model', 'openai-3-small', 'Default embedding model');

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================

-- Check all tables created
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%chunk%' OR table_name LIKE '%embedding%' OR table_name LIKE 'rag_%';

-- Check vector extension
-- SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check indexes
-- SELECT indexname, tablename FROM pg_indexes WHERE tablename IN ('document_chunks', 'document_embeddings', 'rag_conversations', 'rag_messages');

-- Test match_documents function (requires at least one embedding)
-- SELECT * FROM match_documents(
--     '[0.1, 0.2, ...]'::vector(1536),  -- Your query embedding
--     5,                                  -- Number of results
--     0.7,                                -- Similarity threshold
--     NULL,                               -- Client filter
--     NULL,                               -- Category filter
--     NULL                                -- Document filter
-- );

-- ============================================================================
-- END OF RAG SCHEMA MIGRATION
-- ============================================================================
