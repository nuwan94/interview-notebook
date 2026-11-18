// Frame data for the "Express middleware" walk-through (box-and-arrow player).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const MIDDLEWARE_SCENES = [
  {
    id: 'stack',
    label: 'The layer stack',
    title: 'Registered in order, run in order',
    frames: [
      {
        note: 'Express keeps a list of layers. Every app.use, router.use and route adds one layer with a path and a function. When a request arrives, Express walks the list from the top and runs the first layer whose path and method match.',
        boxes: [b('r', 'Incoming request', ['GET /accounts/42'], 'none'), b('l', 'Layer list', ['in registration order'], 'new'), b('f', 'First matching layer', ['runs now'], 'ok')],
        deps: [d('Incoming request', 'Layer list', 'enters', 'ok'), d('Layer list', 'First matching layer', 'walks to', 'ok')],
      },
      {
        note: 'The function gets req, res and next. next is how Express moves on: calling it runs the search again from the next layer in the list. A middleware that calls next() is saying that this request is not finished.',
        boxes: [b('a', 'Layer 1: logger', ['logs, calls next()'], 'ok'), b('b', 'Layer 2: parser', ['reads body, calls next()'], 'ok'), b('c', 'Layer 3: route', ['sends the response'], 'new')],
        deps: [d('Layer 1: logger', 'Layer 2: parser', 'next()', 'ok'), d('Layer 2: parser', 'Layer 3: route', 'next()', 'ok')],
      },
      {
        note: 'A layer ends the chain by sending a response and not calling next. Layers after it never see the request. If every layer calls next and nobody responds, Express reaches the end of the list and sends its default 404.',
        boxes: [b('a', 'Layer: auth', ['no token'], 'warn'), b('r', 'Response sent', ['401, chain stops'], 'bad'), b('s', 'Later layers', ['never run'], 'none')],
        deps: [d('Layer: auth', 'Response sent', 'res.status(401)', 'bad'), d('Response sent', 'Later layers', 'skipped', 'none')],
      },
      {
        note: 'Order is design. A body parser after the routes means req.body is empty in them. Auth after a public route leaves it open. A logger first sees every request, even rejected ones. Put cheap, general layers first and specific ones close to their routes.',
        boxes: [b('p', 'Parser after the route', ['req.body is undefined'], 'bad'), b('o', 'Parser before the route', ['req.body is ready'], 'ok'), b('x', 'Order is a decision', ['review it like code'], 'new')],
        deps: [d('Parser before the route', 'Order is a decision', 'correct', 'ok')],
      },
    ],
  },
  {
    id: 'next',
    label: 'The next() family',
    title: 'Four ways to pass control',
    frames: [
      {
        note: 'next() with no argument means continue with the next matching layer. It is the normal case. Calling it twice, or calling it after sending a response, causes errors such as headers already sent.',
        boxes: [b('m', 'Middleware', ['next()'], 'new'), b('n', 'Next matching layer', ['continues'], 'ok')],
        deps: [d('Middleware', 'Next matching layer', 'plain next', 'ok')],
      },
      {
        note: 'next(err) with any value except the strings route and router means an error. Express skips every normal layer and jumps to the next error-handling middleware, the one that takes four arguments. A thrown error in a synchronous layer does the same.',
        boxes: [b('m', 'Middleware throws', ['next(err)'], 'bad'), b('s', 'Normal layers skipped', ['route, parser'], 'none'), b('e', 'Error handler', ['(err, req, res, next)'], 'new')],
        deps: [d('Middleware throws', 'Normal layers skipped', 'skips', 'none'), d('Middleware throws', 'Error handler', 'jumps to', 'warn')],
      },
      {
        note: 'next("route") skips the rest of the handlers of the current route and goes on to the next matching route. It is used when several handlers are given to one route and one of them decides this route does not apply, for example a feature flag.',
        boxes: [b('a', 'Route A handler 1', ['next("route")'], 'warn'), b('s', 'Route A handler 2', ['skipped'], 'none'), b('b', 'Route B', ['runs instead'], 'ok')],
        deps: [d('Route A handler 1', 'Route A handler 2', 'skips', 'none'), d('Route A handler 1', 'Route B', 'continues with', 'ok')],
      },
      {
        note: 'next("router") leaves the current router entirely and goes back to the parent. A guard at the top of an admin router uses it to hand non-admin requests back to the app, where a general handler or the 404 deals with them.',
        boxes: [b('g', 'Router guard', ['next("router")'], 'warn'), b('r', 'Rest of the router', ['skipped'], 'none'), b('p', 'Parent app', ['continues after the router'], 'ok')],
        deps: [d('Router guard', 'Rest of the router', 'skips', 'none'), d('Router guard', 'Parent app', 'returns to', 'ok')],
      },
    ],
  },
  {
    id: 'mount',
    label: 'Routers and mount paths',
    title: 'Mounting changes what the code sees',
    frames: [
      {
        note: 'app.use("/api/accounts", router) mounts a router under a path. Inside it, req.url has the mount path removed, so the router declares routes relative to itself: "/" and "/:id". req.baseUrl holds the mounted part and req.originalUrl the full URL.',
        boxes: [b('o', 'originalUrl', ['/api/accounts/42'], 'none'), b('b', 'baseUrl', ['/api/accounts'], 'ok'), b('u', 'req.url inside', ['/42'], 'new')],
        deps: [d('originalUrl', 'baseUrl', 'split into', 'ok'), d('originalUrl', 'req.url inside', 'split into', 'ok')],
      },
      {
        note: 'Middleware can be attached at three levels. At the app, it runs for every matching request. At a router, only for that feature. On a single route, only for that endpoint. Use the narrowest level that fits, so a public route does not pay for admin checks.',
        boxes: [b('a', 'App level', ['logger, parser'], 'ok'), b('r', 'Router level', ['authenticate'], 'ok'), b('e', 'Route level', ['requireScope, validate'], 'new')],
        deps: [d('App level', 'Router level', 'then', 'ok'), d('Router level', 'Route level', 'then', 'ok')],
      },
      {
        note: 'Routers nest, and path parameters of the parent are not visible to the child unless the child is created with mergeParams: true. router.param("id", fn) runs once whenever a route has an :id, which is a good place to load and check the account.',
        boxes: [b('p', 'Parent route', ['/accounts/:id'], 'none'), b('c', 'Child router', ['mergeParams: true'], 'new'), b('l', 'router.param loader', ['loads account once'], 'ok')],
        deps: [d('Parent route', 'Child router', 'mounted with', 'ok'), d('Child router', 'router.param loader', 'uses', 'ok')],
      },
    ],
  },
  {
    id: 'context',
    label: 'Context, hooks and errors',
    title: 'Per-request state and the error path',
    frames: [
      {
        note: 'A request id belongs to the whole request, including code deep inside services that never receive req. AsyncLocalStorage keeps a store that follows the request through awaits. The middleware starts the store, and any code can read the id for its logs.',
        boxes: [b('m', 'context middleware', ['als.run(store, next)'], 'new'), b('s', 'Request store', ['requestId, userId'], 'ok'), b('d', 'Deep service code', ['logger reads the store'], 'ok')],
        deps: [d('context middleware', 'Request store', 'creates', 'ok'), d('Request store', 'Deep service code', 'follows the awaits', 'ok')],
      },
      {
        note: 'A middleware can run code after the handler by listening to the response. res.on("finish") fires when the response has been handed to the network. That is where to log the status code and duration, because they are not known when the middleware starts.',
        boxes: [b('s', 'Start timer', ['before next()'], 'ok'), b('h', 'Handler runs', ['sets the status'], 'ok'), b('f', 'finish event', ['log status and ms'], 'new')],
        deps: [d('Start timer', 'Handler runs', 'next()', 'ok'), d('Handler runs', 'finish event', 'then', 'ok')],
      },
      {
        note: 'The error middleware sits last. It maps known errors to status codes, logs unknown ones with the request id, and answers with a safe body. If the response has already started it cannot change the status, so it passes the error on and Express closes the connection.',
        boxes: [b('e', 'Error middleware', ['four arguments, last'], 'new'), b('k', 'Known error', ['422 with a code'], 'ok'), b('u', 'Unknown error', ['500, details only in logs'], 'warn')],
        deps: [d('Error middleware', 'Known error', 'maps', 'ok'), d('Error middleware', 'Unknown error', 'hides', 'warn')],
      },
    ],
  },
];
