// models/Order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    productsOrdered: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: String,
        quantity: Number,
        price: Number,
      },
    ],

    totalPrice: { type: Number, required: true, min: 0 },
    orderedOn: { type: Date, default: Date.now },

    status: { type: String, default: "Pending" },

    stripeSessionId: { type: String, default: "", index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    receiptUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

// ✅ Prevent OverwriteModelError during nodemon reloads
module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
