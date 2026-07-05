const { fetchBatch } = require('./fetch-batch');
const { generateDigest } = require('./summarize');

async function main() {
  console.log('Fetching batch...');
  const batch = await fetchBatch('2d');
  console.log(`Fetched ${batch.length} emails. Sending to Claude...`);

  const digest = await generateDigest(batch);
  console.log(JSON.stringify(digest, null, 2));
}

main().catch(err => console.error('Error:', err.message));
