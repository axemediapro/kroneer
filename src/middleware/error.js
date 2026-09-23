function notFoundHandler(req, res, next) {
  res.status(404).render('partials/error', {
    pageTitle: 'Faqja nuk u gjet - 404',
    statusCode: 404,
    errorMessage: 'Faqja që kërkuat nuk ekziston ose mund të jetë zhvendosur.',
    layout: 'layouts/main'
  });
}

function errorHandler(err, req, res, next) {
  console.error('Gabim në server:', err);
  res.status(500).render('partials/error', {
    pageTitle: 'Gabim i brendshëm i sistemit - 500',
    statusCode: 500,
    errorMessage: 'Ndodhi një problem i papritur gjatë procesimit të kërkesës.',
    layout: 'layouts/main'
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
