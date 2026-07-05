const { getClippersUpdate, findClippersGame, getClippersStanding } = require('./clippers');

async function main() {
  console.log('--- Live check (today/yesterday) -- expect null, NBA is in the off-season ---');
  console.log(await getClippersUpdate());

  console.log('\n--- Historical game check (Jan 10, 2026 -- known Clippers win vs Pistons) ---');
  console.log(await findClippersGame('20260110'));

  console.log('\n--- Current standing/streak (works year-round, reflects end of season) ---');
  console.log(await getClippersStanding());
}

main().catch(err => console.error('Error:', err.message));
