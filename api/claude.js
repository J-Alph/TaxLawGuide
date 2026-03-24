export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
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
    const { system, messages, max_tokens } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // --- Convert messages to Gemini format ---
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text:
            typeof msg.content === 'string'
              ? msg.content
              : msg.content?.[0]?.text || '',
        },
      ],
    }));

    // --- Build request body ---
    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: max_tokens || 2000,
        temperature: 0.2,
        responseMimeType: 'application/json', // forces clean JSON output
      },
    };

    // Proper system instruction (no hacks)
    if (system) {
      body.systemInstruction = {
        parts: [{ text: system }],
      };
    }

    // --- Use CURRENT supported model ---
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API Error:', data);
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini API error',
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      console.error('Empty Gemini response:', data);
      return res.status(500).json({
        error: 'Empty response from Gemini',
      });
    }

    return res.status(200).json({
      content: [{ type: 'text', text }],
    });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}
