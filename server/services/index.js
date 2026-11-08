'use strict';
/** Monta todos os serviços sobre um contexto. */
module.exports = function buildServices(ctx) {
  const accounts = require('./accounts')(ctx);
  const profiles = require('./profiles')(ctx);
  const plans = require('./plans')(ctx);
  const discovery = require('./discovery')(ctx, { profiles, plans });
  const chat = require('./chat')(ctx, { profiles });
  const safety = require('./safety')(ctx, { profiles });
  const paths = require('./paths')(ctx, { profiles, plans });
  const popularity = require('./popularity')(ctx);
  const privacy = require('./privacy')(ctx, { profiles, plans });
  const admin = require('./admin')(ctx, { profiles, plans, accounts });
  return { accounts, profiles, plans, discovery, chat, safety, paths, popularity, privacy, admin };
};
