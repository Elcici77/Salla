const crypto = require('crypto');

const secret = '36e9127d3e3548e43147548af7fd3eeb'; // انسخه من .env
const body = JSON.stringify({
  event: "order.created",
  data: {
    id: 12345
  }
});

const signature = crypto.createHmac('sha256', secret)
  .update(body)
  .digest('hex');

console.log('x-salla-signature:', signature);
console.log('Body to use in Postman:', body);
