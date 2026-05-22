/**
 * Grafana Cloud login via GitHub OAuth for Playwright visual checks.
 *
 * Env (preferred):
 *   GRAFANA_GITHUB_USER, GRAFANA_GITHUB_PASSWORD
 * Alt:
 *   GITHUB_OAUTH_USER, GITHUB_OAUTH_PASSWORD
 * Legacy fallback:
 *   GRAFANA_USER, GRAFANA_PASSWORD (email/password form)
 */

export function resolveGrafanaAuthEnv() {
  const grafanaUrl = (process.env.GRAFANA_URL || '').replace(/\/$/, '');
  const githubUser =
    process.env.GRAFANA_GITHUB_USER ||
    process.env.GITHUB_OAUTH_USER ||
    '';
  const githubPassword =
    process.env.GRAFANA_GITHUB_PASSWORD ||
    process.env.GITHUB_OAUTH_PASSWORD ||
    '';
  const legacyUser = process.env.GRAFANA_USER || '';
  const legacyPassword = process.env.GRAFANA_PASSWORD || '';
  return {
    grafanaUrl,
    githubUser,
    githubPassword,
    legacyUser,
    legacyPassword,
    hasGitHubOAuth: Boolean(githubUser && githubPassword),
    hasLegacyLogin: Boolean(legacyUser && legacyPassword),
  };
}

export async function isGrafanaLoginPage(page) {
  const url = page.url();
  if (/\/login|\/signin/i.test(url)) return true;
  const loginForm = page.locator(
    'input[name="user"], input[name="username"], input#username, input[name="password"], input#password',
  );
  const githubOAuth = page.locator(
    'a[href*="github.com/login/oauth"], a[href*="github.com/login"], button:has-text("GitHub"), a:has-text("GitHub")',
  );
  return (await loginForm.count()) > 0 && (await githubOAuth.count()) === 0;
}

