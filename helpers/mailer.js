const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Sends a simple transactional email with one call-to-action button.
const sendActionEmail = ({ to, subject, heading, intro, buttonText, url, footer }) =>
  transporter.sendMail({
    from: `"Nexa Gadgets" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: `${heading}\n\n${intro}\n\n${url}\n\n${footer}`,
    html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>${heading}</h2>
      <p>${intro}</p>
      <a href="${url}"
         style="display: inline-block; padding: 12px 20px; background-color: #2340F5;
                color: white; text-decoration: none; border-radius: 8px; margin: 10px 0;">
        ${buttonText}
      </a>
      <p>${footer}</p>
    </div>
  `,
  });

module.exports = { sendActionEmail };
