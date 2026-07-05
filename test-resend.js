require('dotenv').config();

async function main() {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: process.env.RESEND_TO_EMAIL,
      subject: 'Morning Brief — test email',
      html: '<p>This is a test email confirming Resend delivery works.</p>',
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Error:', data.message || data);
    return;
  }

  console.log('Success. Email sent, id:', data.id);
}

main();
