const User = require("../models/User");
const bcrypt = require("bcrypt");
const auth = require('../auth.js');

module.exports.registerUser = (req, res) => {

  if (!req.body.email.includes("@")) {
    return res.status(400).send({ error: "Email invalid" });
  }
  else if (req.body.mobileNo.length !== 11) {
    return res.status(400).send({ error: "Mobile number invalid" });
  }
  else if (req.body.password.length < 8) {
    return res.status(400).send({ error: "Password must be atleast 8 characters" });
  }
  else {

    let newUser = new User({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      mobileNo: req.body.mobileNo,
      password: bcrypt.hashSync(req.body.password, 10)
    });

    return newUser.save()
    .then(result => {
      return res.status(201).send({ message: "Registered Successfully" });
    })
    .catch(error => {
      return res.status(500).send({ error: "Error", details: error });
    });
  }
};


module.exports.loginUser = (req, res) => {

  if (!req.body.email.includes("@")) {
    return res.status(400).send({ error: "Invalid Email" });
  }

  return User.findOne({ email: req.body.email })
  .then(result => {

    if (result == null) {
      return res.status(404).send({ error: "No Email Found" });
    }

    const isPasswordCorrect = bcrypt.compareSync(req.body.password, result.password);

    if (isPasswordCorrect) {
      return res.status(200).send({ access: auth.createAccessToken(result) });
    } else {
      return res.status(401).send({ error: "Email and password do not match" });
    }

  })
  .catch(error => {
    return res.status(500).send({ error: "Error", details: error });
  });
};


module.exports.getUserDetails = (req, res) => {
  return User.findById(req.user.id).select('-password')
    .then(user => {
      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }
      return res.status(200).send({ user: user });
    })
    .catch(error => {
      return res.status(500).send({ error: "Error", details: error });
    });
};


module.exports.setAsAdmin = async (req, res) => {
  try {

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Toggle role
    user.role = user.role === "Admin" ? "Regular" : "Admin";

    await user.save();

    return res.status(200).json({
      message: "User role updated successfully",
      newRole: user.role
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.updatePassword = (req, res) => {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
        return res.status(400).send({ error: "Password must be at least 8 characters long" });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    User.findByIdAndUpdate(req.user.id, { password: hashedPassword })
        .then(user => {
            if (!user) {
                return res.status(404).send({ error: "User not found" });
            }
            res.status(201).send({ message: "Password reset successfully" });
        })
        .catch(err => res.status(500).send({ error: "Internal Server Error", details: err }));
};