import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";

const SQLiteStore = SQLiteStoreFactory(session);

export function makeSessionMiddleware({
  dbFile = "./server/db/app.sqlite",
  secret = process.env.SESSION_SECRET || "dev-secret-change-me",
  isProd = process.env.NODE_ENV === "production",

  shortMs = 1000 * 60 * 60 * 2, // 2 ore, senza spuntare la casella ricordami per 30 giorni dopo
  //  due ore che non interagisco con il borwser (es: ho il sito aperto ma non faccio nessuna richiesta
  //  o chiudo il sito per 2 ore) mi effettua il logout dall'account.
  longMs = 1000 * 60 * 60 * 24 * 30, // 30 giorni, spuntando la casella di ricordami per 30 giorni,
  //  anche se non faccio richieste per 2 ore l'account rimane connesso per 30 giorni. Ogni volta
  // che faccio una richiesta il timer di 30 giorni si resetta, se non faccio richieste per 30 giorni di file
  // viene effettuato il logout.
  //SE EFFETTUO IL LOGOUT --> la sessione si distrugge e verrà nuovamente impostata la scadenza
  // di default di 2 ore se effettuo il login senza spuntare la casella ricordami
} = {}) {
  const base = session({
    store: new SQLiteStore({
      // usa la stessa base dati, crea tabella "sessions" automaticamente
      db: dbFile.split("/").pop(),
      dir: dbFile.replace(/[/\\][^/\\]+$/, ""), // directory del file
      table: "sessions",
    }),
    name: "sid", // nome del cookie
    secret,
    resave: false,
    saveUninitialized: false, // non creare sessioni vuote
    rolling: true, // rinnova maxAge ad ogni richiesta
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd, // true SOLO in https (prod)
      maxAge: shortMs, // default breve; potrà essere esteso con “ricordami”
    },
  });

  // middleware che applica durata lunga se flag “rememberMe” presente
  function rememberMeMiddleware(req, _res, next) {
    // se è impostato req.session.rememberMe => estendi maxAge
    if (req.session && req.session.rememberMe) {
      req.session.cookie.maxAge = longMs;
    }
    next();
  }

  return [base, rememberMeMiddleware];
}
