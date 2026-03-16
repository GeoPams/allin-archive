exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const NOTION_KEY = process.env.NOTION_KEY;
  const NOTION_DB = process.env.NOTION_DB;
  if (!NOTION_KEY || !NOTION_DB) return { statusCode: 500, body: JSON.stringify({ error: 'Notion credentials not configured.' }) };
  let ep;
  try { ep = JSON.parse(event.body); } catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid body.' }) }; }

  const segmentBlocks = (ep.segments || []).flatMap(seg => [
    { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: seg.title || '' } }] } },
    ...(seg.bullets || []).map(b => ({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: b } }] } }))
  ]);

  const body = {
    parent: { database_id: NOTION_DB },
    properties: {
      Name: { title: [{ text: { content: ep.title || 'Untitled' } }] },
      Date: ep.date ? { date: { start: ep.date } } : { date: null },
      Speakers: { multi_select: (ep.speakers || []).map(s => ({ name: s })) },
      Topics: { multi_select: (ep.topics || []).map(t => ({ name: t })) },
      Summary: { rich_text: [{ text: { content: ep.summary || '' } }] },
      ...(ep.url ? { URL: { url: ep.url } } : {})
    },
    children: [
      { object: 'block', type: 'callout', callout: { rich_text: [{ type: 'text', text: { content: ep.summary || '' } }], icon: { emoji: '🎙️' } } },
      ...segmentBlocks
    ]
  };

  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + NOTION_KEY, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || JSON.stringify(data));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: data.url, id: data.id }) };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