export async function isGrafanaSessionActive(page, grafanaUrl) {
  if (!grafanaUrl) return false;
  try {
    await page.goto(`${grafanaUrl}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);
    if (await isGrafanaLoginPage(page)) return false;
    const body = (await page.locator('body').innerText({ timeout: 10000 }).catch(() => '')) || '';
    if (/log in to grafana|sign in to grafana|welcome to grafana.*log in/i.test(body)) return false;
    return true;
  } catch {
    return false;
  }
}

async function clickGitHubOAuthEntry(page) {
  const selectors = [
    page.getByRole('link', { name: /github/i }),
    page.getByRole('button', { name: /github/i }),
    page.locator('a[href*="github.com/login/oauth"]'),
    page.locator('a[href*="github.com/login"]'),
    page.locator('button:has-text("GitHub")'),
    page.locator('a:has-text("GitHub")'),
    page.locator('[data-testid*="github"]'),
  ];
  for (const loc of selectors) {
    if ((await loc.count()) > 0) {
      await loc.first().click({ timeout: 15000 });
      return true;
    }
  }
  return false;
}

async function completeGitHubLogin(githubPage, githubUser, githubPassword) {
  await githubPage.waitForLoadState('domcontentloaded', { timeout: 120000 });

  const loginField = githubPage.locator(
    'input[name="login"], input#login_field, input[autocomplete="username"]',
  );
  await loginField.first().waitFor({ state: 'visible', timeout: 60000 });
  await loginField.first().fill(githubUser);
  await githubPage
    .locator('input[name="password"], input#password, input[type="password"]')
    .first()
    .fill(githubPassword);

  const signIn = githubPage.locator(
    'input[type="submit"][value="Sign in"], button[type="submit"]:has-text("Sign in"), button:has-text("Sign in")',
  );
  await signIn.first().click();

  const authorize = githubPage.locator(
    'button:has-text("Authorize"), button[name="authorize"], input[value*="Authorize"]',
  );
  if ((await authorize.count()) > 0) {
    await authorize.first().click({ timeout: 15000 }).catch(() => {});
  }

  await githubPage.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
}

async function waitForGrafanaAfterOAuth(grafanaPage, popup, grafanaUrl) {
  const host = new URL(grafanaUrl).host;
  const deadline = Date.now() + 120000;

  while (Date.now() < deadline) {
    if (popup && !popup.isClosed()) {
      try {
        await popup.waitForURL((url) => url.includes(host), { timeout: 5000 });
        await popup.close().catch(() => {});
      } catch {
        /* still on github */
      }
    }
    const current = grafanaPage.url();
    if (current.includes(host) && !/\/login|\/signin/i.test(current)) {
      await grafanaPage.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
      return true;
    }
    await grafanaPage.waitForTimeout(1500);
  }
  return !(await isGrafanaLoginPage(grafanaPage));
}

/**
 * @returns {{ page, oauthLoginSuccess: boolean, loginMethod: string, error?: string }}
 */
export async function loginGrafanaViaGitHub(context, { grafanaUrl, githubUser, githubPassword }) {
  const page = await context.newPage();
  const result = { page, oauthLoginSuccess: false, loginMethod: 'none' };

  if (!grafanaUrl || !githubUser || !githubPassword) {
    result.error = 'GRAFANA_URL and GitHub OAuth credentials required';
    return result;
  }

  try {
    await page.goto(`${grafanaUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);

    if (!(await isGrafanaLoginPage(page))) {
      result.oauthLoginSuccess = true;
      result.loginMethod = 'existing-session';
      return result;
    }

    const popupPromise = context.waitForEvent('page', { timeout: 45000 }).catch(() => null);
    const clicked = await clickGitHubOAuthEntry(page);
    if (!clicked) {
      result.error = 'GitHub OAuth button not found on Grafana login page';
      return result;
    }

    const popup = await popupPromise;
    let githubPage = popup;
    if (!githubPage) {
      await page.waitForTimeout(2000);
      if (/github\.com/i.test(page.url())) {
        githubPage = page;
      } else {
        result.error = 'GitHub OAuth did not open GitHub login (no popup or redirect)';
        return result;
      }
    } else {
      await githubPage.waitForLoadState('domcontentloaded', { timeout: 120000 });
    }

    await completeGitHubLogin(githubPage, githubUser, githubPassword);

    if (githubPage !== page) {
      await waitForGrafanaAfterOAuth(page, popup, grafanaUrl);
    } else {
      await page.waitForURL(
        (url) => url.includes(new URL(grafanaUrl).host) && !/\/login|\/signin/i.test(url),
        { timeout: 120000 },
      );
    }

    result.oauthLoginSuccess = await isGrafanaSessionActive(page, grafanaUrl);
    result.loginMethod = 'github-oauth';
    if (!result.oauthLoginSuccess) {
      result.error = 'GitHub OAuth flow finished but Grafana session not established';
    }
    return result;
  } catch (err) {
    result.error = err.message;
    return result;
  }
}

/** Legacy email/password (non-OAuth Grafana stacks). */
export async function loginGrafanaLegacy(page, { grafanaUrl, user, password }) {
  if (!user || !password) return { oauthLoginSuccess: false, loginMethod: 'none' };
  await page.goto(`${grafanaUrl}/login`, { waitUntil: 'networkidle', timeout: 120000 });
  const userField = page.locator('input[name="user"], input[name="username"], input#username');
  if ((await userField.count()) === 0) {
    return { oauthLoginSuccess: !(await isGrafanaLoginPage(page)), loginMethod: 'legacy-skip' };
  }
  await userField.first().fill(user);
  await page.locator('input[name="password"], input#password').first().fill(password);
  await page
    .locator('button[type="submit"], button:has-text("Log in"), button:has-text("ログイン")')
    .first()
    .click();
  await page.waitForLoadState('networkidle', { timeout: 120000 });
  return {
    oauthLoginSuccess: !(await isGrafanaLoginPage(page)),
    loginMethod: 'legacy-password',
  };
}

/**
 * Prefer GitHub OAuth; fall back to legacy password if only legacy creds set.
 */
export async function ensureGrafanaLogin(context) {
  const env = resolveGrafanaAuthEnv();
  const { grafanaUrl, githubUser, githubPassword, legacyUser, legacyPassword, hasGitHubOAuth } =
    env;

  if (hasGitHubOAuth) {
    return loginGrafanaViaGitHub(context, {
      grafanaUrl,
      githubUser,
      githubPassword,
    });
  }

  if (legacyUser && legacyPassword) {
    const page = await context.newPage();
    const legacy = await loginGrafanaLegacy(page, {
      grafanaUrl,
      user: legacyUser,
      password: legacyPassword,
    });
    return { page, ...legacy, error: legacy.oauthLoginSuccess ? undefined : 'legacy login failed' };
  }

  const page = await context.newPage();
  return {
    page,
    oauthLoginSuccess: false,
    loginMethod: 'none',
    error: 'Set GRAFANA_GITHUB_USER/GRAFANA_GITHUB_PASSWORD (or GITHUB_OAUTH_*)',
  };
}
