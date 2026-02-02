const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { db } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || ''
});

const LEGAL_ASSISTANT_PROMPT = `You are a helpful legal assistant for CiviSure, a public safety platform. Your role is to:

1. Provide general information about human rights and legal procedures
2. Guide users on how to file complaints and cases
3. Explain legal terminology in simple terms
4. Offer information about legal aid and resources
5. Help users understand their rights in various situations

Important guidelines:
- Always clarify that you provide general information, not legal advice
- Encourage users to consult with licensed attorneys for specific legal matters
- Be empathetic and supportive, especially for victims of crime
- Provide accurate, helpful information based on general legal principles
- If asked about specific cases, remind users to seek professional legal counsel
- Focus on human rights, criminal law basics, and legal procedures

Be concise, clear, and helpful. Use simple language that everyone can understand.`;

router.post('/message', requireAuth, async (req, res) => {
    try {
        const { message, conversationHistory = [] } = req.body;

        if (!message || message.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(503).json({
                success: false,
                message: 'Chatbot service is not configured. Please set ANTHROPIC_API_KEY in environment variables.'
            });
        }

        const messages = conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        messages.push({
            role: 'user',
            content: message
        });

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: LEGAL_ASSISTANT_PROMPT,
            messages: messages
        });

        const assistantMessage = response.content[0].text;

        const stmt = db.prepare(`
            INSERT INTO chat_conversations (user_id, message, response)
            VALUES (?, ?, ?)
        `);
        stmt.run(req.session.userId, message, assistantMessage);

        res.json({
            success: true,
            response: assistantMessage,
            conversationId: response.id
        });

    } catch (error) {
        console.error('Chatbot error:', error);
        
        if (error.status === 401) {
            return res.status(503).json({
                success: false,
                message: 'Invalid API key. Please check your Anthropic API configuration.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to get response from legal assistant. Please try again.'
        });
    }
});

router.get('/history', requireAuth, (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const conversations = db.prepare(`
            SELECT id, message, response, created_at
            FROM chat_conversations
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `).all(req.session.userId, parseInt(limit));

        res.json({
            success: true,
            conversations
        });

    } catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch chat history'
        });
    }
});

router.delete('/history', requireAuth, (req, res) => {
    try {
        db.prepare('DELETE FROM chat_conversations WHERE user_id = ?').run(req.session.userId);

        res.json({
            success: true,
            message: 'Chat history cleared'
        });

    } catch (error) {
        console.error('Clear chat history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear chat history'
        });
    }
});

router.get('/suggestions', (req, res) => {
    const suggestions = [
        "What are my basic human rights?",
        "How do I file an FIR (First Information Report)?",
        "What should I do if I'm a victim of theft?",
        "What is the process for filing a complaint against police misconduct?",
        "How can I get legal aid if I can't afford a lawyer?",
        "What are my rights during police questioning?",
        "How do I report domestic violence?",
        "What is the difference between bailable and non-bailable offenses?",
        "What are consumer rights and how do I file a complaint?",
        "How can I check the status of my case?"
    ];

    res.json({
        success: true,
        suggestions
    });
});

module.exports = router;