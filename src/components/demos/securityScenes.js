// Frame data for the Spring Security filter chain walk-through, drawn by BoardStage.
// The chain is a column of filters on the left, in their real order. Side cards on the right show
// the request, the AuthenticationManager, the SecurityContext, the error handlers and the controller.

import { BoardStage } from './BoardStage.jsx';

const FILTERS = [
  'SecurityContextHolderFilter',
  'HeaderWriterFilter',
  'CorsFilter',
  'CsrfFilter',
  'BearerTokenAuthenticationFilter',
  'AnonymousAuthenticationFilter',
  'ExceptionTranslationFilter',
  'AuthorizationFilter',
];
const FID = ['ctxf', 'hdr', 'cors', 'csrf', 'auth', 'anon', 'etf', 'authz'];

// state: { passed: number of filters already passed, at: {index: options}, rest: tone for the others }
const chain = ({ passed = 0, at = {}, rest = 'none' } = {}) =>
  FILTERS.map((title, i) => ({
    id: FID[i],
    x: 14,
    y: 24 + i * 40,
    w: 256,
    h: 30,
    title,
    tone: i < passed ? 'ok' : rest,
    ...(at[i] || {}),
  }));

const side = {
  req: (title, lines, o = {}) => ({ id: 'req', x: 320, y: 24, w: 306, title, lines, mono: true, tone: 'new', ...o }),
  mgr: (o = {}) => ({ id: 'mgr', x: 320, y: 112, w: 306, title: 'AuthenticationManager', lines: ['checks signature, issuer, expiry'], tone: 'ok', ...o }),
  ctx: (lines, o = {}) => ({ id: 'ctx', x: 320, y: 206, w: 306, title: 'SecurityContext', lines, tone: 'ok', ...o }),
  handler: (title, lines, o = {}) => ({ id: 'handler', x: 320, y: 206, w: 306, title, lines, tone: 'bad', ...o }),
  ctrl: (lines, o = {}) => ({ id: 'ctrl', x: 320, y: 290, w: 306, title: 'ReportController', lines, tone: 'none', ...o }),
};
const H = 350;

