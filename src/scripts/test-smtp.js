import nodemailer from "nodemailer";

async function testSMTP() {
  console.log("Creating transporter...");
  const transporter = nodemailer.createTransport({
    host: "smtp.zoho.in",
    port: 465,
    secure: true,
    auth: {
      user: "govardhan@salonnest.in",
      pass: "MVbNN2PTwH0f"
    },
    logger: true, // Log to console
    debug: true // Include SMTP traffic in the logs
  });

  try {
    console.log("Verifying connection...");
    await transporter.verify();
    console.log("Connection verified successfully!");

    console.log("Sending test email...");
    const info = await transporter.sendMail({
      from: '"Salon Nest" <govardhan@salonnest.in>',
      to: "ahmedbilalkhangl09@gmail.com",
      subject: "SMTP Test from SalonNest Backend",
      text: "This is a test email using the provided Zoho credentials.",
      html: "<p>This is a test email using the provided Zoho credentials.</p>"
    });
    
    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("SMTP Error occurred:", error);
  }
}

testSMTP();
