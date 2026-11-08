'use strict';
class HttpError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra; }
}
const bad = (code, msg, extra) => new HttpError(400, code, msg, extra);
const unauthorized = (msg = 'Entre na sua conta para continuar.') => new HttpError(401, 'unauthorized', msg);
const forbidden = (code = 'forbidden', msg = 'Você não tem permissão para isso.', extra) => new HttpError(403, code, msg, extra);
const notFound = (msg = 'Não encontramos o que você procura.') => new HttpError(404, 'not_found', msg);
const conflict = (code, msg, extra) => new HttpError(409, code, msg, extra);
module.exports = { HttpError, bad, unauthorized, forbidden, notFound, conflict };
