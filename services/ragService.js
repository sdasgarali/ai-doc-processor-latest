const db = require('../config/database');
const axios = require('axios');

/**
 * RAG Service for DocuParse
 * Handles document chunking, embedding generation, similarity search, and conversations
 */

class RAGService {
  constructor() {
    // Chunking configuration
    this.chunkSize = parseInt(process.env.RAG_CHUNK_SIZE) || 1000;
    this.chunkOverlap = parseInt(process.env.RAG_CHUNK_OVERLAP) || 200;
    this.chunkMethod = process.env.RAG_CHUNK_METHOD || 'fixed_size';

    // Embedding configuration
    this.embeddingModel = process.env.RAG_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.embeddingDimensions = 1536; // OpenAI ada-002 and 3-small use 1536

    // RAG query configuration
    this.defaultTopK = parseInt(process.env.RAG_DEFAULT_TOP_K) || 5;
    this.defaultThreshold = parseFloat(process.env.RAG_DEFAULT_THRESHOLD) || 0.7;
    this.defaultLLMModel = process.env.RAG_LLM_MODEL || 'gpt-4o-mini';

    // Cost tracking (per 1M tokens)
    this.embeddingCosts = {
      'text-embedding-ada-002': 0.10,
      'text-embedding-3-small': 0.02,
      'text-embedding-3-large': 0.13
    };

    this.llmCosts = {
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4-turbo': { input: 10.00, output: 30.00 },
      'gpt-4': { input: 30.00, output: 60.00 }
    };
  }

  // ============================================================================
  // CHUNKING
  // ============================================================================

  /**
   * Split text into chunks with overlap
   * @param {string} text - Full document text
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunk objects
   */
  createChunks(text, options = {}) {
    const chunkSize = options.chunkSize || this.chunkSize;
    const overlap = options.overlap || this.chunkOverlap;
    const method = options.method || this.chunkMethod;

    if (method === 'sentence') {
      return this._chunkBySentence(text, chunkSize, overlap);
    } else if (method === 'paragraph') {
      return this._chunkByParagraph(text, chunkSize);
    } else {
      return this._chunkByFixedSize(text, chunkSize, overlap);
    }
  }

  /**
   * Fixed-size chunking with overlap
   */
  _chunkByFixedSize(text, chunkSize, overlap) {
    const chunks = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
      // Find a good break point (end of sentence or word)
      let end = Math.min(start + chunkSize, text.length);

      if (end < text.length) {
        // Try to break at sentence boundary
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > start + chunkSize * 0.5) {
          end = breakPoint + 1;
        } else {
          // Break at word boundary
          const lastSpace = text.lastIndexOf(' ', end);
          if (lastSpace > start) {
            end = lastSpace;
          }
        }
      }

      const chunkText = text.slice(start, end).trim();

      if (chunkText.length > 0) {
        chunks.push({
          chunk_text: chunkText,
          chunk_index: index,
          chunk_start_char: start,
          chunk_end_char: end,
          chunk_size: chunkText.length,
          chunk_overlap: index > 0 ? overlap : 0,
          chunk_method: 'fixed_size'
        });
        index++;
      }

