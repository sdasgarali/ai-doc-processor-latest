const axios = require('axios');

/**
 * AI Service for document analysis and field schema generation
 * Supports multiple providers: OpenAI, Groq, Anthropic, Local LLM (Ollama)
 */

class AIService {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'groq';
    this.fallbackEnabled = process.env.AI_FALLBACK_ENABLED === 'true';
  }

  /**
   * Get AI client configuration based on provider
   */
  getProviderConfig() {
    switch (this.provider) {
      case 'openai':
        return {
          url: 'https://api.openai.com/v1/chat/completions',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          model: process.env.OPENAI_MODEL || 'gpt-4'
        };
      case 'anthropic':
        return {
          url: 'https://api.anthropic.com/v1/messages',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
        };
      case 'groq':
        return {
          url: 'https://api.groq.com/openai/v1/chat/completions',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile'
        };
      case 'local':
      default:
        return {
          url: `${process.env.LOCAL_LLM_URL || 'http://localhost:11434'}/api/chat`,
          headers: { 'Content-Type': 'application/json' },
          model: process.env.LOCAL_LLM_MODEL || 'llama3.1:70b'
        };
    }
  }

  /**
   * Call AI API with fallback support
   */
  async callAI(messages, options = {}) {
    const config = this.getProviderConfig();

    try {
      let response;

      if (this.provider === 'anthropic') {
        // Anthropic has different API format
        response = await axios.post(config.url, {
          model: config.model,
          max_tokens: options.maxTokens || 4096,
          messages: messages.map(m => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.role === 'system' ? `[System]: ${m.content}` : m.content
          }))
        }, { headers: config.headers, timeout: 120000 });

        return {
          content: response.data.content[0].text,
          model: config.model,
          provider: this.provider,
          usage: response.data.usage
        };
      } else if (this.provider === 'local') {
        // Ollama format
        response = await axios.post(config.url, {
          model: config.model,
          messages,
          stream: false
        }, { headers: config.headers, timeout: 180000 });

        return {
          content: response.data.message.content,
          model: config.model,
          provider: this.provider,
          usage: null
        };
      } else {
        // OpenAI-compatible format (OpenAI, Groq)
        response = await axios.post(config.url, {
          model: config.model,
          messages,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.3
        }, { headers: config.headers, timeout: 120000 });

        return {
          content: response.data.choices[0].message.content,
          model: config.model,
          provider: this.provider,
          usage: response.data.usage
        };
      }
    } catch (error) {
      console.error(`AI API error (${this.provider}):`, error.message);

      // Try fallback to local LLM
      if (this.fallbackEnabled && this.provider !== 'local') {
        console.log('Attempting fallback to local LLM...');
        this.provider = 'local';
        return this.callAI(messages, options);
      }

      throw error;
    }
  }

  /**
   * Analyze a document and suggest field schema
   */
  async analyzeDocumentForFields(documentText, userDescription, expectedFields = []) {
    const systemPrompt = `You are an expert document analyzer. Your task is to analyze a document and suggest a field schema for data extraction.

Based on the provided document content and user description, generate a JSON schema for extracting structured data.

For each field, provide:
1. field_name: snake_case identifier (e.g., patient_name, claim_number)
2. field_display_name: Human-readable name (e.g., "Patient Name", "Claim Number")
3. field_type: One of: string, number, date, boolean, currency, array
4. is_required: true if the field is essential
5. description: Brief description of what this field captures
6. sample_values: 2-3 example values from the document if found

IMPORTANT:
- Always include common document metadata fields (document_date, page_number, etc.)
- Prioritize fields mentioned in the user's description
- If expected fields are provided, ensure they are included
- Return ONLY valid JSON, no markdown formatting`;

    const userPrompt = `Document Description from User:
${userDescription}

${expectedFields.length > 0 ? `Expected Fields (user specified):
${expectedFields.join(', ')}

` : ''}Document Content (sample):
${documentText.substring(0, 8000)}${documentText.length > 8000 ? '\n... (truncated)' : ''}

Please analyze this document and suggest a comprehensive field schema for data extraction. Return as JSON array with the structure specified.`;

    const response = await this.callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { maxTokens: 4096, temperature: 0.3 });

    // Parse JSON from response
    let suggestedFields;
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      let jsonStr = response.content;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      suggestedFields = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      suggestedFields = [];
    }

    return {
      suggestedFields,
      aiResponse: response.content,
      model: response.model,
      provider: response.provider,
      usage: response.usage
    };
  }

  /**
   * Generate field mapping suggestions from document
   */
  async suggestFieldMappings(documentText, existingFields) {
    const systemPrompt = `You are a document field mapping expert. Given document content and a list of existing fields, suggest which parts of the document correspond to each field.

Return a JSON object mapping field_name to suggested extraction patterns or locations.`;

    const userPrompt = `Existing Fields:
${JSON.stringify(existingFields, null, 2)}

Document Content:
${documentText.substring(0, 6000)}

Provide field mapping suggestions as JSON.`;

    const response = await this.callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { maxTokens: 2048, temperature: 0.2 });

    let mappings;
    try {
      let jsonStr = response.content;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      mappings = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      mappings = {};
    }

    return { mappings, model: response.model };
  }

  /**
   * Validate extracted data against expected schema
   */
  async validateExtraction(extractedData, fieldSchema, documentType) {
    const systemPrompt = `You are a data validation expert. Analyze the extracted data against the expected schema and identify any issues.

Return a JSON object with:
- isValid: boolean
- issues: array of { field, issue, severity: 'error'|'warning'|'info' }
- suggestions: array of improvement suggestions`;

    const userPrompt = `Document Type: ${documentType}

Expected Schema:
${JSON.stringify(fieldSchema, null, 2)}

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Validate and provide feedback.`;

    const response = await this.callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { maxTokens: 2048, temperature: 0.2 });

    let validation;
    try {
      let jsonStr = response.content;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      validation = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      validation = { isValid: true, issues: [], suggestions: [] };
    }

    return validation;
  }
}

// Export singleton instance
module.exports = new AIService();
