const signerService = require("../services/signer.service");

exports.signDocument = async (req, res) => {
  try {

    const result = await signerService.sign(req.body);

    res.json({
      status: "success",
      data: result
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      status: "error",
      message: error.message
    });

  }
};