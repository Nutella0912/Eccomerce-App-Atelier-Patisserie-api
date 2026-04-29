const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    cartItems: [
        {
            productId: { type: String, required: true },
            quantity: { type: Number, required: true },
            subtotal: { type: Number, required: true }
        }
    ],
    totalPrice: { type: Number, required: true },
    orderedOn: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Cart", cartSchema);