      // Move start with overlap
      start = end - overlap;
      if (start >= text.length) break;
    }

    return chunks;
  }

  /**
   * Sentence-based chunking
   */
  _chunkBySentence(text, targetSize, overlap) {
    // Split by sentence boundaries
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    let index = 0;
    let startChar = 0;

    for (const sentence of sentences) {
      const sentenceSize = sentence.length;

      if (currentSize + sentenceSize > targetSize && currentChunk.length > 0) {
        // Save current chunk
        const chunkText = currentChunk.join(' ').trim();
        chunks.push({
          chunk_text: chunkText,
          chunk_index: index,
          chunk_start_char: startChar,
          chunk_end_char: startChar + chunkText.length,
          chunk_size: chunkText.length,
          chunk_overlap: 0,
          chunk_method: 'sentence'
        });

        // Keep last few sentences for overlap
        const overlapSentences = Math.ceil(overlap / 100);
        currentChunk = currentChunk.slice(-overlapSentences);
        currentSize = currentChunk.join(' ').length;
        startChar += chunkText.length - currentSize;
        index++;
      }

      currentChunk.push(sentence.trim());
      currentSize += sentenceSize;
    }

    // Don't forget the last chunk
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ').trim();
      chunks.push({
        chunk_text: chunkText,
        chunk_index: index,
        chunk_start_char: startChar,
        chunk_end_char: startChar + chunkText.length,
        chunk_size: chunkText.length,
        chunk_overlap: 0,
        chunk_method: 'sentence'
      });
    }

    return chunks;
  }

  /**
   * Paragraph-based chunking
   */
  _chunkByParagraph(text, maxSize) {
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    let index = 0;
    let startChar = 0;

    for (const paragraph of paragraphs) {
      const paraSize = paragraph.length;

      if (paraSize > maxSize) {
        // Paragraph too large, use fixed-size chunking
        if (currentChunk.length > 0) {
          const chunkText = currentChunk.join('\n\n').trim();
          chunks.push({
            chunk_text: chunkText,
            chunk_index: index++,
            chunk_start_char: startChar,
            chunk_end_char: startChar + chunkText.length,
            chunk_size: chunkText.length,
            chunk_overlap: 0,
            chunk_method: 'paragraph'
          });
          startChar += chunkText.length + 2;
          currentChunk = [];
          currentSize = 0;
        }

        // Split large paragraph
        const subChunks = this._chunkByFixedSize(paragraph, maxSize, this.chunkOverlap);
        for (const sub of subChunks) {
          sub.chunk_index = index++;
          sub.chunk_start_char += startChar;
          sub.chunk_end_char += startChar;
          chunks.push(sub);
        }
        startChar += paraSize + 2;
        continue;
      }

      if (currentSize + paraSize > maxSize && currentChunk.length > 0) {
        const chunkText = currentChunk.join('\n\n').trim();
        chunks.push({
          chunk_text: chunkText,
          chunk_index: index++,
          chunk_start_char: startChar,
          chunk_end_char: startChar + chunkText.length,
          chunk_size: chunkText.length,
          chunk_overlap: 0,
          chunk_method: 'paragraph'
        });
        startChar += chunkText.length + 2;
        currentChunk = [];
        currentSize = 0;
      }

      currentChunk.push(paragraph.trim());
      currentSize += paraSize;
    }

    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join('\n\n').trim();
      chunks.push({
        chunk_text: chunkText,
        chunk_index: index,
        chunk_start_char: startChar,
        chunk_end_char: startChar + chunkText.length,
        chunk_size: chunkText.length,
        chunk_overlap: 0,
        chunk_method: 'paragraph'
      });
    }

    return chunks;
  }

  // ============================================================================
  // EMBEDDING GENERATION
  // ============================================================================

  /**
   * Generate embedding for a single text
   * @param {string} text - Text to embed
   * @returns {Object} { embedding, tokens, cost }
   */
  async generateEmbedding(text) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for embedding generation');
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model: this.embeddingModel,
          input: text
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const embedding = response.data.data[0].embedding;
      const tokensUsed = response.data.usage.total_tokens;
      const costPer1M = this.embeddingCosts[this.embeddingModel] || 0.02;
      const cost = (tokensUsed / 1000000) * costPer1M;

      return {
        embedding,
        tokens: tokensUsed,
        cost,
        model: this.embeddingModel,
        dimensions: embedding.length
      };
    } catch (error) {
      console.error('Embedding generation error:', error.response?.data || error.message);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   * @param {Array<string>} texts - Array of texts to embed
   * @returns {Array} Array of embedding results
   */
  async generateEmbeddingsBatch(texts) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for embedding generation');
    }

    // OpenAI allows up to 2048 inputs per request
    const batchSize = 100;
    const results = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      try {
        const response = await axios.post(
          'https://api.openai.com/v1/embeddings',
          {
            model: this.embeddingModel,
            input: batch
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );

        const tokensUsed = response.data.usage.total_tokens;
        const costPer1M = this.embeddingCosts[this.embeddingModel] || 0.02;
        const totalCost = (tokensUsed / 1000000) * costPer1M;
        const costPerItem = totalCost / batch.length;

        for (let j = 0; j < response.data.data.length; j++) {
          results.push({
            embedding: response.data.data[j].embedding,
            tokens: Math.round(tokensUsed / batch.length),
            cost: costPerItem,
            model: this.embeddingModel,
            dimensions: response.data.data[j].embedding.length
          });
        }
      } catch (error) {
        console.error(`Batch embedding error (batch ${i / batchSize + 1}):`, error.response?.data || error.message);
        // Fill with nulls for failed batch
        for (let j = 0; j < batch.length; j++) {
          results.push(null);
        }
      }
    }

    return results;
  }

  // ============================================================================
  // DOCUMENT INDEXING
  // ============================================================================

  /**
   * Index a document for RAG (chunk and embed)
   * @param {number} processId - Document process ID
   * @param {string} text - Full document text
   * @param {Object} options - Indexing options
   * @returns {Object} Indexing result with stats
   */
  async indexDocument(processId, text, options = {}) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    // Get document info
    const { data: doc, error: docError } = await supabase
      .from('document_processed')
      .select('process_id, doc_name, client_id, doc_category, no_of_pages')
      .eq('process_id', processId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${processId}`);
    }

    console.log(`Indexing document: ${doc.doc_name} (${processId})`);

    // Check if already indexed
    const { data: existingChunks } = await supabase
      .from('document_chunks')
      .select('chunk_id')
      .eq('process_id', processId)
      .limit(1);

    if (existingChunks && existingChunks.length > 0) {
      if (!options.reindex) {
        throw new Error(`Document ${processId} is already indexed. Use reindex option to re-index.`);
      }
      // Delete existing chunks (embeddings cascade delete)
      await supabase
        .from('document_chunks')
        .delete()
        .eq('process_id', processId);
      console.log(`Deleted existing chunks for document ${processId}`);
    }

    // Create chunks
    const chunks = this.createChunks(text, {
      chunkSize: options.chunkSize || this.chunkSize,
      overlap: options.overlap || this.chunkOverlap,
      method: options.method || this.chunkMethod
    });

    console.log(`Created ${chunks.length} chunks`);

    // Insert chunks
    const chunkRecords = chunks.map(chunk => ({
      process_id: processId,
      chunk_text: chunk.chunk_text,
      chunk_index: chunk.chunk_index,
      chunk_start_char: chunk.chunk_start_char,
      chunk_end_char: chunk.chunk_end_char,
      chunk_method: chunk.chunk_method,
      chunk_size: chunk.chunk_size,
      chunk_overlap: chunk.chunk_overlap,
      status: 'pending',
      client_id: doc.client_id,
      metadata: {
        doc_name: doc.doc_name,
        doc_category: doc.doc_category,
        total_pages: doc.no_of_pages
      }
    }));

    const { data: insertedChunks, error: insertError } = await supabase
      .from('document_chunks')
      .insert(chunkRecords)
      .select('chunk_id, chunk_text');

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    console.log(`Inserted ${insertedChunks.length} chunks, generating embeddings...`);

    // Generate embeddings in batches
    const texts = insertedChunks.map(c => c.chunk_text);
    const embeddings = await this.generateEmbeddingsBatch(texts);

    // Insert embeddings and update chunk status
    let successCount = 0;
    let failCount = 0;
    let totalCost = 0;
    let totalTokens = 0;

    for (let i = 0; i < insertedChunks.length; i++) {
      const chunk = insertedChunks[i];
      const embeddingResult = embeddings[i];

      if (embeddingResult && embeddingResult.embedding) {
        // Insert embedding
        const { error: embError } = await supabase
          .from('document_embeddings')
          .insert({
            chunk_id: chunk.chunk_id,
            embedding: JSON.stringify(embeddingResult.embedding),
            model: embeddingResult.model,
            dimensions: embeddingResult.dimensions,
            tokens_used: embeddingResult.tokens,
            embedding_cost: embeddingResult.cost,
            client_id: doc.client_id
          });

        if (!embError) {
          // Update chunk status
          await supabase
            .from('document_chunks')
            .update({ status: 'embedded' })
            .eq('chunk_id', chunk.chunk_id);

          successCount++;
          totalCost += embeddingResult.cost;
          totalTokens += embeddingResult.tokens;
        } else {
          console.error(`Failed to insert embedding for chunk ${chunk.chunk_id}:`, embError);
          failCount++;
        }
      } else {
        // Mark chunk as failed
        await supabase
          .from('document_chunks')
          .update({
            status: 'failed',
            error_message: 'Embedding generation failed'
          })
          .eq('chunk_id', chunk.chunk_id);
        failCount++;
      }
    }

    console.log(`Indexing complete: ${successCount} success, ${failCount} failed`);

    return {
      processId,
      docName: doc.doc_name,
      totalChunks: chunks.length,
      successfulEmbeddings: successCount,
      failedEmbeddings: failCount,
      totalTokens,
      totalCost: totalCost.toFixed(6),
      chunkMethod: options.method || this.chunkMethod,
      chunkSize: options.chunkSize || this.chunkSize
    };
  }

  /**
   * Remove document from RAG index
   * @param {number} processId - Document process ID
   */
  async removeDocumentIndex(processId) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await supabase
      .from('document_chunks')
      .delete()
      .eq('process_id', processId)
      .select('chunk_id');

    if (error) {
      throw new Error(`Failed to remove index: ${error.message}`);
    }

    return {
      processId,
      chunksRemoved: data?.length || 0
    };
  }

  /**
   * Get indexing status for a document
   * @param {number} processId - Document process ID
   */
  async getIndexStatus(processId) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const { data: chunks, error } = await supabase
      .from('document_chunks')
      .select('chunk_id, status, chunk_index')
      .eq('process_id', processId);

    if (error) {
      throw new Error(`Failed to get index status: ${error.message}`);
    }

    if (!chunks || chunks.length === 0) {
      return { indexed: false, processId };
    }

    const statusCounts = chunks.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});

    return {
      indexed: true,
      processId,
      totalChunks: chunks.length,
      embedded: statusCounts.embedded || 0,
      pending: statusCounts.pending || 0,
      failed: statusCounts.failed || 0
    };
  }

  // ============================================================================
  // SIMILARITY SEARCH
  // ============================================================================

  /**
   * Search for similar documents/chunks
   * @param {string} query - Search query text
   * @param {Object} options - Search options
   * @returns {Array} Matching chunks with similarity scores
   */
  async search(query, options = {}) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const {
      topK = this.defaultTopK,
      threshold = this.defaultThreshold,
      clientId = null,
      categoryId = null,
      processIds = null
    } = options;

    // Generate query embedding
    const { embedding: queryEmbedding } = await this.generateEmbedding(query);

    // Call match_documents function
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: topK,
      match_threshold: threshold,
      filter_client_id: clientId,
      filter_doc_category: categoryId,
      filter_process_ids: processIds
    });

    if (error) {
      console.error('Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Hybrid search combining vector and keyword search
   * @param {string} query - Search query text
   * @param {Object} options - Search options
   */
  async hybridSearch(query, options = {}) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const {
      topK = this.defaultTopK,
      vectorWeight = 0.7,
      keywordWeight = 0.3,
      clientId = null
    } = options;

    // Generate query embedding
    const { embedding: queryEmbedding } = await this.generateEmbedding(query);

    // Call hybrid_search function
    const { data, error } = await supabase.rpc('hybrid_search', {
      query_embedding: JSON.stringify(queryEmbedding),
      query_text: query,
      match_count: topK,
      vector_weight: vectorWeight,
      keyword_weight: keywordWeight,
      filter_client_id: clientId
    });

    if (error) {
      console.error('Hybrid search error:', error);
      throw new Error(`Hybrid search failed: ${error.message}`);
    }

    return data || [];
  }

  // ============================================================================
  // CONVERSATIONS
  // ============================================================================

  /**
   * Create a new RAG conversation
   * @param {Object} params - Conversation parameters
   */
  async createConversation(params) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const {
      userId,
      clientId,
      title = null,
      categoryFilter = null,
      documentFilter = [],
      modelName = this.defaultLLMModel,
      topK = this.defaultTopK,
      threshold = this.defaultThreshold
    } = params;

    const { data, error } = await supabase
      .from('rag_conversations')
      .insert({
        userid: userId,
        client_id: clientId,
        title,
        doc_category_filter: categoryFilter,
        document_filter: documentFilter,
        model_name: modelName,
        top_k: topK,
        similarity_threshold: threshold
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return data;
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await supabase
      .from('rag_conversations')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (error) {
      throw new Error(`Failed to get conversation: ${error.message}`);
    }

    return data;
  }

  /**
   * List conversations for a user
   */
  async listConversations(userId, options = {}) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const { limit = 20, offset = 0, status = null } = options;

    let query = supabase
      .from('rag_conversations')
      .select('*')
      .eq('userid', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list conversations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId, options = {}) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const { limit = 50, offset = 0 } = options;

    const { data, error } = await supabase
      .from('rag_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get messages: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Add a message to conversation (internal use)
   */
  async addMessage(conversationId, message) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await supabase
      .from('rag_messages')
      .insert({
        conversation_id: conversationId,
        ...message
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add message: ${error.message}`);
    }

    return data;
  }

  // ============================================================================
  // RAG QUERY
  // ============================================================================

  /**
   * Send a message and get RAG-powered response
   * @param {string} conversationId - Conversation UUID
   * @param {string} userMessage - User's question/message
   * @returns {Object} Response with answer and sources
   */
  async chat(conversationId, userMessage) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    // Get conversation config
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Save user message
    await this.addMessage(conversationId, {
      role: 'user',
      content: userMessage
    });

    // Search for relevant chunks
    const searchOptions = {
      topK: conversation.top_k,
      threshold: parseFloat(conversation.similarity_threshold),
      clientId: conversation.client_id,
      categoryId: conversation.doc_category_filter,
      processIds: conversation.document_filter?.length > 0 ? conversation.document_filter : null
    };

    const relevantChunks = await this.search(userMessage, searchOptions);

    // Build context from chunks
    const context = relevantChunks.length > 0
      ? relevantChunks.map((c, i) =>
          `[Source ${i + 1}: ${c.doc_name}]\n${c.chunk_text}`
        ).join('\n\n---\n\n')
      : 'No relevant documents found.';

    // Get recent conversation history
    const history = await this.getMessages(conversationId, { limit: 10 });
    const recentHistory = history.slice(-10); // Last 10 messages

    // Build messages for LLM
    const systemPrompt = `You are a helpful assistant answering questions about documents.
Use the following context from the user's documents to answer their question.
If the answer is not found in the context, say so honestly.
Always cite which source document(s) you used.

Context from documents:
${context}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.slice(0, -1).map(m => ({ // Exclude last user message (we already added it)
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: userMessage }
    ];

    // Call LLM
    const llmResponse = await this._callLLM(messages, {
      model: conversation.model_name,
      temperature: parseFloat(conversation.temperature),
      maxTokens: conversation.max_tokens
    });

    // Calculate cost
    const costs = this.llmCosts[conversation.model_name] || { input: 0.15, output: 0.60 };
    const messageCost =
      (llmResponse.promptTokens / 1000000) * costs.input +
      (llmResponse.completionTokens / 1000000) * costs.output;

    // Save assistant response
    const assistantMessage = await this.addMessage(conversationId, {
      role: 'assistant',
      content: llmResponse.content,
      retrieved_chunks: relevantChunks.map(c => c.chunk_id),
      retrieval_scores: relevantChunks.map(c => c.similarity),
      prompt_tokens: llmResponse.promptTokens,
      completion_tokens: llmResponse.completionTokens,
      total_tokens: llmResponse.totalTokens,
      message_cost: messageCost
    });

    // Generate title if first message
    if (history.length <= 1) {
      const title = userMessage.length > 50
        ? userMessage.substring(0, 47) + '...'
        : userMessage;
      await supabase
        .from('rag_conversations')
        .update({ title })
        .eq('conversation_id', conversationId);
    }

    return {
      messageId: assistantMessage.message_id,
      answer: llmResponse.content,
      sources: relevantChunks.map(c => ({
        documentName: c.doc_name,
        chunkId: c.chunk_id,
        processId: c.process_id,
        similarity: c.similarity,
        preview: c.chunk_text.substring(0, 200) + (c.chunk_text.length > 200 ? '...' : '')
      })),
      tokens: {
        prompt: llmResponse.promptTokens,
        completion: llmResponse.completionTokens,
        total: llmResponse.totalTokens
      },
      cost: messageCost.toFixed(6)
    };
  }

  /**
   * Simple one-shot RAG query (no conversation)
   * @param {string} query - User's question
   * @param {Object} options - Query options
   */
  async query(query, options = {}) {
    const {
      clientId = null,
      categoryId = null,
      processIds = null,
      topK = this.defaultTopK,
      threshold = this.defaultThreshold,
      model = this.defaultLLMModel
    } = options;

    // Search for relevant chunks
    const relevantChunks = await this.search(query, {
      topK,
      threshold,
      clientId,
      categoryId,
      processIds
    });

    if (relevantChunks.length === 0) {
      return {
        answer: 'No relevant documents found to answer your question.',
        sources: [],
        tokens: { prompt: 0, completion: 0, total: 0 },
        cost: '0.000000'
      };
    }

    // Build context
    const context = relevantChunks.map((c, i) =>
      `[Source ${i + 1}: ${c.doc_name}]\n${c.chunk_text}`
    ).join('\n\n---\n\n');

    const systemPrompt = `You are a helpful assistant answering questions about documents.