/* ---------- allowed request ---------- */
const okReq = () => side.req('Request', ['GET /reports', 'Authorization: Bearer eyJ...']);
const okFrames = [
  {
    h: H,
    line: 'FilterChainProxy  →  SecurityFilterChain',
    cards: [...chain(), okReq(), side.ctrl(['not reached yet'])],
    arrows: [{ from: 'req', to: 'ctxf', fs: 'l', ts: 'r', tone: 'new' }],
    note: 'Every HTTP request first enters FilterChainProxy. It picks the SecurityFilterChain that matches the URL and runs its filters top to bottom, in a fixed order. Only then can the request reach a controller.',
  },
  {
    h: H,
    line: 'load context · add headers · CORS · CSRF',
    cards: [...chain({ passed: 4 }), okReq(), side.ctrl(['not reached yet'])],
    note: 'The early filters prepare the request. SecurityContextHolderFilter loads an empty SecurityContext. HeaderWriterFilter will add security headers. CorsFilter and CsrfFilter run their checks, and a GET needs no CSRF token.',
  },
  {
    h: H,
    line: 'authenticate(bearer token)',
    result: { text: 'alice is authenticated', tone: 'ok' },
    cards: [...chain({ passed: 4, at: { 4: { tone: 'new', badge: 'reads token' } } }), okReq(), side.mgr(), side.ctx(['Authentication: alice', 'authorities: SCOPE_reports.read']), side.ctrl(['not reached yet'])],
    arrows: [
      { from: 'auth', to: 'mgr', fs: 'r', ts: 'l', tone: 'new' },
      { from: 'mgr', to: 'ctx', fs: 'b', ts: 't', tone: 'ok' },
    ],
    note: 'The authentication filter, here BearerTokenAuthenticationFilter, reads the token. It asks the AuthenticationManager to verify it, then stores the resulting Authentication in the SecurityContext. From now on the request has an identity.',
  },
  {
    h: H,
    line: 'GET /reports/** needs SCOPE_reports.read',
    result: { text: 'allowed', tone: 'ok' },
    cards: [
      ...chain({ passed: 7, at: { 5: { dim: true }, 7: { tone: 'new', badge: 'allowed' } } }),
      okReq(), side.mgr({ dim: true }), side.ctx(['Authentication: alice', 'authorities: SCOPE_reports.read']), side.ctrl(['not reached yet']),
    ],
    arrows: [{ from: 'ctx', to: 'authz', fs: 'l', ts: 'r', tone: 'ok' }],
    note: 'The anonymous filter has nothing to do. ExceptionTranslationFilter stands ready to turn failures into 401 or 403. Then AuthorizationFilter, the last filter, checks the rule for this URL against alice\'s authorities. She has the scope it needs.',
  },
  {
    h: H,
    line: '200 OK',
    result: { text: 'controller runs', tone: 'ok' },
    cards: [...chain({ passed: 8, at: { 5: { dim: true } } }), okReq(), side.ctx(['Authentication: alice', 'authorities: SCOPE_reports.read'], { dim: true }), side.ctrl(['@PreAuthorize can still check', 'returns the report'], { tone: 'ok', badge: '200' })],
    arrows: [{ from: 'authz', to: 'ctrl', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Now the request reaches the controller. Method security (@PreAuthorize) and object-level checks can still run there. The SecurityContext is cleared when the request ends.',
  },
];

/* ---------- 401: no credentials ---------- */
const anonReq = (o = {}) => side.req('Request', ['GET /reports', 'no Authorization header'], { tone: 'warn', ...o });
const unauthFrames = [
  {
    h: H,
    line: 'GET /reports   (no token)',
    cards: [...chain(), anonReq(), side.ctrl(['not reached yet'])],
    arrows: [{ from: 'req', to: 'ctxf', fs: 'l', ts: 'r', tone: 'warn' }],
    note: 'A request arrives with no token and no login.',
  },
  {
    h: H,
    line: 'no token  →  anonymousUser',
    cards: [
      ...chain({ passed: 4, at: { 4: { dim: true, badge: 'nothing to read', badgeTone: 'none' }, 5: { tone: 'warn', badge: 'anonymous' } } }),
      anonReq(), side.ctx(['Authentication: anonymousUser', 'no authorities'], { tone: 'warn' }), side.ctrl(['not reached yet']),
    ],
    arrows: [{ from: 'anon', to: 'ctx', fs: 'r', ts: 'l', tone: 'warn' }],
    note: 'The authentication filter finds nothing to authenticate, so it does nothing. AnonymousAuthenticationFilter then puts an anonymous Authentication into the SecurityContext.',
  },
  {
    h: H,
    line: 'throw new AccessDeniedException(...)',
    result: { text: 'denied', tone: 'bad' },
    cards: [
      ...chain({ passed: 6, at: { 4: { dim: true }, 5: { tone: 'warn' }, 6: { tone: 'warn', badge: 'catches it' }, 7: { tone: 'bad', badge: 'denies' } } }),
      anonReq(), side.ctx(['Authentication: anonymousUser', 'no authorities'], { tone: 'warn' }), side.ctrl(['not reached yet']),
    ],
    note: 'AuthorizationFilter checks the rule "/reports/** needs an authenticated user". The user is anonymous, so it throws AccessDeniedException. ExceptionTranslationFilter, just above it, catches the exception.',
  },
  {
    h: H,
    line: 'user is anonymous  →  AuthenticationEntryPoint',
    result: { text: '401', tone: 'bad' },
    cards: [
      ...chain({ passed: 6, at: { 4: { dim: true }, 5: { tone: 'warn' }, 6: { tone: 'warn' }, 7: { tone: 'bad' } } }),
      anonReq({ dim: true }), side.handler('AuthenticationEntryPoint', ['form login: redirect to /login', 'API: 401 + WWW-Authenticate'], { badge: '401' }), side.ctrl(['never reached'], { dim: true }),
    ],
    arrows: [{ from: 'etf', to: 'handler', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'Because the user is anonymous, ExceptionTranslationFilter asks them to log in: it calls the AuthenticationEntryPoint. A form-login app redirects to the login page, and a token API returns 401. The controller is never reached.',
  },
];

/* ---------- 403: no permission ---------- */
const bobReq = (o = {}) => side.req('Request', ['DELETE /reports/42', 'valid token for bob'], o);
const bobCtx = (o = {}) => side.ctx(['Authentication: bob', 'authorities: SCOPE_reports.read (no ROLE_ADMIN)'], o);
const forbiddenFrames = [
  {
    h: H,
    line: 'DELETE /reports/42   (bob\'s token)',
    result: { text: 'bob is authenticated', tone: 'ok' },
    cards: [...chain({ passed: 6, at: { 4: { badge: 'valid token' }, 5: { dim: true } } }), bobReq(), bobCtx({ badge: 'logged in' }), side.ctrl(['not reached yet'])],
    arrows: [{ from: 'auth', to: 'ctx', fs: 'r', ts: 'l', tone: 'ok' }],
    note: 'Bob has a valid token, so authentication succeeds. But his token only carries SCOPE_reports.read. He calls DELETE /reports/42, which needs the ADMIN role.',
  },
  {
    h: H,
    line: 'DELETE /reports/** needs ROLE_ADMIN',
    result: { text: 'denied', tone: 'bad' },
    cards: [...chain({ passed: 6, at: { 5: { dim: true }, 6: { tone: 'warn', badge: 'catches it' }, 7: { tone: 'bad', badge: 'denies' } } }), bobReq(), bobCtx(), side.ctrl(['not reached yet'])],
    arrows: [{ from: 'ctx', to: 'authz', fs: 'l', ts: 'r', tone: 'bad' }],
    note: 'AuthorizationFilter checks the rule "DELETE /reports/** needs ROLE_ADMIN". Bob does not have that authority, so it throws AccessDeniedException, and ExceptionTranslationFilter catches it.',
  },
  {
    h: H,
    line: 'user is authenticated  →  AccessDeniedHandler',
    result: { text: '403', tone: 'bad' },
    cards: [
      ...chain({ passed: 6, at: { 5: { dim: true }, 6: { tone: 'warn' }, 7: { tone: 'bad' } } }),
      bobReq({ dim: true }), side.handler('AccessDeniedHandler', ['logged in, but not allowed', 'writes 403 Forbidden'], { badge: '403' }), side.ctrl(['never reached'], { dim: true }),
    ],
    arrows: [{ from: 'etf', to: 'handler', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'This time the user is logged in, so asking Bob to log in again would not help. ExceptionTranslationFilter calls the AccessDeniedHandler, which answers 403 Forbidden. The controller is never reached.',
  },
];

/* ---------- CSRF ---------- */
const csrfFrames = [
  {
    h: H,
    line: 'POST /transfer   Cookie: SESSION=abc',
    cards: [...chain(), side.req('Malicious page', ['hidden form posts to /transfer', 'browser adds the cookie'], { tone: 'bad' }), side.ctrl(['not reached yet'], { title: 'TransferController' })],
    arrows: [{ from: 'req', to: 'ctxf', fs: 'l', ts: 'r', tone: 'bad' }],
    note: 'A malicious page makes the victim\'s browser submit POST /transfer. The browser attaches the session cookie automatically, so the request looks authenticated. It carries no CSRF token.',
  },
  {
    h: H,
    line: 'POST needs a CSRF token: none sent',
    result: { text: '403, stopped early', tone: 'bad' },
    cards: [
      ...chain({ passed: 3, at: { 3: { tone: 'bad', badge: 'rejects' }, 4: { dim: true }, 5: { dim: true }, 6: { dim: true }, 7: { dim: true } } }),
      side.req('Malicious page', ['hidden form posts to /transfer', 'browser adds the cookie'], { tone: 'bad', dim: true }),
      side.handler('AccessDeniedHandler', ['invalid CSRF token', 'writes 403 Forbidden'], { badge: '403' }),
      side.ctrl(['never reached'], { title: 'TransferController', dim: true }),
    ],
    arrows: [{ from: 'csrf', to: 'handler', fs: 'r', ts: 'l', tone: 'bad' }],
    note: 'CsrfFilter runs before authentication and authorization. For unsafe methods (POST, PUT, DELETE) it compares the token in the request with the expected one. There is none, so it stops the request right there.',
  },
  {
    h: H,
    line: 'X-CSRF-TOKEN: 7f3a...   (from the real page)',
    result: { text: 'passes', tone: 'ok' },
    cards: [
      ...chain({ passed: 4, at: { 3: { tone: 'ok', badge: 'token matches' } } }),
      side.req('Real form page', ['POST /transfer + cookie', 'X-CSRF-TOKEN: 7f3a...']),
      side.ctrl(['continues down the chain'], { title: 'TransferController' }),
    ],
    arrows: [{ from: 'req', to: 'ctxf', fs: 'l', ts: 'r', tone: 'ok' }],
    note: 'The real page includes the token, in a hidden field or a header its script adds. A foreign site cannot read it. Stateless APIs that use bearer tokens instead of cookies are not exposed to CSRF, and usually turn it off.',
  },
];

export const SECURITY_SCENES = [
  { id: 'ok', label: 'Allowed request', title: 'A request with a valid token passes every filter', stage: BoardStage, frames: okFrames },
  { id: '401', label: 'No credentials (401)', title: 'No credentials: the request is stopped as unauthenticated', stage: BoardStage, frames: unauthFrames },
  { id: '403', label: 'No permission (403)', title: 'Logged in but not allowed: 403 Forbidden', stage: BoardStage, frames: forbiddenFrames },
  { id: 'csrf', label: 'CSRF check', title: 'A cookie-based form POST without a CSRF token is rejected early', stage: BoardStage, frames: csrfFrames },
];
