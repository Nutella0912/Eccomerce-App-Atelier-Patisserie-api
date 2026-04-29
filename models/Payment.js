// models/Payment.js
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    amount: { type: Number, required: true, min: 0 },

    method: {
      type: String,
      enum: ["stripe", "card", "gcash", "bank", "saved_card", "saved_gcash"],
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      index: true,
    },

    referenceNumber: { type: String, default: "", trim: true },
    transactionId: { type: String, default: "", trim: true, index: true },
    receiptUrl: { type: String, default: "", trim: true },
    receiptPdfUrl: { type: String, default: "", trim: true },
    adminNote: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

paymentSchema.index({ createdAt: -1, status: 1 });
paymentSchema.index({ method: 1, status: 1 });

// ✅ Prevent OverwriteModelError during nodemon reloads
module.exports = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
