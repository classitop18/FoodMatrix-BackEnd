import admin from "firebase-admin";

// Singleton pattern to ensure Firebase is initialized only once
let firebaseAdminApp: admin.app.App | undefined;

export const initFirebase = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  try {
    const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (!base64ServiceAccount) {
      console.warn(
        "⚠️  FIREBASE_SERVICE_ACCOUNT_BASE64 is missing. FCM push notifications will be DISABLED.",
      );
      return undefined;
    }

    // Securely decode base64 to string, then parse to JSON
    const serviceAccountBuffer = Buffer.from(base64ServiceAccount, "base64");
    const decodedString = serviceAccountBuffer.toString("utf-8");

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(decodedString);
    } catch {
      console.error(
        "❌ FIREBASE_SERVICE_ACCOUNT_BASE64 is NOT valid base64-encoded JSON.",
      );
      console.error(
        "   Decoded value starts with:",
        decodedString.substring(0, 80),
      );
      console.error(
        "   Fix: Download service account JSON from Firebase Console, then run:",
      );
      console.error("         base64 -w 0 < your-service-account.json");
      console.error("   FCM push notifications will be DISABLED.");
      return undefined;
    }

    if (!serviceAccount.project_id || !serviceAccount.private_key) {
      console.error(
        "❌ Firebase service account JSON is missing required fields (project_id / private_key).",
      );
      console.error("   FCM push notifications will be DISABLED.");
      return undefined;
    }

    firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log(
      "✅ Firebase Admin SDK initialized successfully for project:",
      serviceAccount.project_id,
    );
    return firebaseAdminApp;
  } catch (error) {
    console.error("❌ Error initializing Firebase Admin:", error);
    console.error("   FCM push notifications will be DISABLED.");
    return undefined;
  }
};

export { admin };
