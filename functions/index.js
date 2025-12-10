const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Verifique se o app já foi inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}

exports.sheetsWebhook = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const data = req.body.data;

    if (!data) {
      return res.status(400).send("Bad Request: Missing data in body");
    }

    const db = admin.database();
    const ref = db.ref("sheetData");

    ref.set(data)
      .then(() => {
        console.log("Data updated successfully in Firebase");
        res.status(200).send("Data received and stored successfully.");
      })
      .catch((error) => {
        console.error("Error updating Firebase:", error);
        res.status(500).send("Internal Server Error");
      });
  });
});
