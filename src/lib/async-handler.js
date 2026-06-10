export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const ASYNC_ROUTER_METHODS = ["get", "post", "put", "patch", "delete", "options", "head", "all", "use"];

const wrapMiddleware = (handler) => {
  if (typeof handler !== "function" || handler.length >= 4) return handler;
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
};

export const patchRouterForAsync = (router) => {
  for (const method of ASYNC_ROUTER_METHODS) {
    if (typeof router[method] !== "function") continue;
    const original = router[method].bind(router);
    router[method] = (...handlers) => original(...handlers.map(wrapMiddleware));
  }
  return router;
};
