require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

console.log('API Key loaded:', process.env.ANTHROPIC_API_KEY ? 'YES' : 'NO');

const client = new Anthropic();

async function main() {
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Say "setup successful" and nothing else.' }
      ]
    });
    console.log(message.content[0].text);
  } catch (error) {
    console.log('Error:', error.message);
  }
}

main();