function Router() {
  const routes = [];
  const add = (method) => (path, ...handlers) => routes.push({ method, path, handlers });
  return { routes, get: add('get'), post: add('post'), all: add('all') };
}
module.exports = { Router };
