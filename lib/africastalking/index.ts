// lib/africastalking/index.ts
// Africa's Talking SMS integration

// @ts-ignore
import AfricasTalking from "africastalking";

const credentials = {
    apiKey: process.env.AT_API_KEY || "",
    username: process.env.AT_USERNAME || "sandbox",
};

const africasTalking = AfricasTalking(credentials);
const sms = africasTalking.SMS;

export async function sendSMS(to: string, message: string) {
  try {
    const options = {
        to: [to],
        message: message,
    };

    const response = await sms.send(options);
    return { success: true, messageId: response.SMSMessageData.MessageData[0].MessageId };
  } catch (error: any) {
    console.error("Error sending SMS via AT:", error);
    return { success: false, error: error.message };
  }
}
