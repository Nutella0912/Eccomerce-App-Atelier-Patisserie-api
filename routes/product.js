const express = require('express');
const productController = require('../controllers/product');
const { verify, verifyAdmin } = require("../auth");


const router = express.Router();

router.post("/", verify, verifyAdmin, productController.addProduct);
router.get("/all", verify, verifyAdmin, productController.getAllProduct);
router.get("/active", productController.getAllActive);
router.get("/:id", productController.getProduct);

router.patch("/:id/update", verify, verifyAdmin, productController.updateProductInfo);
router.patch("/:id/archive", verify, verifyAdmin, productController.archiveProduct);
router.patch("/:id/activate", verify, verifyAdmin, productController.activateProduct);

router.post("/search-by-name", productController.searchByName);
router.post("/search-by-price", productController.searchByPrice);

module.exports = router;