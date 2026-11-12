// Frame data for the Spring Security filter chain walk-through (box-and-arrow player, class-style boxes).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SECURITY_SCENES = [
  {
    id: 'ok',
    label: 'Allowed request',
    title: 'A request with a valid token passes every filter',
    frames: [
      {
        note: 'Every HTTP request first goes through Spring Security\'s FilterChainProxy, which picks the SecurityFilterChain that matches the URL and runs its filters in a fixed order before the request reaches any controller.',
        boxes: [b('r', 'Request', ['GET /reports', 'Authorization: Bearer eyJ...'], 'new'), b('f', 'FilterChainProxy', ['selects the SecurityFilterChain'], 'ok'), b('c', 'ReportController', ['not reached yet'], 'none')],
        deps: [d('Request', 'FilterChainProxy', 'enters', 'ok')],
      },
      {
        note: 'Early filters prepare the request: SecurityContextHolderFilter loads or creates an empty SecurityContext, HeaderWriterFilter adds security headers to the response, CorsFilter and CsrfFilter run their checks (a GET passes CSRF).',
        boxes: [b('a', 'SecurityContextHolderFilter', ['empty SecurityContext ready'], 'ok'), b('b', 'HeaderWriterFilter', ['will add security headers'], 'ok'), b('c', 'CorsFilter + CsrfFilter', ['GET: no CSRF token needed'], 'ok')],
        deps: [d('SecurityContextHolderFilter', 'HeaderWriterFilter', 'next', 'ok'), d('HeaderWriterFilter', 'CorsFilter + CsrfFilter', 'next', 'ok')],
      },
      {
        note: 'The authentication filter (here BearerTokenAuthenticationFilter) reads the token, asks the AuthenticationManager to verify it, and stores the resulting Authentication in the SecurityContext. From now on the request has an identity.',
        boxes: [b('a', 'BearerTokenAuthenticationFilter', ['extracts the token'], 'new'), b('m', 'AuthenticationManager', ['JwtAuthenticationProvider verifies signature, iss, exp'], 'ok'), b('s', 'SecurityContext', ['Authentication: alice', 'authorities: SCOPE_reports.read'], 'ok', 'authenticated')],
        deps: [d('BearerTokenAuthenticationFilter', 'AuthenticationManager', 'authenticate(token)', 'ok'), d('AuthenticationManager', 'SecurityContext', 'stores Authentication', 'ok')],
      },
      {
        note: 'ExceptionTranslationFilter wraps what follows, ready to turn security exceptions into 401 or 403 responses. Then AuthorizationFilter, the last one, checks the rule for this URL: GET /reports needs SCOPE_reports.read, and alice has it.',
        boxes: [b('e', 'ExceptionTranslationFilter', ['catches AccessDenied and Authentication exceptions'], 'ok'), b('z', 'AuthorizationFilter', ['rule: GET /reports/** needs SCOPE_reports.read', 'alice has it'], 'ok', 'allowed')],
        deps: [d('ExceptionTranslationFilter', 'AuthorizationFilter', 'next', 'ok')],
      },
      {
        note: 'The request finally reaches the controller. Method security (@PreAuthorize) and object-level checks can still run there. The SecurityContext is cleared when the request ends.',
        boxes: [b('z', 'AuthorizationFilter', ['allowed'], 'ok'), b('c', 'ReportController', ['@PreAuthorize passes', 'returns the report'], 'ok', '200 OK')],
        deps: [d('AuthorizationFilter', 'ReportController', 'request reaches the controller', 'ok')],
      },
    ],
  },
  {
    id: '401',
    label: 'No credentials (401)',
    title: 'No credentials: the request is stopped as unauthenticated',
    frames: [
      {
        note: 'A request arrives without any token or login.',
        boxes: [b('r', 'Request', ['GET /reports', 'no Authorization header'], 'warn'), b('f', 'FilterChainProxy', ['runs the chain'], 'ok')],
        deps: [d('Request', 'FilterChainProxy', 'enters', 'ok')],
      },
      {
        note: 'The authentication filter finds nothing to authenticate, so it does nothing. AnonymousAuthenticationFilter then puts an anonymous Authentication (ROLE_ANONYMOUS) in the SecurityContext.',
        boxes: [b('a', 'BearerTokenAuthenticationFilter', ['no token found: skip'], 'none'), b('n', 'AnonymousAuthenticationFilter', ['Authentication: anonymousUser'], 'warn'), b('s', 'SecurityContext', ['anonymous, no authorities'], 'warn')],
        deps: [d('BearerTokenAuthenticationFilter', 'AnonymousAuthenticationFilter', 'next', 'ok')],
      },
      {
        note: 'AuthorizationFilter evaluates the rule "/reports/** needs authentication" and denies the anonymous user by throwing an AccessDeniedException.',
        boxes: [b('z', 'AuthorizationFilter', ['rule needs an authenticated user', 'principal is anonymous'], 'bad', 'denied'), b('e', 'ExceptionTranslationFilter', ['catches AccessDeniedException'], 'warn')],
        deps: [d('AuthorizationFilter', 'ExceptionTranslationFilter', 'throws AccessDeniedException', 'bad')],
      },
      {
        note: 'Because the user is anonymous, ExceptionTranslationFilter calls the AuthenticationEntryPoint: a form-login app redirects to the login page, a token API returns 401 with a WWW-Authenticate header. The controller is never reached.',
        boxes: [b('e', 'ExceptionTranslationFilter', ['user is anonymous', 'start authentication'], 'warn'), b('p', 'AuthenticationEntryPoint', ['redirect to /login (form)', 'or 401 + WWW-Authenticate (API)'], 'bad', '401'), b('c', 'ReportController', ['never reached'], 'none')],
        deps: [d('ExceptionTranslationFilter', 'AuthenticationEntryPoint', 'commence()', 'bad')],
      },
    ],
  },
  {
    id: '403',
    label: 'No permission (403)',
    title: 'Logged in but not allowed: 403 Forbidden',
    frames: [
      {
        note: 'Bob is authenticated with a valid token, but it has only SCOPE_reports.read. He calls DELETE /reports/42, which needs the ADMIN role.',
        boxes: [b('r', 'Request', ['DELETE /reports/42', 'valid token for bob'], 'new'), b('s', 'SecurityContext', ['Authentication: bob', 'authorities: SCOPE_reports.read'], 'ok', 'authenticated')],
        deps: [d('Request', 'SecurityContext', 'authentication filter succeeded', 'ok')],
      },
      {
        note: 'AuthorizationFilter checks the rule "DELETE /reports/** needs ROLE_ADMIN". Bob has no such authority, so it throws AccessDeniedException.',
        boxes: [b('z', 'AuthorizationFilter', ['rule: DELETE needs ROLE_ADMIN', 'bob lacks it'], 'bad', 'denied'), b('e', 'ExceptionTranslationFilter', ['catches AccessDeniedException'], 'warn')],
        deps: [d('AuthorizationFilter', 'ExceptionTranslationFilter', 'throws AccessDeniedException', 'bad')],
      },
      {
        note: 'This time the user is not anonymous, so there is no point asking him to log in again. The AccessDeniedHandler answers 403 Forbidden. The controller is never reached.',
        boxes: [b('e', 'ExceptionTranslationFilter', ['user is authenticated', 'access denied'], 'warn'), b('h', 'AccessDeniedHandler', ['writes the response'], 'bad', '403'), b('c', 'ReportController', ['never reached'], 'none')],
        deps: [d('ExceptionTranslationFilter', 'AccessDeniedHandler', 'handle()', 'bad')],
      },
    ],
  },
  {
    id: 'csrf',
    label: 'CSRF check',
    title: 'A cookie-based form POST without a CSRF token is rejected early',
    frames: [
      {
        note: 'A malicious page makes the victim\'s browser submit POST /transfer. The browser attaches the session cookie automatically, so the request looks authenticated.',
        boxes: [b('m', 'Malicious page', ['hidden form posts to /transfer'], 'bad'), b('r', 'Request', ['POST /transfer', 'Cookie: SESSION=abc', 'no CSRF token'], 'warn')],
        deps: [d('Malicious page', 'Request', 'browser sends the cookie', 'bad')],
      },
      {
        note: 'CsrfFilter runs before authentication and authorization. For unsafe methods (POST, PUT, DELETE) it compares the token in the request header or form with the expected token. There is none, so it stops the request right there.',
        boxes: [b('c', 'CsrfFilter', ['POST needs a CSRF token', 'request has none'], 'bad', 'rejected'), b('h', 'AccessDeniedHandler', ['writes the response'], 'bad', '403'), b('z', 'AuthorizationFilter', ['never reached'], 'none')],
        deps: [d('CsrfFilter', 'AccessDeniedHandler', 'invalid CSRF token', 'bad')],
      },
      {
        note: 'The real form page contains the token (a hidden field or a header the page script adds), which a foreign site cannot read. Stateless APIs that use bearer tokens, not cookies, are not exposed to CSRF and usually disable it.',
        boxes: [b('r', 'Request', ['POST /transfer', 'Cookie: SESSION=abc', 'X-CSRF-TOKEN: 7f3a...'], 'ok'), b('c', 'CsrfFilter', ['token matches'], 'ok', 'passes')],
        deps: [d('Request', 'CsrfFilter', 'continue down the chain', 'ok')],
      },
    ],
  },
];
