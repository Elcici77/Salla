// bb49eddbbba84ddffd1c6a2731a64d3b1ac9658f
//+20 10 05890624
const axios = require('axios');
const FormData = require('form-data');

// Define the API details
const url = "https://wsalla.com/Install/api/send/whatsapp";
const form = new FormData();
form.append('secret', 'bb49eddbbba84ddffd1c6a2731a64d3b1ac9658f');
form.append('account', '1751193053c4ca4238a0b923820dcc509a6f75849b686115dd94aea');
form.append('recipient', '201040894353');
form.append('type', 'text');
form.append('message', 'تم إلغاء الاشتراك بنجاح');

// Make the POST request
axios.post(url, form, { headers: form.getHeaders() })
    .then(response => {
        console.log("Success:", response.data);
    })
    .catch(error => {
        if (error.response) {
            console.error("Error:", error.response.status, error.response.data);
        } else {
            console.error("Error:", error.message);
        }
    });