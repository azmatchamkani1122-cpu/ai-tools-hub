const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
const PORT = 3000;

// JSON requests
app.use(express.json());

// Website files
app.use(express.static(__dirname));

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


// ===============================
// API RATE LIMIT SECURITY
// ===============================

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,

  // One IP can make maximum 20 requests per minute
  max: 20,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error: "Too many requests. Please try again after one minute."
  }
});


// ===============================
// WAIT FUNCTION
// ===============================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ===============================
// AI CHAT API
// ===============================

app.post("/api/chat", apiLimiter, async (req, res) => {

  try {

    const { message } = req.body;


    // Check message
    if (!message) {

      return res.status(400).json({
        error: "Message is required"
      });

    }


    // Get Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;


    // Check API key
    if (!apiKey) {

      return res.status(500).json({
        error: "GEMINI_API_KEY missing from .env"
      });

    }


    // Maximum retry attempts
    const maxAttempts = 3;


    // Try Gemini request
    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {


      const response = await fetch(

        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",

        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },

          body: JSON.stringify({

            contents: [

              {
                parts: [

                  {
                    text: message
                  }

                ]
              }

            ]

          })

        }

      );


      const data = await response.json();


      // Successful response
      if (response.ok) {

        const reply =
          data.candidates?.[0]?.content?.parts?.[0]?.text;


        if (reply) {

          return res.json({
            reply: reply
          });

        }

      }


      // Get Gemini error
      const errorMessage =
        data.error?.message ||
        "Gemini API request failed";


      console.log(
        `Gemini attempt ${attempt}/${maxAttempts}: ${errorMessage}`
      );


      // Retry temporary errors
      if (

        errorMessage
          .toLowerCase()
          .includes("high demand")

        ||

        response.status === 429

        ||

        response.status === 503

      ) {


        if (attempt < maxAttempts) {

          console.log(
            "Gemini temporarily busy. Retrying..."
          );

          await sleep(2000);

          continue;

        }

      }


      // Return final error
      return res.status(
        response.status || 500
      ).json({

        error: errorMessage

      });

    }


  } catch (error) {

    console.error(
      "Server Error:",
      error
    );


    return res.status(500).json({

      error:
        error.message ||
        "Server error"

    });

  }

});


// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

  console.log(
    `AI Hub is running at http://localhost:${PORT}`
  );

});