

    const axios = require('axios');

// Define the API details
const url = "https://wsalla.com/Install/api/get/wa.groups";
const params = {
    secret: "bb49eddbbba84ddffd1c6a2731a64d3b1ac9658f",
    unique: "1747330934c4ca4238a0b923820dcc509a6f75849b68262776a9941"
};

// Make the GET request
axios.get(url, { params })
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