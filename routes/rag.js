const express = require('express');
const router = express.Router();
const ragService = require('../services/ragService');
const { verifyToken, checkRole } = require('../middleware/auth');
const db = require('../config/database');

// ============================================================================
// DOCUMENT INDEXING
// ============================================================================

/**
 * POST /api/rag/index/:processId
 * Index a document for RAG (chunk and embed)
 */
router.post('/index/:processId', verifyToken, async (req, res) => {
  try {
    const processId = parseInt(req.params.processId);
    const { chunkSize, overlap, method, reindex } = req.body;

    // Verify user has access to this document
    const supabase = db.supabase;
    const { data: doc, error } = await supabase
      .from('document_processed')
      .select('process_id, client_id, userid')
      .eq('process_id', processId)
      .single();

    if (error || !doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check access (user owns doc or same client)
    if (doc.userid !== req.user.userid && doc.client_id !== req.user.client_id) {
      if (!['admin', 'superadmin'].includes(req.user.user_role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Get document text (from extracted_data or link_to_json)
    const { data: extracted } = await supabase
      .from('extracted_data')
      .select('row_data')
      .eq('process_id', processId);

    let documentText = '';
    if (extracted && extracted.length > 0) {
      // Combine all extracted data into text
      documentText = extracted.map(e => {
        if (typeof e.row_data === 'string') return e.row_data;
        return Object.entries(e.row_data)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
      }).join('\n\n');
    }

    if (!documentText || documentText.length < 50) {
      // Try to get from request body
      if (req.body.text) {
        documentText = req.body.text;
      } else {
        return res.status(400).json({
          success: false,
          message: 'No document text available. Provide text in request body or ensure document has extracted data.'
        });
      }
    }

    const result = await ragService.indexDocument(processId, documentText, {
      chunkSize,
      overlap,
      method,
      reindex
    });

    res.json({
      success: true,
      message: 'Document indexed successfully',
      data: result
    });
  } catch (error) {
    console.error('Index document error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/rag/index/:processId
 * Remove document from RAG index
 */
router.delete('/index/:processId', verifyToken, async (req, res) => {
  try {
    const processId = parseInt(req.params.processId);

    // Verify access
    const supabase = db.supabase;
    const { data: doc } = await supabase
      .from('document_processed')
      .select('process_id, client_id, userid')
      .eq('process_id', processId)
      .single();

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    if (doc.userid !== req.user.userid && doc.client_id !== req.user.client_id) {
      if (!['admin', 'superadmin'].includes(req.user.user_role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const result = await ragService.removeDocumentIndex(processId);

    res.json({
      success: true,
      message: 'Document removed from index',
      data: result
    });
  } catch (error) {
    console.error('Remove index error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/rag/index/:processId/status
 * Get indexing status for a document
 */
router.get('/index/:processId/status', verifyToken, async (req, res) => {
  try {
    const processId = parseInt(req.params.processId);
    const result = await ragService.getIndexStatus(processId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get index status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================================================
// SEARCH
// ============================================================================

/**
 * POST /api/rag/search
 * Search documents using vector similarity
 */
router.post('/search', verifyToken, async (req, res) => {
  try {
    const {
      query,
      topK,
      threshold,
      categoryId,
      processIds
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    const results = await ragService.search(query, {
      topK: topK || 5,
      threshold: threshold || 0.7,
      clientId: req.user.client_id,
      categoryId,
      processIds
    });

    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/rag/hybrid-search
 * Hybrid search combining vector and keyword search
 */
router.post('/hybrid-search', verifyToken, async (req, res) => {
  try {
    const {
      query,
      topK,
      vectorWeight,
      keywordWeight
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    const results = await ragService.hybridSearch(query, {
      topK: topK || 5,
      vectorWeight: vectorWeight || 0.7,
      keywordWeight: keywordWeight || 0.3,
      clientId: req.user.client_id
    });

    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length
      }
    });
  } catch (error) {
    console.error('Hybrid search error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================================================
// ONE-SHOT QUERY
// ============================================================================

/**
 * POST /api/rag/query
 * Simple one-shot RAG query (no conversation)
 */
router.post('/query', verifyToken, async (req, res) => {
  try {
    const {
      query,
      categoryId,
      processIds,
      topK,
      threshold,
      model
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    const result = await ragService.query(query, {
      clientId: req.user.client_id,
      categoryId,
      processIds,
      topK,
      threshold,
      model
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('RAG query error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * POST /api/rag/conversations
 * Create a new RAG conversation
 */
router.post('/conversations', verifyToken, async (req, res) => {
  try {
    const {
      title,
      categoryFilter,
      documentFilter,
      modelName,
      topK,
      threshold
    } = req.body;

    const conversation = await ragService.createConversation({
      userId: req.user.userid,
      clientId: req.user.client_id,
      title,
      categoryFilter,
      documentFilter,
      modelName,
      topK,
      threshold
    });

    res.status(201).json({
      success: true,
      message: 'Conversation created',
      data: conversation
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/rag/conversations
 * List user's conversations
 */
router.get('/conversations', verifyToken, async (req, res) => {
  try {
    const { limit, offset, status } = req.query;

    const conversations = await ragService.listConversations(req.user.userid, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      status
    });

    res.json({
      success: true,
      data: conversations,
      count: conversations.length
    });
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/rag/conversations/:conversationId
 * Get conversation details
 */
router.get('/conversations/:conversationId', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await ragService.getConversation(conversationId);

    // Verify ownership
    if (conversation.userid !== req.user.userid) {
      if (!['admin', 'superadmin'].includes(req.user.user_role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * PATCH /api/rag/conversations/:conversationId
 * Update conversation settings
 */
router.patch('/conversations/:conversationId', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Verify ownership
    const conversation = await ragService.getConversation(conversationId);
    if (conversation.userid !== req.user.userid) {
      if (!['admin', 'superadmin'].includes(req.user.user_role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const updated = await ragService.updateConversation(conversationId, req.body);

    res.json({
      success: true,
      message: 'Conversation updated',
      data: updated
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/rag/conversations/:conversationId
 * Delete a conversation
 */
router.delete('/conversations/:conversationId', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Verify ownership
    const conversation = await ragService.getConversation(conversationId);
    if (conversation.userid !== req.user.userid) {
      if (!['admin', 'superadmin'].includes(req.user.user_role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    await ragService.deleteConversation(conversationId);

    res.json({
      success: true,
      message: 'Conversation deleted'
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================================================
// MESSAGES / CHAT
// ============================================================================

/**
 * GET /api/rag/conversations/:conversationId/messages
 * Get messages for a conversation
 */
router.get('/conversations/:conversationId/messages', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit, offset } = req.query;

    // Verify ownership
    const conversation = await ragService.getConversation(conversationId);
    if (conversation.userid !== req.user.userid) {
      if (!['admin', 'superadmin'].includes(req.user.user_role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const messages = await ragService.getMessages(conversationId, {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.json({
      success: true,
      data: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/rag/conversations/:conversationId/messages
 * Send a message and get RAG response
 */
router.post('/conversations/:conversationId/messages', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Verify ownership
    const conversation = await ragService.getConversation(conversationId);
    if (conversation.userid !== req.user.userid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const response = await ragService.chat(conversationId, message);

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/rag/messages/:messageId/rate
 * Rate a message (user feedback)
 */
router.post('/messages/:messageId/rate', verifyToken, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const updated = await ragService.rateMessage(messageId, rating, feedback);

    res.json({
      success: true,
      message: 'Rating saved',
      data: updated
    });
  } catch (error) {
    console.error('Rate message error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * GET /api/rag/stats
 * Get RAG usage statistics for current user's client
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const stats = await ragService.getUsageStats(req.user.client_id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/rag/stats/:clientId
 * Get RAG usage statistics for a specific client (admin only)
 */
router.get('/stats/:clientId', verifyToken, checkRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const stats = await ragService.getUsageStats(clientId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get client stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
