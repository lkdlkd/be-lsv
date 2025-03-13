// server/server.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./database/connection');
const apiRouter = require('./routes/server/Getdichvu');
const smmRoutes = require('./routes/Smm/smmRoutes');
require('./controllers/tool/updateServicePrices');
require('./controllers/tool/checkOrderStatus');

const apiuser = require('./routes/user/user');


const order = require('./routes/order/orderRouter');
const bank = require('./routes/BankingRouter');
const apiRouters = require('./routes/document/apiRouters');

const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Kết nối MongoDB
connectDB();

// Sử dụng routes cho tool
const toolRoutes = require("./routes/getuidRoutes");
app.use("/api/tool", toolRoutes);

app.use('/api', bank);
app.use('/api', apiRouters);

app.use('/api/order', order);

// Routes
app.use('/api/user', apiuser);

// Use API Router
app.use('/api/server', apiRouter);

//Smm router 
// Sử dụng router
app.use("/api/smm", smmRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));


