import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import UsersDAO from "../dao/UsersDAO.js";

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const row = await UsersDAO.findByEmail(email);
        if (!row)
          return done(null, false, { message: "Credenziali non valide" });
        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok)
          return done(null, false, { message: "Credenziali non valide" });

        const user = {
          id: row.id,
          email: row.email,
          role: row.role,
          first_name: row.first_name,
          last_name: row.last_name,
          city: row.city,
          cap: row.cap,
          address: row.address,
        };
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const u = await UsersDAO.findPublicById(id);
    done(null, u || null);
  } catch (err) {
    done(err);
  }
});

export default passport;
