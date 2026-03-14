fetch('http://127.0.0.1:3000/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'admin@sairex-sms.com' }),
})
  .then(async (r) => {
    console.log('STATUS', r.status);
    console.log(await r.text());
    process.exit(0);
  })
  .catch((e) => {
    console.log('ERR', e && e.message ? e.message : e);
    process.exit(1);
  });
