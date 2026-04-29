const dns = require("dns");
dns.setServers(["1.1.1.1", "1.0.0.1"]);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express(); 

const userRoutes = require("./routes/user");
const productRoutes = require("./routes/product");
const cartRoutes = require("./routes/cart");
const orderRoutes = require('./routes/order');
const paymentRoutes = require('./routes/payment'); 
const paymentController = require("./controllers/payment");


app.post(
  "/payments/webhook", 
  express.raw({ type: "application/json" }), 
  paymentController.handleStripeWebhook
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGODB_STRING);
mongoose.connection.once("open", () => console.log("Now connected to MongoDB Atlas."));

app.use("/users", userRoutes);
app.use("/products", productRoutes);
app.use("/cart", cartRoutes);
app.use('/orders', orderRoutes);
app.use('/payments', paymentRoutes);


module.exports = { app, mongoose };