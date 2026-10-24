/** Configuration shared by the Angular application.
 *
 * In development `/api` is forwarded to Express by proxy.conf.json. In a
 * deployed application the web server should forward this same path to the API.
 */
export const environment = {
  apiBaseUrl: '/api',
  googleClientId: '383101839481-no6h3sj1fce5ghgqpsvmcl3n4jj48agu.apps.googleusercontent.com',
};
