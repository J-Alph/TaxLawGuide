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
    const { system, messages, max_tokens } = req.body;

    const geminiMessages = [];

    if (system) {
      geminiMessages.push({
        role: 'user',
        parts: [{ text: `SYSTEM INSTRUCTIONS:\n${system}\n\nCRITICAL: Your response must be raw JSON only. No markdown, no backticks, no \`\`\`json, no code blocks. Just the JSON object starting with { and ending with }.` }]
      });
      geminiMessages.push({
        role: 'model',
        parts: [{ text: 'Understood. I will respond with raw JSON only, no markdown or code blocks.' }]
      });
    }

    for (const msg of messages) {
      geminiMessages.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || '' }]
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: max_tokens || 2500,
          temperature: 0.2,
        }
      })
    });

    const geminiData = await geminiRes.json();

    if (!response.ok) {
      console.error('Gemini error:', JSON.stringify(data));
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      console.error('Empty Gemini response:', JSON.stringify(data));
      return res.status(500).json({ error: 'Empty response from Gemini' });
    }

    // Aggressively clean any markdown wrapping Gemini adds
    text = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // Find the JSON object in the response
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }

    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
