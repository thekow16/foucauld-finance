import { useState } from "react";
import { registerUser, loginUser } from "../utils/auth";

export default function AuthModal({ onClose, onAuth }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let user;
      if (mode === "signup") {
        user = await registerUser(email, password, name);
      } else {
        user = await loginUser(email, password);
      }
      onAuth(user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>✕</button>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setError(null); }}
          >
            Connexion
          </button>
          <button
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => { setMode("signup"); setError(null); }}
          >
            S'inscrire
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <div className="auth-field">
              <label>Prénom / Pseudo</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ex : Jean"
                autoComplete="name"
              />
            </div>
          )}

          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@exemple.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "6 caractères min." : "Votre mot de passe"}
              required
              minLength={mode === "signup" ? 6 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Chargement…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <span>Pas encore de compte ? <button onClick={() => { setMode("signup"); setError(null); }}>S'inscrire</button></span>
          ) : (
            <span>Déjà un compte ? <button onClick={() => { setMode("login"); setError(null); }}>Se connecter</button></span>
          )}
        </div>
      </div>
    </div>
  );
}
