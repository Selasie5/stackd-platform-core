import admin from 'firebase-admin';
import { config } from '@/config/index';

let initialized = false;

function ensureFirebase(): boolean {
  if (initialized) return true;
  if (!config.FCM_PROJECT_ID || !config.FCM_CLIENT_EMAIL || !config.FCM_PRIVATE_KEY) {
    return false;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.FCM_PROJECT_ID,
      clientEmail: config.FCM_CLIENT_EMAIL,
      privateKey: config.FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
  initialized = true;
  return true;
}

export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
): Promise<void> {
  if (tokens.length === 0) return;

  if (!ensureFirebase()) {
    if (config.NODE_ENV !== 'test') {
      console.log(`[Push] ${title}: ${body} (${tokens.length} token(s))`);
    }
    return;
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
  });

  if (response.failureCount > 0 && config.NODE_ENV !== 'test') {
    console.warn(`[Push] ${response.failureCount} of ${tokens.length} failed`);
  }
}
