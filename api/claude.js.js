export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    // Convert Anthropic-style request to Gemini format
    const { system, messages, max_tokens } = req.body;

    const geminiMessages = [];

    // Add system prompt as first user message if present
    if (system) {
      geminiMessages.push({
        role: 'user',
        parts: [{ text: `SYSTEM INSTRUCTIONS:\n${system}` }]
      });
      geminiMessages.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow those instructions.' }]
      });
    }

    // Add conversation messages
    for (const msg of messages) {
      geminiMessages.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || '' }]
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            maxOutputTokens: max_tokens || 2500,
            temperature: 0.3,
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
    }

    // Convert Gemini response back to Anthropic-style format
    // so the HTML doesn't need any changes
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