Use the following context to answer the question. Cite your sources.

Context:
${context}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ];

    const llmResponse = await this._callLLM(messages, { model });

    const costs = this.llmCosts[model] || { input: 0.15, output: 0.60 };
    const totalCost =
      (llmResponse.promptTokens / 1000000) * costs.input +
      (llmResponse.completionTokens / 1000000) * costs.output;

    return {
      answer: llmResponse.content,
      sources: relevantChunks.map(c => ({
        documentName: c.doc_name,
        chunkId: c.chunk_id,
        processId: c.process_id,
        similarity: c.similarity,
        preview: c.chunk_text.substring(0, 200) + '...'
      })),
      tokens: {
        prompt: llmResponse.promptTokens,
        completion: llmResponse.completionTokens,
        total: llmResponse.totalTokens
      },
      cost: totalCost.toFixed(6)
    };
  }

  /**
   * Call LLM API
   */
  async _callLLM(messages, options = {}) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for LLM calls');
    }

    const {
      model = this.defaultLLMModel,
      temperature = 0.7,
      maxTokens = 1000
    } = options;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      return {
        content: response.data.choices[0].message.content,
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens,
        model: response.data.model
      };
    } catch (error) {
      console.error('LLM API error:', error.response?.data || error.message);
      throw new Error(`LLM call failed: ${error.message}`);
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Get RAG usage statistics for a client
   */
  async getUsageStats(clientId) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    // Get indexed documents count
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('process_id, status')
      .eq('client_id', clientId);

    const uniqueDocs = new Set(chunks?.map(c => c.process_id) || []);
    const embeddedChunks = chunks?.filter(c => c.status === 'embedded').length || 0;

    // Get conversation stats
    const { data: conversations } = await supabase
      .from('rag_conversations')
      .select('total_messages, total_tokens_used, total_cost')
      .eq('client_id', clientId);

    const totalConversations = conversations?.length || 0;
    const totalMessages = conversations?.reduce((sum, c) => sum + (c.total_messages || 0), 0) || 0;
    const totalTokens = conversations?.reduce((sum, c) => sum + (c.total_tokens_used || 0), 0) || 0;
    const totalCost = conversations?.reduce((sum, c) => sum + parseFloat(c.total_cost || 0), 0) || 0;

    return {
      clientId,
      indexedDocuments: uniqueDocs.size,
      totalChunks: chunks?.length || 0,
      embeddedChunks,
      totalConversations,
      totalMessages,
      totalTokens,
      totalCost: totalCost.toFixed(4)
    };
  }

  /**
   * Update conversation (title, status, etc.)
   */
  async updateConversation(conversationId, updates) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const allowedFields = ['title', 'status', 'model_name', 'temperature', 'max_tokens', 'top_k', 'similarity_threshold'];
    const filteredUpdates = {};

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    const { data, error } = await supabase
      .from('rag_conversations')
      .update(filteredUpdates)
      .eq('conversation_id', conversationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete conversation and all messages
   */
  async deleteConversation(conversationId) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const { error } = await supabase
      .from('rag_conversations')
      .delete()
      .eq('conversation_id', conversationId);

    if (error) {
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }

    return { deleted: true, conversationId };
  }

  /**
   * Rate a message (user feedback)
   */
  async rateMessage(messageId, rating, feedback = null) {
    const supabase = db.supabase;
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await supabase
      .from('rag_messages')
      .update({
        user_rating: rating,
        user_feedback: feedback
      })
      .eq('message_id', messageId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to rate message: ${error.message}`);
    }

    return data;
  }
}

// Export singleton instance
module.exports = new RAGService();
