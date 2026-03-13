const express = require("express");

const signRoutes = require("./routes/sign.route");

const app = express();

app.use(express.json());

app.use("/sign", signRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Signer service running on port " + PORT);
});