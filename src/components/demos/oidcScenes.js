// Frame data for the OpenID Connect walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const OIDC_SCENES = [
  {
    id: 'login',
    label: 'Login flow',
    title: 'OpenID Connect login: OAuth code flow plus an ID token',
    frames: [
      {
        note: 'A web app wants to know who the visitor is. It does not store passwords; it trusts an identity provider. It starts an authorization code flow, but with scope "openid" (which makes it OpenID Connect), plus a random state, a nonce and a PKCE challenge.',
        boxes: [b('a', 'Web app (relying party)', ['state=s1, nonce=n1', 'code_challenge (PKCE)'], 'new'), b('u', 'Alice (browser)', ['clicks "Sign in"'], 'ok'), b('i', 'Identity provider', ['not involved yet'], 'none')],
        deps: [d('Web app', 'Identity provider', 'redirect: scope=openid profile email', 'ok')],
      },
      {
        note: 'Alice authenticates at the identity provider (password, MFA, passkey) and approves sharing her profile. The web app never sees her credentials.',
        boxes: [b('u', 'Alice (browser)', ['password + one-time code', 'approves: profile, email'], 'new', 'consent'), b('i', 'Identity provider', ['authenticates Alice', 'starts an SSO session'], 'ok')],
        deps: [d('Alice', 'Identity provider', 'login + consent', 'ok')],
      },
      {
        note: 'The provider redirects the browser back to the app with a one-time authorization code and the same state. The app checks the state first.',
        boxes: [b('a', 'Web app (relying party)', ['code=abc', 'state matches s1'], 'ok'), b('i', 'Identity provider', ['issued code=abc'], 'ok')],
        deps: [d('Identity provider', 'Web app', 'redirect_uri?code=abc&state=s1', 'ok')],
      },
      {
        note: 'The app calls the token endpoint over the back channel with the code and the PKCE verifier. The response contains an ID token (who logged in), an access token (for APIs) and usually a refresh token.',
        boxes: [b('a', 'Web app (relying party)', ['ID token', 'access token', 'refresh token'], 'new', 'tokens'), b('i', 'Identity provider', ['code + verifier checked'], 'ok')],
        deps: [d('Web app', 'Identity provider', 'POST /token (code + code_verifier)', 'ok'), d('Identity provider', 'Web app', 'id_token + access_token', 'ok')],
      },
      {
        note: 'The app must validate the ID token (a signed JWT): signature with the provider public key from the JWKS, issuer, audience equals its own client id, expiry, and the nonce equals n1 (blocks replay). Only then does it trust "sub = alice".',
        boxes: [b('a', 'Web app (relying party)', ['signature ok', 'iss ok, aud = my client id', 'exp ok, nonce = n1', 'sub: alice'], 'ok', 'ID token valid')],
        deps: [],
      },
      {
        note: 'The app now creates its own session for Alice (a cookie) and the flow is finished. From here on it uses its normal session; the ID token was only the proof of login.',
        boxes: [b('a', 'Web app (relying party)', ['own session for alice'], 'ok', 'logged in'), b('u', 'Alice (browser)', ['cookie: SID=...'], 'ok')],
        deps: [d('Web app', 'Alice', 'Set-Cookie: SID', 'ok')],
      },
    ],
  },
  {
    id: 'tokens',
    label: 'ID vs access token',
    title: 'Two tokens, two audiences: do not mix them up',
    frames: [
      {
        note: 'After login the app holds an ID token and an access token. They look similar (both may be JWTs) but answer different questions and are meant for different receivers.',
        boxes: [b('a', 'Web app', ['holds two tokens'], 'ok'), b('id', 'ID token', ['aud: the web app', 'sub: alice', 'name, email', 'nonce, auth_time'], 'new', 'who logged in'), b('at', 'Access token', ['aud: photo API', 'scope: photos.read'], 'new', 'what the app may do')],
        deps: [],
      },
      {
        note: 'The ID token is read by the app itself to learn who the user is. It is addressed to the app (audience = client id) and proves an authentication event.',
        boxes: [b('a', 'Web app', ['reads claims: alice, alice@example.com'], 'ok'), b('id', 'ID token', ['audience: this app'], 'ok')],
        deps: [d('Web app', 'ID token', 'validate and read claims', 'ok')],
      },
      {
        note: 'The access token is what the app sends to the API. The API checks signature, audience and scope. This is plain OAuth 2.0.',
        boxes: [b('a', 'Web app', ['Authorization: Bearer access token'], 'ok'), b('rs', 'Photo API', ['aud: photo API matches', 'scope photos.read: 200 OK'], 'ok', 'accepted')],
        deps: [d('Web app', 'Photo API', 'GET /photos with the access token', 'ok')],
      },
      {
        note: 'Mistake: sending the ID token to the API. Its audience is the web app, not the API, so a correct API rejects it. And an API must never accept an ID token as proof that the caller may do something.',
        boxes: [b('a', 'Web app', ['sends the ID token to the API'], 'warn'), b('rs', 'Photo API', ['aud: web app, expected photo API'], 'bad', '401 rejected')],
        deps: [d('Web app', 'Photo API', 'GET /photos with the ID token', 'bad')],
      },
      {
        note: 'If the app needs more profile data than the ID token carries, it calls the userinfo endpoint with the access token and receives the claims allowed by the granted scopes (profile, email).',
        boxes: [b('a', 'Web app', ['wants phone number'], 'ok'), b('i', 'Identity provider', ['userinfo endpoint', 'returns claims allowed by scope'], 'ok')],
        deps: [d('Web app', 'Identity provider', 'GET /userinfo with the access token', 'ok'), d('Identity provider', 'Web app', 'JSON claims', 'ok')],
      },
    ],
  },
  {
    id: 'sso',
    label: 'Single sign-on',
    title: 'Single sign-on: log in once, use many apps',
    frames: [
      {
        note: 'Alice opens the HR app. It redirects her to the identity provider, where she logs in. The provider remembers this in its own session cookie.',
        boxes: [b('a', 'HR app', ['not logged in'], 'warn'), b('u', 'Alice (browser)', ['logs in at the provider'], 'new'), b('i', 'Identity provider', ['SSO session for alice', 'cookie at the provider'], 'ok', 'session started')],
        deps: [d('HR app', 'Identity provider', 'redirect to log in', 'ok')],
      },
      {
        note: 'The provider sends her back with a code, and the app gets an ID token and creates its own session. Alice is in.',
        boxes: [b('a', 'HR app', ['own session for alice'], 'ok', 'logged in'), b('i', 'Identity provider', ['SSO session active'], 'ok')],
        deps: [d('Identity provider', 'HR app', 'code, then ID token', 'ok')],
      },
      {
        note: 'Later Alice opens the expense app. It also redirects to the same provider. The provider already has her session, so there is no password prompt: it redirects straight back with a code. That is single sign-on.',
        boxes: [b('a', 'Expense app', ['not logged in'], 'warn'), b('i', 'Identity provider', ['SSO session found', 'no login prompt'], 'ok', 'silent'), b('u', 'Alice (browser)', ['sees no login screen'], 'ok')],
        deps: [d('Expense app', 'Identity provider', 'redirect to log in', 'ok'), d('Identity provider', 'Expense app', 'code immediately', 'ok')],
      },
      {
        note: 'Logout is harder than login. Logging out of one app ends only that app\'s session. RP-initiated logout also ends the provider session, and front-channel or back-channel logout tells the other apps to end theirs.',
        boxes: [b('a', 'HR app', ['user clicks logout'], 'warn'), b('i', 'Identity provider', ['SSO session ended', 'notifies other apps'], 'ok', 'logout'), b('e', 'Expense app', ['receives logout notice', 'ends its session'], 'ok')],
        deps: [d('HR app', 'Identity provider', 'end_session request', 'ok'), d('Identity provider', 'Expense app', 'back-channel logout token', 'ok')],
      },
    ],
  },
];
