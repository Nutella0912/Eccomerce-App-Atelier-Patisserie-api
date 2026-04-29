const express = require("express");
const router = express.Router();

const userController = require("../controllers/user");
const auth = require("../auth");

router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);

router.get("/details", auth.verify, userController.getUserDetails);
router.patch("/:id/set-as-admin", auth.verify, auth.verifyAdmin, userController.setAsAdmin);
router.patch("/update-password", auth.verify, userController.updatePassword);


module.exports = router;