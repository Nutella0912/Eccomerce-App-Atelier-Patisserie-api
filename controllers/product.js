const Product = require("../models/Product");
const { verify, verifyAdmin } = require("../auth");
const { errorHandler } = require('../auth');


module.exports.addProduct = (req, res) => {
    Product.findOne({ name: req.body.name })
    .then(existingProduct => {
        if (existingProduct) {
            return res.status(409).send({ message: 'Product already exists' });
        } 

        let newProduct = new Product({
            name: req.body.name,
            description: req.body.description,
            price: req.body.price
        });

        return newProduct.save()
            .then(result => res.status(201).send(result)) 
            .catch(error => res.status(500).send(error));
    })
    .catch(error => res.status(500).send(error));
};



module.exports.getAllProduct = (req, res) => {
    return Product.find({})
    .then(result => {
        if(result.length > 0){
            return res.status(200).send(result);
        }
        else{
            // 404 for not found courses
            return res.status(404).send({ message: 'No products found'});
        }
    })
    .catch(error => errorHandler(error, req, res));
};


module.exports.getAllActive = (req, res) => {

    Product.find({ isActive : true }).then(result => {
        if (result.length > 0){
            return res.status(200).send(result);
        }
        else {
            return res.status(404).send({ message: 'No active [products found' })
        }
    }).catch(err => res.status(500).send(err));
};


module.exports.getProduct = (req, res) => {
    Product.findById(req.params.id)
    .then(course => {
        if(course) {
            return res.status(200).send(course);
        } else {
            return res.status(404).send({ message: 'Product not found' });
        }
    })
    .catch(error => errorHandler(error, req, res)); 
};

module.exports.updateProductInfo = (req, res) => {
    Product.findById(req.params.id) 
    .then(product => {
        if(product) {
            product.name = req.body.name;
            product.description = req.body.description;
            product.price = req.body.price;

            return product.save().then(() => {
                return res.status(200).send({
                    success: true,
                    message: "Product updated successfully"
                });
            });
        } else {
            return res.status(404).send({ error: "Product not found" });
        }
    })
    .catch(error => errorHandler(error, req, res));
};

module.exports.archiveProduct = (req, res) => {
	Product.findById(req.params.id)
	.then(product => {
		if(!product) {
			return res.status(404).send({ error: "Product not found" });
		}

		if(product.isActive === false) {
			return res.status(200).send({
				message: "Product already archived",
				archivedProduct: product
			});
		}

		product.isActive = false;

		return product.save().then(updatedProduct => {
			return res.status(200).send({
				success: true,
				message: "Product archived successfully"
			});
		});
	})
	.catch(error => errorHandler(error, req, res));
};

module.exports.activateProduct = (req, res) => {
	Product.findById(req.params.id)
	.then(product => {
		if(!product) {
			return res.status(404).send({ error: "Product not found" });
		}

		if(product.isActive === true) {
			return res.status(200).send({
				message: "Product already active",
				activateProduct: product
			});
		}

		product.isActive = true;

		return product.save().then(() => {
			return res.status(200).send({
				success: true,
				message: "Product activated successfully"
			});
		});
	})
	.catch(error => errorHandler(error, req, res));
};

module.exports.searchByName = (req, res) => {
    const { name } = req.body;

    Product.find({ name: { $regex: name, $options: "i" } })
    .then(products => {
        return res.status(200).send(products);
    })
    .catch(error => {
        return res.status(500).send({
            message: "Error searching products",
            error
        });
    });
};

module.exports.searchByPrice = (req, res) => {
    const { minPrice, maxPrice } = req.body;

    Product.find({ price: { $gte: minPrice, $lte: maxPrice } })
    .then(products => {
        return res.status(200).send(products);
    })
    .catch(error => {
        return res.status(500).send({
            message: "Error searching products",
            error
        });
    });
};