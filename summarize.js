require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';

const DIGEST_SCHEMA = {
  name: 'output_digest',
  description: 'Outputs the structured Morning Brief digest sections.',
  input_schema: {
    type: 'object',
    properties: {
      world: {
        type: 'array',
        description: 'Biggest geopolitical, crisis, and macro stories.',
        items: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            narrative: { type: 'string', description: 'The core news, 2-4 sentences.' },
            context: { type: 'string', description: 'Background for a reader without deep geopolitical knowledge. Will be italicized. 1-3 sentences.' },
            sourceName: { type: 'string' },
            link: { type: 'string', description: 'The article URL from the AVAILABLE LINKS list for this article. Empty string if none apply.' },
          },
          required: ['headline', 'narrative', 'context', 'sourceName', 'link'],
        },
      },
      marketsAndDeals: {
        type: 'array',
        description: 'Macro moves and notable deals, explaining deal structure/parties/size at a high level.',
        items: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            body: { type: 'string', description: '4-6 sentences.' },
            sourceName: { type: 'string' },
            link: { type: 'string', description: 'The article URL from the AVAILABLE LINKS list for this article. Empty string if none apply.' },
          },
          required: ['headline', 'body', 'sourceName', 'link'],
        },
      },
      aiAndTech: {
        type: 'array',
        description: 'Key AI/tech developments, new products, interesting builds. Explain unfamiliar things.',
        items: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            body: { type: 'string', description: '4-6 sentences.' },
            sourceName: { type: 'string' },
            link: { type: 'string', description: 'The article URL from the AVAILABLE LINKS list for this article. Empty string if none apply.' },
          },
          required: ['headline', 'body', 'sourceName', 'link'],
        },
      },
      interesting: {
        type: 'array',
        description: 'One-liner headlines on anything genuinely curious or surprising. No write-up.',
        items: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            sourceName: { type: 'string' },
            link: { type: 'string', description: 'The article URL from the AVAILABLE LINKS list for this article. Empty string if none apply.' },
          },
          required: ['headline', 'sourceName', 'link'],
        },
      },
      company: {
        type: 'object',
        description: 'One company/startup: what they do, why interesting now, one surprising fact. Not necessarily from today\'s news.',
        properties: {
          name: { type: 'string' },
          body: { type: 'string', description: '4-5 sentences.' },
        },
        required: ['name', 'body'],
      },
      upcoming: {
        type: 'array',
        description: 'Notable things happening today/this week: earnings, Fed meetings, major events, geopolitical flashpoints.',
        items: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            body: { type: 'string', description: '1-2 sentences on timing/why it matters.' },
          },
          required: ['headline', 'body'],
        },
      },
    },
    required: ['world', 'marketsAndDeals', 'aiAndTech', 'interesting', 'company', 'upcoming'],
  },
};

function buildPrompt(batch) {
  const bySource = batch
    .map((item, i) => {
      const linkList = (item.links || [])
        .map(l => `  - "${l.label}" -> ${l.url}`)
        .join('\n');
      return (
        `--- ARTICLE ${i + 1} ---\n` +
        `Source: ${item.sourceName} (Tier ${item.tier})\n` +
        `Subject: ${item.subject}\n` +
        `Content:\n${item.text}\n` +
        (linkList ? `AVAILABLE LINKS FOR ARTICLE ${i + 1}:\n${linkList}\n` : '')
      );
    })
    .join('\n');

  return `You are assembling "Morning Brief," a daily personalized news digest. Below is the raw text of every newsletter email received in the last day, already tagged with its source and priority tier.

TIER RULES:
- Tier 1 sources are anchors — always prioritize their coverage of a story.
- Tier 2 sources only fill gaps Tier 1 didn't cover — don't duplicate a story Tier 1 already covers well.
- Tier 3 sources are weekly/feature content — use at most once, don't repeat the same feature.
- Hard deduplicate: if multiple sources cover the same story, synthesize the single best version (prefer the higher tier), don't list it twice.

FILTERING RULES — skip entirely:
- Opinion/analysis columns and pure editorializing
- Anything overly political without broader business/world significance
- Lifestyle fluff, generic advice, quizzes, puzzles
- Pure advertisements or newsletter housekeeping (subscribe/unsubscribe/ad blurbs)

AUDIENCE & VOICE:
Write for a sharp, well-educated reader who knows business and finance well but needs brief context on geopolitics, tech infrastructure, and new AI products/companies they may not have encountered. Be straight to the point with some storytelling texture — not dry, not padded. Never reference "this newsletter," any author, or that this was written/summarized by AI. Never say things like "according to the source" — just state facts and name the org/person when relevant.

SECTIONS TO PRODUCE (in this order):
1. World — biggest geopolitical/crisis/macro stories. Each: a narrative (the news itself, 2-4 sentences) plus a separate context passage (background a business-savvy but not geopolitics-expert reader needs, 1-3 sentences) — these render separately, with context italicized, so keep them genuinely distinct rather than blended.
2. Markets & deals — macro moves and notable deals. Explain deal structure, parties, and size at a high level, 4-6 sentences.
3. AI & tech — key developments, new products, interesting builds. Explain unfamiliar concepts/products briefly, 4-6 sentences.
4. Interesting — one-liner headlines only, anything genuinely curious or surprising. No write-up, just the headline.
5. Company — exactly one company or startup: what they do, why they're interesting right now, and one surprising fact, 4-5 sentences. This does not need to come from today's news — evergreen is fine if nothing from today's batch stands out.
6. Upcoming — notable things happening today or this week: earnings, Fed meetings, major events, geopolitical flashpoints. Pull directly from any "week ahead"-style content in the batch if present.

LINKS: Each article's raw material is followed by an "AVAILABLE LINKS" list of (label -> url) pairs pulled from that email. For every story you write in World, Markets & Deals, AI & Tech, or Interesting, find the link whose label best matches that story's headline/topic and use its url as the "link" field. If a story combines multiple source articles, pick the link from whichever source you leaned on most. If truly nothing in the list matches, use an empty string rather than guessing or inventing a URL — never fabricate a link.

Only include genuinely substantive items — it's fine for a section to be shorter than usual if the source material doesn't support more, but do not pad with filler or invented stories.

Here is the raw material:

${bySource}`;
}

// Claude occasionally serializes a nested array/object field as an escaped
// JSON string instead of native structure. Defensively parse those back.
function normalizeField(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function generateDigest(batch) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    tools: [DIGEST_SCHEMA],
    tool_choice: { type: 'tool', name: 'output_digest' },
    messages: [{ role: 'user', content: buildPrompt(batch) }],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === 'max_tokens') {
    throw new Error('Claude response was truncated (hit max_tokens) — digest is incomplete.');
  }

  const toolUse = message.content.find(block => block.type === 'tool_use');
  if (!toolUse) throw new Error('Claude did not return a tool_use block.');

  const raw = toolUse.input;
  return {
    world: normalizeField(raw.world),
    marketsAndDeals: normalizeField(raw.marketsAndDeals),
    aiAndTech: normalizeField(raw.aiAndTech),
    interesting: normalizeField(raw.interesting),
    company: normalizeField(raw.company),
    upcoming: normalizeField(raw.upcoming),
  };
}

module.exports = { generateDigest };
