const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/payment");
const auth = require("../auth");

/** =========================
 * 0. ADMIN (Management Views)
 * ========================= */

// Admin: list all payments (filterable by status/method, optional q search)
router.get("/", auth.verify, auth.verifyAdmin, paymentController.adminListPayments);

// Admin: view a specific user's linked methods (wallet)
router.get(
  "/user/:userId/methods",
  auth.verify,
  auth.verifyAdmin,
  paymentController.adminGetUserMethods
);

/** =========================
 * 1. AUTOMATED FLOWS (Linked Accounts)
 * ========================= */

// One-time payment checkout session
router.post("/stripe", auth.verify, paymentController.createStripeSession);

// Create a setup session to link a card (no charge)
router.post("/link-method", auth.verify, paymentController.createSetupSession);

// OPTIONAL: alias to prevent 404 if frontend still calls /setup-session
router.post("/setup-session", auth.verify, paymentController.createSetupSession);

// Fetch all linked methods for the logged-in user
router.get("/methods", auth.verify, paymentController.getSavedMethods);

// One-tap payment using a saved method
router.post("/charge-saved", auth.verify, paymentController.chargeSavedMethod);

// Unlink a saved method
router.delete("/methods/:id", auth.verify, paymentController.unlinkMethod);

// Verify checkout session and link card if needed (payment or setup mode)
router.post("/verify-link", auth.verify, paymentController.verifyAndLink);

/** =========================
 * 2. MANUAL FLOWS (Reference Numbers)
 * ========================= */

// Submit GCash reference for admin review
router.post("/gcash", auth.verify, paymentController.submitGCashPayment);

// Submit Bank transfer reference for admin review
router.post("/bank", auth.verify, paymentController.submitBankPayment);

/** =========================
 * 3. ADMIN OVERRIDE
 * ========================= */

// Approve a manual payment (Moves order from 'Pending' to 'Paid')
router.patch("/:id/approve", auth.verify, auth.verifyAdmin, paymentController.approvePayment);

// Reject a manual payment
router.patch("/:id/reject", auth.verify, auth.verifyAdmin, paymentController.rejectPayment);


module.exports = router;
