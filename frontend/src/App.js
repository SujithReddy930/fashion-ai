import { useState, useEffect } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";
import FashionAI from "./FashionAI";

const Logo = ({ dark = false }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{
        width: "36px", height: "36px", borderRadius: "50%",
        background: dark ? "#d4b48c" : "#0a0a0a",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: "900", fontSize: "17px",
        color: dark ? "#1a0e00" : "#d4b48c",
        fontFamily: "Georgia, serif", flexShrink: 0
      }}>F</div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "1.45rem", fontWeight: "800", letterSpacing: "0.06em", color: dark ? "#d4b48c" : "#0a0a0a" }}>
        FASHION<span style={{ fontWeight: "300", color: dark ? "#fff" : "#555" }}>·AI</span>
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "4px" }}>
      <div style={{ height: "1px", width: "36px", background: dark ? "#d4b48c" : "#0a0a0a", opacity: 0.4 }} />
      <span style={{ fontSize: "9px", letterSpacing: "0.3em", textTransform: "uppercase", color: dark ? "rgba(212,180,140,0.6)" : "#aaa", fontFamily: "sans-serif" }}>Your AI Stylist</span>
      <div style={{ height: "1px", width: "36px", background: dark ? "#d4b48c" : "#0a0a0a", opacity: 0.4 }} />
    </div>
  </div>
);

const inputStyle = {
  width: "100%", padding: "10px 12px",
  border: "1px solid #e8e6e0", borderRadius: "8px",
  fontSize: "13px", color: "#0a0a0a",
  fontFamily: "sans-serif", outline: "none",
  background: "#faf9f7", boxSizing: "border-box"
};

const labelStyle = {
  display: "block", fontSize: "10px",
  letterSpacing: "0.15em", textTransform: "uppercase",
  color: "#aaa", marginBottom: "5px",
  fontFamily: "sans-serif"
};

