// controllers/payment.js
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const Payment = require("../models/Payment");
const User = require("../models/User");
const mongoose = require("mongoose");

/**
 * Helper: only use an already-compiled Order model.
 * IMPORTANT: Do NOT call mongoose.model("Order") without a schema here.
 */
const getOrderModel = () => mongoose.models.Order;

// ================= STRIPE (ONE-TIME CHECKOUT) =================
module.exports.createStripeSession = async (req, res) => {
  try {
    const { amount, saveCard, orderId, methodType } = req.body;

    const safeAmount = Number(amount);
    if (!safeAmount || safeAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount." });
    }

    const paymentMethods = methodType === "card" ? ["card"] : [methodType];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethods,
      mode: "payment",
      payment_intent_data:
        saveCard && methodType === "card"
          ? { setup_future_usage: "off_session" }
          : {},
      line_items: [
        {
          price_data: {
            currency: "php",
            product_data: { name: "Atelier Boutique Order" },
            unit_amount: Math.round(safeAmount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment`,
      metadata: {
        orderId: orderId || "",
        userId: req.user?.id || "",
      },
    });

    const Order = getOrderModel();
    if (Order && orderId) {
      await Order.findByIdAndUpdate(orderId, { stripeSessionId: session.id });
    }

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("createStripeSession error:", err);
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

// ================= ONE-TAP (SAVED METHOD) =================
module.exports.chargeSavedMethod = async (req, res) => {
  try {
    const { amount, methodId, orderId } = req.body;

    const safeAmount = Number(amount);
    if (!safeAmount || safeAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount." });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({ message: "No linked Stripe profile found." });
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(safeAmount * 100),
      currency: "php",
      customer: user.stripeCustomerId,
      payment_method: methodId,
      off_session: true,
      confirm: true,
    });

    // Try to fetch receipt url (charges exists on the intent response in many cases,
    // but to be safe, retrieve with expand)
    let receiptUrl = "";
    try {
      const piFull = await stripe.paymentIntents.retrieve(intent.id, {
        expand: ["charges"],
      });
      receiptUrl = piFull?.charges?.data?.[0]?.receipt_url || "";
    } catch (e) {
      // non-fatal
    }

    const payment = await Payment.create({
      userId: req.user.id,
      orderId: orderId || null,
      amount: safeAmount,
      method: "saved_card",
      transactionId: intent.id,
      receiptUrl,
      status: "paid",
    });

    const Order = getOrderModel();
    if (Order && orderId) {
      await Order.findByIdAndUpdate(orderId, {
        status: "paid",
        paymentId: payment._id,
      });
    }

    return res.status(200).json({ message: "Instant payment successful", payment });
  } catch (err) {
    console.error("chargeSavedMethod error:", err);
    return res.status(500).json({
      message: `One-tap payment failed: ${err.message}. Please use standard checkout.`,
    });
  }
};

// ================= SETUP SESSION (LINK CARD ONLY) =================
module.exports.createSetupSession = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "setup",
      customer: user?.stripeCustomerId || undefined,
      success_url: `${process.env.CLIENT_URL}/setup-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/settings/payments`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("createSetupSession error:", err);
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

// ================= VERIFY & LINK (PAYMENT OR SETUP) =================
module.exports.verifyAndLink = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: "Missing sessionId." });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.payment_method", "setup_intent.payment_method"],
    });

    // ✅ SETUP MODE (Link card)
    if (session.mode === "setup") {
      if (session.status !== "complete") {
        return res.status(400).json({ message: "Setup not completed yet." });
      }

      const setupIntent = session.setup_intent;
      const method = setupIntent?.payment_method;

      if (!method || typeof method === "string") {
        return res.status(400).json({ message: "Payment method not found on setup." });
      }

      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found." });

      // Save customer id if missing
      if (!user.stripeCustomerId && session.customer) {
        user.stripeCustomerId = session.customer;
      }

      const fingerprint = method.card?.fingerprint;
      const alreadyLinked = user.paymentMethods?.some((m) => m.fingerprint === fingerprint);

      if (!alreadyLinked) {
        user.paymentMethods.push({
          methodId: method.id,
          methodType: "card",
          brand: method.card?.brand || "card",
          last4: method.card?.last4 || "",
          fingerprint,
        });
        await user.save();
      }

      return res.status(200).json({ message: "Card linked!", mode: "setup" });
    }

    // ✅ PAYMENT MODE (Normal checkout)
    if (session.mode === "payment") {
      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Payment not confirmed." });
      }

      // IMPORTANT: charges are NOT always present here; retrieve paymentIntent with expand
      const paymentIntentId = session.payment_intent?.id || session.payment_intent;
      let receiptUrl = "";
      let methodType = "stripe";

      if (paymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ["payment_method", "charges"],
        });

        methodType = pi?.payment_method?.type === "card" ? "card" : "stripe";
        receiptUrl = pi?.charges?.data?.[0]?.receipt_url || "";
      } else {
        // fallback if for some reason PI not present
        const pm = session.payment_intent?.payment_method;
        methodType = pm?.type === "card" ? "card" : "stripe";
      }

      const payment = await Payment.create({
        userId: req.user.id,
        // If your Order has stripeSessionId, we can link order later by updating it
        amount: (session.amount_total || 0) / 100,
        method: methodType,
        transactionId: paymentIntentId || "",
        receiptUrl,
        status: "paid",
      });

      const Order = getOrderModel();
      if (Order) {
        // This is the key so Orders become PAID and show the button
        await Order.findOneAndUpdate(
          { stripeSessionId: sessionId },
          {
            status: "paid",
            paymentId: payment._id,
            receiptUrl: receiptUrl || "",
          }
        );
      }

      return res.status(200).json({ message: "Payment verified!", payment, mode: "payment" });
    }

    return res.status(400).json({ message: "Unsupported session mode." });
  } catch (err) {
    console.error("verifyAndLink error:", err);
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

// ================= WALLET (USER) =================
module.exports.getSavedMethods = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    return res.status(200).json({ methods: user?.paymentMethods || [] });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load wallet." });
  }
};

// ================= MANUAL FLOWS =================
module.exports.submitGCashPayment = async (req, res) => {
  try {
    const { amount, referenceNumber, orderId } = req.body;

    const safeAmount = Number(amount);
    if (!safeAmount || safeAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount." });
    }

    const payment = await Payment.create({
      userId: req.user.id,
      orderId: orderId || null,
      amount: safeAmount,
      method: "gcash",
      referenceNumber: referenceNumber || "",
      status: "pending",
    });

    const Order = getOrderModel();
    if (Order && orderId) {
      await Order.findByIdAndUpdate(orderId, {
        status: "pending_verification",
        paymentId: payment._id,
      });
    }

    return res.status(201).json({ message: "GCash submitted", payment });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

module.exports.submitBankPayment = async (req, res) => {
  try {
    const { amount, referenceNumber, orderId } = req.body;

    const safeAmount = Number(amount);
    if (!safeAmount || safeAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount." });
    }

    const payment = await Payment.create({
      userId: req.user.id,
      orderId: orderId || null,
      amount: safeAmount,
      method: "bank",
      referenceNumber: referenceNumber || "",
      status: "pending",
    });

    const Order = getOrderModel();
    if (Order && orderId) {
      await Order.findByIdAndUpdate(orderId, {
        status: "pending_verification",
        paymentId: payment._id,
      });
    }

    return res.status(201).json({ message: "Bank submitted", payment });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

// ================= ADMIN ACTIONS =================
module.exports.approvePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status: "paid" },
      { new: true }
    );

    if (!payment) return res.status(404).json({ message: "Payment not found." });

    const Order = getOrderModel();
    if (Order) {
      await Order.findOneAndUpdate(
        { paymentId: payment._id },
        { status: "paid" }
      );
    }

    return res.status(200).json({ message: "Approved", payment });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

module.exports.rejectPayment = async (req, res) => {
  try {
    const { adminNote = "" } = req.body || {};

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status: "failed", adminNote },
      { new: true }
    );

    if (!payment) return res.status(404).json({ message: "Payment not found." });

    const Order = getOrderModel();
    if (Order) {
      await Order.findOneAndUpdate(
        { paymentId: payment._id },
        { status: "failed" }
      );
    }

    return res.status(200).json({ message: "Rejected", payment });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

module.exports.adminListPayments = async (req, res) => {
  try {
    const { status, method, q } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (method) filter.method = method;

    if (q) {
      filter.$or = [
        { referenceNumber: { $regex: q, $options: "i" } },
        { transactionId: { $regex: q, $options: "i" } },
      ];
    }

    const payments = await Payment.find(filter)
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ payments });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

module.exports.adminGetUserMethods = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "paymentMethods email firstName lastName"
    );
    if (!user) return res.status(404).json({ message: "User not found." });

    return res.status(200).json({ methods: user.paymentMethods || [], user });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

// ================= RECEIPT DOWNLOAD =================
// Redirects to Stripe hosted receipt URL (best lightweight approach)
module.exports.downloadReceipt = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate("userId", "_id isAdmin");

    if (!payment) return res.status(404).json({ message: "Payment not found." });

    // Owner or admin only
    const isOwner = String(payment.userId?._id) === String(req.user.id);
    const isAdmin = !!req.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden." });
    }

    if (!payment.receiptUrl) {
      return res.status(404).json({ message: "No receipt available for this payment." });
    }

    // Redirect so browser opens receipt (user can print/save as PDF)
    return res.redirect(payment.receiptUrl);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

// ================= CLEANUP =================
module.exports.unlinkMethod = async (req, res) => {
  try {
    const { id } = req.params;

    try {
      await stripe.paymentMethods.detach(id);
    } catch (e) {
      // ignore if already detached
    }

    await User.findByIdAndUpdate(req.user.id, {
      $pull: { paymentMethods: { methodId: id } },
    });

    return res.status(200).json({ message: "Card unlinked" });
  } catch (err) {
    return res.status(500).json({ message: "Unlink failed." });
  }
};

// ================= WEBHOOK =================
// NOTE: requires raw body middleware for Stripe signature verification
module.exports.handleStripeWebhook = async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const Order = getOrderModel();
      if (Order) {
        await Order.findOneAndUpdate(
          { stripeSessionId: session.id },
          { status: "paid" }
        );
      }
    }

    return res.json({ received: true });
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
};
