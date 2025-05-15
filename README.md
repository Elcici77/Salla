# Salla
**to create a module**

1. **in routes folder**  
   - make new file similar to whatsapp.js  
   - change controller name to your new controller  
   - keep same structure but update references  

2. **create controller**  
   - make new controller file  
   - follow same pattern as whatsapp controller  
   - update class name and methods  

3. **create service file**  
   - make new file in services folder  
   - name it yourFile.service.js  
   - follow whatsapp service structure  

4. **go to server.js**  
   - add const for your new routes like:  
     `const yourRoutes = require("./routes/yourFile");`  
   - add route middleware:  
     `app.use("/api/yourEndpoint", yourRoutes);`  

**key points**  
- follow same patterns as whatsapp.js  
- only change names and references  
- keep same file structure  
- update all required paths