const friendlyError = (code) => {
  switch (code) {
    case "auth/user-not-found": return "No account found with this email.";
    case "auth/wrong-password": return "Incorrect password.";
    case "auth/invalid-credential": return "Invalid email or password.";
    case "auth/email-already-in-use": return "This email is already registered.";
    case "auth/invalid-email": return "Please enter a valid email address.";
    case "auth/too-many-requests": return "Too many attempts. Try again later.";
    case "auth/weak-password": return "Password must be at least 6 characters.";
    default: return "Something went wrong. Please try again.";
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u); setAuthLoading(false);
    });
    return unsub;
  }, []);

  const switchMode = (m) => {
    setMode(m); setError(""); setSuccess("");
    setName(""); setEmail(""); setPassword(""); setConfirmPassword("");
  };

  const handleLogin = async () => {
    if (!email || !password) return setError("Please fill in all fields.");
    setSubmitting(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) { setError(friendlyError(e.code)); }
    finally { setSubmitting(false); }
  };

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword)
      return setError("Please fill in all fields.");
    if (password !== confirmPassword)
      return setError("Passwords do not match.");
    if (password.length < 6)
      return setError("Password must be at least 6 characters.");
    setSubmitting(true); setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      setSuccess("Account created! Welcome to Fashion AI.");
    } catch (e) { setError(friendlyError(e.code)); }
    finally { setSubmitting(false); }
  };

  const handleLogout = () => signOut(auth);

  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "36px", height: "36px", border: "2px solid rgba(212,180,140,0.2)", borderTop: "2px solid #d4b48c", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (user) return <FashionAI user={user} onLogout={handleLogout} />;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", fontFamily: "sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "860px", display: "grid", gridTemplateColumns: "1fr 1fr", borderRadius: "20px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>

        {/* LEFT PANEL */}
        <div style={{ background: "#0a0a0a", padding: "2.5rem", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden", minHeight: "580px" }}>
          <div style={{ position: "absolute", top: "-80px", left: "-60px", width: "280px", height: "280px", borderRadius: "50%", background: "radial-gradient(circle,rgba(212,180,140,0.15) 0%,transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-60px", right: "-40px", width: "240px", height: "240px", borderRadius: "50%", background: "radial-gradient(circle,rgba(160,100,200,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <Logo dark />
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontFamily: "Georgia,serif", fontSize: "1.75rem", fontWeight: "800", color: "#fff", lineHeight: 1.25, marginBottom: "0.75rem" }}>
              Dress with<br />
              <span style={{ color: "#d4b48c", fontStyle: "italic" }}>intelligence.</span><br />
              Style with AI.
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.25rem" }}>
              Powered by CLIP · ViT · SBERT
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {["Classify", "Recommend", "Colors", "Search"].map((f, i) => (
                <div key={f} style={{ padding: "4px 10px", borderRadius: "100px", background: i === 0 ? "rgba(212,180,140,0.2)" : "rgba(255,255,255,0.06)", border: i === 0 ? "1px solid rgba(212,180,140,0.4)" : "1px solid rgba(255,255,255,0.1)", fontSize: "10px", color: i === 0 ? "#d4b48c" : "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>{f}</div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ background: "#fff", padding: "2.5rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <h1 style={{ fontSize: "1.3rem", fontWeight: "700", color: "#0a0a0a", fontFamily: "Georgia,serif", margin: "0 0 4px" }}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p style={{ fontSize: "12px", color: "#aaa", margin: 0 }}>
              {mode === "login" ? "Sign in to your Fashion AI account" : "Join Fashion AI and discover your style"}
            </p>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", background: "#f5f4f1", borderRadius: "8px", padding: "3px", marginBottom: "1.5rem" }}>
            {[["login", "Sign In"], ["signup", "Create Account"]].map(([m, label]) => (
              <button key={m} onClick={() => switchMode(m)} style={{ flex: 1, padding: "8px", background: mode === m ? "#0a0a0a" : "transparent", color: mode === m ? "#d4b48c" : "#aaa", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: mode === m ? "700" : "400", cursor: "pointer", letterSpacing: "0.04em", transition: "all 0.2s" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Fields */}
          {mode === "signup" && (
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Full Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" style={inputStyle} />
            </div>
          )}

          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
          </div>

          <div style={{ marginBottom: mode === "signup" ? "12px" : "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
              {mode === "login" && <span style={{ fontSize: "10px", color: "#aaa", cursor: "pointer", letterSpacing: "0.05em" }}>Forgot password?</span>}
            </div>
            <div style={{ position: "relative" }}>
              <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && mode === "login" && handleLogin()} placeholder="••••••••" style={{ ...inputStyle, paddingRight: "36px" }} />
              <span onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", fontSize: "12px", color: "#bbb", userSelect: "none" }}>
                {showPass ? "hide" : "show"}
              </span>
            </div>
          </div>

          {mode === "signup" && (
            <div style={{ marginBottom: "6px" }}>
              <label style={labelStyle}>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div style={{ padding: "9px 12px", margin: "10px 0 4px", background: "#fff5f5", border: "1px solid #fcc", borderRadius: "7px", color: "#c00", fontSize: "12px" }}>
              ⚠ {error}
            </div>
          )}
          {success && (
            <div style={{ padding: "9px 12px", margin: "10px 0 4px", background: "#f0fff4", border: "1px solid #9ae6b4", borderRadius: "7px", color: "#276749", fontSize: "12px" }}>
              ✓ {success}
            </div>
          )}

          {/* Submit */}
          <button onClick={mode === "login" ? handleLogin : handleSignup} disabled={submitting} style={{ width: "100%", padding: "12px", background: submitting ? "#555" : "#0a0a0a", color: "#d4b48c", border: "none", borderRadius: "10px", fontSize: "12px", fontWeight: "700", letterSpacing: "0.12em", cursor: submitting ? "not-allowed" : "pointer", marginTop: "14px", textTransform: "uppercase" }}>
            {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>

          {/* Switch */}
          <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "11px", color: "#aaa" }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => switchMode(mode === "login" ? "signup" : "login")} style={{ color: "#0a0a0a", fontWeight: "700", cursor: "pointer" }}>
              {mode === "login" ? "Sign Up" : "Sign In"}
            </span>
          </p>

          {mode === "signup" && (
            <p style={{ textAlign: "center", fontSize: "10px", color: "#ccc", marginTop: "0.5rem", lineHeight: 1.6 }}>
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #ccc; }
        input:focus { border-color: #0a0a0a !important; }
        @media (max-width: 600px) {
          div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}