exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured on server.' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) }; }

  const { title, transcript } = body;
  if (!title || !transcript) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing title or transcript.' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Summarize this All-In Podcast episode for an archive.

Title: "${title}"

Transcript:
${transcript.substring(0, 22000)}

Reply ONLY with a raw JSON object, no markdown, no fences:
{
  "summary": "2-3 sentence overview",
  "date": "YYYY-MM-DD if mentioned, else null",
  "topics": ["topic1","topic2","topic3","topic4"],
  "speakers": ["name1","name2"],
  "segments": [
    {"title": "Segment name", "bullets": ["Specific point 1","Specific point 2","Specific point 3"]}
  ]
}
Use 4-7 segments with 3-5 bullets each. Be specific — extract real claims, arguments, numbers, predictions.`
        }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.content.map(b => b.text || '').join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };
  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
