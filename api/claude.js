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

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const geminiMessages = [];

    // System instructions
    if (system) {
      geminiMessages.push({
        role: 'user',
        parts: [{
          text:
            `SYSTEM INSTRUCTIONS:\n${system}\n\n` +
            `CRITICAL: Respond with RAW JSON only. No markdown, no backticks, no code fences.`
        }]
      });

      geminiMessages.push({
        role: 'assistant',
        parts: [{ text: 'Understood. I will respond with raw JSON only.' }]
      });
    }

    // Convert conversation messages
    for (const msg of messages) {
      geminiMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        parts: [{
          text:
            typeof msg.content === 'string'
              ? msg.content
              : msg.content?.[0]?.text || ''
        }]
      });
    }

    const url =
      `https://generativelanguage.googleapis.com/v1/models/` +
      `gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: max_tokens || 2500,
          temperature: 0.2
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini error:', JSON.stringify(data));
      return res
        .status(response.status)
        .json({ error: data.error?.message || 'Gemini API error' });
    }

    // Extract text safely
    let text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "I could not generate a response. Please try rephrasing your question.";

    if (!text || typeof text !== "string") {
      console.error("Invalid Gemini response:", JSON.stringify(data));
      return res
        .status(500)
        .json({ error: "Invalid response format from Gemini" });
    }

    // Clean markdown if Gemini ignored instructions
    text = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // Extract JSON object if wrapped in extra text
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      text = text.slice(start, end + 1);
    }

    // Final output to frontend
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
