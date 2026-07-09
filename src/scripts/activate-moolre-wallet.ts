import 'dotenv/config';
import { config } from '@/config/index';
import {
  activateMoolreWallet,
  getMoolreAccountStatus,
  isMoolreConfigured,
} from '@/payments/moolre.client';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length).trim() || undefined;
}

function resolveConfig() {
  return {
    apiUser: readArg('user') ?? config.MOOLRE_API_USER,
    apiKey: readArg('key') ?? config.MOOLRE_API_KEY,
    accountNumber: readArg('account') ?? config.MOOLRE_ACCOUNT_NUMBER,
    webhookUrl: readArg('callback') ?? config.MOOLRE_WEBHOOK_URL,
  };
}

function requireValue(label: string, value?: string | null): string {
  if (!value?.trim()) {
    console.error(`Missing required value: ${label}`);
    console.error('Set the MOOLRE_* env vars or pass --user= --account= --key= flags.');
    process.exit(1);
  }
  return value.trim();
}

async function main() {
  const resolved = resolveConfig();
  const credentials = {
    apiUser: requireValue('MOOLRE_API_USER', resolved.apiUser),
    apiKey: requireValue('MOOLRE_API_KEY', resolved.apiKey),
    accountNumber: requireValue('MOOLRE_ACCOUNT_NUMBER', resolved.accountNumber),
  };

  if (!isMoolreConfigured(true, credentials)) {
    console.error('Moolre is not fully configured. Check MOOLRE_* environment variables.');
    process.exit(1);
  }

  console.log('Checking Moolre wallet status…');
  try {
    const status = await getMoolreAccountStatus(credentials);
    console.log('Current wallet status:', status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Could not read wallet status before activation:', message);
  }

  console.log('Activating Moolre wallet API access…');
  const updated = await activateMoolreWallet({
    callback: resolved.webhookUrl,
    credentials,
  });

  console.log('Moolre wallet activated successfully.');
  console.log(
    JSON.stringify(
      {
        accountNumber: updated.accountnumber ?? credentials.accountNumber,
        accountName: updated.accountname,
        apiEnabled: updated.api === 1,
        callback: updated.callback,
        hasSecret: Boolean(updated.secret),
      },
      null,
      2,
    ),
  );

  const status = await getMoolreAccountStatus(credentials);
  console.log('Verified wallet status:', status);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
