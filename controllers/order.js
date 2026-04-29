const Order = require("../models/Order");
const Cart = require("../models/Cart");
const { errorHandler } = require("../auth");

/*
  Requirements covered by this controller:
  - Orders persist with line items, totals, and timestamps (Order schema handles this)
  - Cart is cleared after successful checkout (we clear/reset the cart after saving order)
  - Orders route is protected and only shows the logged in user’s orders (uses req.user.id)
*/

module.exports.createOrder = (req, res) => {
  // Admins should not be able to checkout
  if (req.user.isAdmin) {
    return res.status(403).send({
      auth: "Failed",
      message: "Action Forbidden"
    });
  }

  return Cart.findOne({ userId: req.user.id })
    .then((cart) => {
      if (!cart) {
        return res.status(404).send({ error: "No Cart found" });
      }

      if (!Array.isArray(cart.cartItems) || cart.cartItems.length === 0) {
        return res.status(400).send({ error: "No Items to Checkout" });
      }

      const newOrder = new Order({
        userId: req.user.id,
        productsOrdered: cart.cartItems,
        totalPrice: cart.totalPrice
      });

      return newOrder.save().then((savedOrder) => {
        // Clear cart after successful checkout
        cart.cartItems = [];
        cart.totalPrice = 0;

        return cart.save().then(() => {
          return res.status(201).send({
            message: "Ordered Successfully",
            order: savedOrder
          });
        });
      });
    })
    .catch((error) => errorHandler(error, req, res));
};

module.exports.getUserOrders = (req, res) => {
  if (req.user.isAdmin) {
    return res.status(403).send({
      auth: "Failed",
      message: "Action Forbidden"
    });
  }

  return Order.find({ userId: req.user.id })
    .then((orders) => {
      // Return 200 with [] so frontend shows "No orders yet" instead of an error
      return res.status(200).send({ orders: orders || [] });
    })
    .catch((error) => errorHandler(error, req, res));
};

module.exports.getAllOrders = (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).send({
      auth: "Failed",
      message: "Action Forbidden. Admin access required."
    });
  }

  return Order.find({})
    .then((orders) => {
      return res.status(200).send({ orders: orders || [] });
    })
    .catch((error) => errorHandler(error, req, res));
};