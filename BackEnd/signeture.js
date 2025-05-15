const crypto = require('crypto');
const secret = '36e9127d3e3548e43147548af7fd3eeb'; // استبدلها بالسر الفعلي
const payload = JSON.stringify({
  event: "order.created",
  data: { id: "TEST_123", customer: { name: "Test", mobile: "0512345678" } }
});

const signature = crypto.createHmac('sha256', secret)
                      .update(payload)
                      .digest('hex');
console.log('X-Salla-Signature:', signature);

