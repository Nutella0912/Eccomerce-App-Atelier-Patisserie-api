const Cart = require("../models/Cart");
const { errorHandler } = require("../auth");

module.exports.getUserCart = (req, res) => {

	if (req.user.isAdmin) {
		return res.status(403).send({
			auth: "Failed",
			message: "Action Forbidden"
		});
	}

	return Cart.findOne({ userId: req.user.id })
	.then(cart => {

		if (!cart) {
			return res.status(404).send({
				message: "Cart not found"
			});
		}

		return res.status(200).send({ cart: cart });

	})
	.catch(error => errorHandler(error, req, res));
};


const Product = require("../models/Product");

module.exports.addToCart = (req, res) => {
    if (req.user.isAdmin) {
        return res.status(403).send({
            auth: "Failed",
            message: "Action Forbidden"
        });
    }

    const { productId, quantity } = req.body;

    return Product.findById(productId)
    .then(product => {
        if (!product) {
            return res.status(404).send({ message: "Product not found" });
        }

        const subtotal = product.price * quantity;

        return Cart.findOne({ userId: req.user.id })
        .then(cart => {
            if (!cart) {
                let newCart = new Cart({
                    userId: req.user.id,
                    cartItems: [{ productId, quantity, subtotal }],
                    totalPrice: subtotal
                });

                return newCart.save()
                .then(savedCart => res.status(200).send({
                    message: "Item added to cart successfully",
                    cart: savedCart
                }));
            }

            let itemIndex = cart.cartItems.findIndex(item => item.productId.toString() === productId);

            if (itemIndex !== -1) {
                cart.cartItems[itemIndex].quantity = quantity;
                cart.cartItems[itemIndex].subtotal = subtotal;
            } else {
                cart.cartItems.push({ productId, quantity, subtotal });
            }

            cart.totalPrice = cart.cartItems.reduce((total, item) => total + item.subtotal, 0);

            return cart.save()
            .then(updatedCart => res.status(200).send({
                message: "Item added to cart successfully",
                cart: updatedCart
            }));
        });
    })
    .catch(error => errorHandler(error, req, res));
};


module.exports.updateCartQuantity = (req, res) => {

	if (req.user.isAdmin) {
		return res.status(403).send({
			auth: "Failed",
			message: "Action Forbidden"
		});
	}

	const { productId, newQuantity } = req.body;

	return Cart.findOne({ userId: req.user.id })
	.then(cart => {

		if (!cart) {
			return res.status(404).send({
				message: "Cart not found"
			});
		}

		let itemIndex = cart.cartItems.findIndex(item => item.productId.toString() === productId);

		if (itemIndex === -1) {
			return res.status(404).send({
				message: "Item not found in cart"
			});
		}

		let currentItem = cart.cartItems[itemIndex];
		let unitPrice = currentItem.subtotal / currentItem.quantity;

		currentItem.quantity = newQuantity;
		currentItem.subtotal = unitPrice * newQuantity;

		cart.totalPrice = cart.cartItems.reduce((total, item) => total + item.subtotal, 0);

		return cart.save()
		.then(updatedCart => {
			return res.status(200).send({
				message: "Item quantity updated successfully",
				updatedCart: updatedCart
			});
		})
		.catch(error => errorHandler(error, req, res));

	})
	.catch(error => errorHandler(error, req, res));
};

module.exports.removeFromCart = (req, res) => {
	const productId = req.params.productId;

	Cart.findOne({ userId: req.user.id })
	.then(cart => {

		if (!cart) {
			return res.status(404).send({ message: "No cart found" });
		}

		const itemIndex = cart.cartItems.findIndex(item => item.productId.toString() === productId);

		if (itemIndex === -1) {
			return res.status(404).send({ message: "Item not found in cart" });
		}

		cart.cartItems.splice(itemIndex, 1);

		cart.totalPrice = cart.cartItems.reduce((total, item) => total + item.subtotal, 0);

		return cart.save()
		.then(updatedCart => {
			return res.status(200).send({
				message: "Item removed from cart successfully",
				updatedCart: updatedCart
			});
		})
		.catch(error => {
			return res.status(500).send({
				message: "Error saving cart",
				error
			});
		});

	})
	.catch(error => {
		return res.status(500).send({
			message: "Error finding cart",
			error
		});
	});
};

module.exports.clearCart = (req, res) => {
	Cart.findOne({ userId: req.user.id })
	.then(cart => {

		if (!cart) {
			return res.status(404).send({ message: "No cart found" });
		}

		if (cart.cartItems.length === 0) {
			return res.status(200).send({ message: "Cart is already empty" });
		}

		cart.cartItems = [];
		cart.totalPrice = 0;

		return cart.save()
		.then(savedCart => {
			return res.status(200).send({
				message: "Cart cleared successfully",
				cart: savedCart
			});
		})
		.catch(error => {
			return res.status(500).send({
				message: "Error saving cart",
				error
			});
		});

	})
	.catch(error => {
		return res.status(500).send({
			message: "Error finding cart",
			error
		});
	});
};
