const fs = require('node:fs');
const path = require('node:path');

const MODES = new Set(['development', 'preview', 'production']);
const PACKAGE_NAME = 'ro.profudemate.app';

function loadLocalEnvironment() {
  const localFile = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(localFile)) process.loadEnvFile(localFile);
}

function required(name, issues) {
  const value = process.env[name]?.trim();
  if (!value) issues.push(`Lipsește ${name}.`);
  return value ?? '';
}

function googleServicesPath() {
  const configured = process.env.GOOGLE_SERVICES_JSON?.trim();
  return path.resolve(process.cwd(), configured || 'google-services.json');
}

function validateGoogleServices(filePath, webClientId, issues) {
  if (!fs.existsSync(filePath)) {
    issues.push(`Nu există fișierul Google Services la ${filePath}.`);
    return;
  }

  let document;
  try {
    document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    issues.push('google-services.json nu este JSON valid.');
    return;
  }

  const clients = Array.isArray(document.client) ? document.client : [];
  const androidClient = clients.find(
    (client) => client?.client_info?.android_client_info?.package_name === PACKAGE_NAME,
  );
  if (!androidClient) {
    issues.push(`google-services.json nu conține aplicația Android ${PACKAGE_NAME}.`);
    return;
  }

  const oauthClients = Array.isArray(androidClient.oauth_client) ? androidClient.oauth_client : [];
  const containsWebClient = oauthClients.some(
    (client) => client?.client_type === 3 && client?.client_id === webClientId,
  );
  if (webClientId && !containsWebClient) {
    issues.push('Google Web Client ID nu corespunde clientului web din google-services.json.');
  }
}

function validateClientEnvironment(mode) {
  if (!MODES.has(mode)) throw new Error(`Mediu necunoscut: ${mode}`);

  const issues = [];
  const webClientId = required('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', issues);
  const projectNumber = required('EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER', issues);

  if (webClientId && !/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(webClientId)) {
    issues.push('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID nu are format Google OAuth valid.');
  }
  if (projectNumber && !/^\d{6,20}$/.test(projectNumber)) {
    issues.push('EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER nu are format numeric valid.');
  }

  const debugToken = process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN?.trim() ?? '';
  const provider = process.env.EXPO_PUBLIC_APP_CHECK_PROVIDER?.trim() ?? '';
  if (mode !== 'production' && !debugToken) {
    issues.push('Lipsește EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN pentru testarea internă.');
  }
  if (mode === 'production' && (provider === 'debug' || debugToken)) {
    issues.push('Production nu poate conține providerul sau tokenul App Check debug.');
  }

  validateGoogleServices(googleServicesPath(), webClientId, issues);

  if (issues.length > 0) {
    throw new Error(`Configurație client invalidă pentru ${mode}:\n- ${issues.join('\n- ')}`);
  }

  return {
    mode,
    googleWebClient: true,
    playIntegrityProject: true,
    appCheck: mode === 'production' ? 'playIntegrity' : 'debug',
    googleServices: true,
  };
}

if (require.main === module) {
  const mode = process.argv[2] || 'development';
  if (mode === 'development') loadLocalEnvironment();
  try {
    const result = validateClientEnvironment(mode);
    console.log(
      `Configurație ${result.mode} validă: Google, Play Integrity, App Check ${result.appCheck} și Google Services.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { validateClientEnvironment };
