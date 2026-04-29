const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: [true, "First name is required"] },
  lastName: { type: String, required: [true, "Last name is required"] },
  email: { type: String, required: [true, "Email is required"] },
  password: { type: String, required: [true, "Password is required"] },
  isAdmin: { type: Boolean, default: false },
  mobileNo: { type: String, required: [true, "Mobile number is required"] },

  /** * STRIPE INTEGRATION FIELDS
   */
  stripeCustomerId: { 
    type: String 
  },
  
  paymentMethods: [{
    methodId: { type: String, required: true }, // The 'pm_...' token
    methodType: { type: String },               // 'card' or 'gcash'
    brand: { type: String },                    // 'visa', 'mastercard', etc.
    last4: { type: String },                    // Last 4 digits
    isDefault: { type: Boolean, default: false },
    
    /**
     * FINGERPRINT: The unique identifier for a physical card.
     * Use this to prevent the "duplicate card" spam you're seeing in your UI.
     */
    fingerprint: { type: String } 
  }]
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);