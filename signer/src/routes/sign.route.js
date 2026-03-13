const express = require("express");

const router = express.Router();

const signController = require("../controllers/sign.controller");

router.post("/", signController.signDocument);

module.exports = router;