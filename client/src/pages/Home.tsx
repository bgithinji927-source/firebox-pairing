import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Check, Clipboard, Copy, Download, KeyRound, LockKeyhole, Radio, ShieldCheck, Smartphone, Terminal, UserRound, Users, X } from "lucide-react";

const statusLabel = (status: string) => status === "linked" ? "LINKED" : status === "expired" ? "EXPIRED" : status === "failed" ? "FAILED" : "PENDING";

function SectionLabel({ children }: { children: React.ReactNode }) { return <div className="eyebrow"><span className="eyebrow-dot" />{children}</div>; }

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [phone, setPhone] = useState("");
  const [pairId, setPairId] = useState<string>();
  const [stage, setStage] = useState<"idle" | "request" | "code" | "linked" | "secret" | "error">("idle");
  const [error, setError] = useState("");
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const normalizedPhone = useMemo(() => phone.replace(/[^0-9]/g, ""), [phone]);
  const requestPairing = trpc.pairing.request.useMutation();
  const reveal = trpc.pairing.revealSecret.useMutation();
  const statusQuery = trpc.pairing.status.useQuery({ id: pairId ?? "pending" }, { enabled: Boolean(pairId), refetchInterval: stage === "code" ? 2000 : false });
  const historyQuery = trpc.pairing.recent.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    if (!statusQuery.data || stage !== "code") return;
    if (statusQuery.data.status === "linked") setStage("linked");
    if (statusQuery.data.status === "expired" || statusQuery.data.status === "failed") { setError(statusQuery.data.error || "The pairing worker could not complete this request."); setStage("error"); }
  }, [statusQuery.data, stage]);

  const beginPairing = async () => {
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) { setError("Enter a complete phone number with country code."); setStage("error"); return; }
    setError(""); setStage("request");
    try { const result = await requestPairing.mutateAsync({ phone: normalizedPhone }); setPairId(result.id); setStage("code"); }
    catch (err) { setError(err instanceof Error ? err.message : "Pairing worker unavailable. Check the server configuration."); setStage("error"); }
  };
  const revealSecret = async () => { if (!pairId) return; try { const result = await reveal.mutateAsync({ id: pairId }); setSecret(result.secret); setStage("secret"); } catch (err) { setError(err instanceof Error ? err.message : "The session is not ready to reveal."); setStage("error"); } };
  const copy = async (value: string) => { await navigator.clipboard?.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  const download = () => { const url = URL.createObjectURL(new Blob([secret], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = "firebox-session.txt"; a.click(); URL.revokeObjectURL(url); };
  if (loading) return <div className="boot-screen">INITIALIZING FIREBOX<span className="blink">_</span></div>;

  const activeCode = statusQuery.data?.code;
  const activeStatus = statusQuery.data?.status;
  return <div className="site-shell"><div className="scanlines" /><header className="topbar"><div className="brand-lockup"><div className="brand-mark">F</div><div><div className="brand-name">FIREBOX</div><div className="brand-sub">PRIVATE PAIRING NETWORK</div></div></div><div className="top-status"><span className="status-pip" />SYSTEM NOMINAL <span className="divider">/</span> NODE 01</div>{isAuthenticated ? <Button className="ghost-button" onClick={() => logout?.()}>SIGN OUT</Button> : <Button className="ghost-button" onClick={startLogin}>OWNER LOGIN <ArrowUpRight size={14} /></Button>}</header>
    <main className="main-grid"><section className="hero-panel hud-panel"><div className="corner corner-tl" /><div className="corner corner-tr" /><div className="corner corner-bl" /><div className="corner corner-br" /><div className="hero-copy"><SectionLabel>SECURE WHATSAPP LINKING</SectionLabel><h1>Your number.<br /><span>Under your control.</span></h1><p className="hero-text">Firebox is a private pairing console for authorized operators. Generate a one-time linking code, connect a device, and keep the session credential in a controlled channel.</p></div><div className="hero-metrics"><div><strong>01</strong><span>OWNER NODE</span></div><div><strong>60S</strong><span>LINK WINDOW</span></div><div><strong>VAULT</strong><span>SECRET DELIVERY</span></div></div></section>
      <section className="pair-card hud-panel"><div className="panel-header"><div><SectionLabel>PAIRING CONSOLE</SectionLabel><h2>Connect a device</h2></div><div className="live-chip"><Radio size={13} /> LIVE</div></div>{!isAuthenticated ? <div className="auth-wall"><div className="lock-orb"><LockKeyhole size={28} /></div><h3>AUTHORIZED ACCESS REQUIRED</h3><p>This console is private. Sign in with an approved Firebox account to request a WhatsApp pairing session.</p><Button className="neon-button" onClick={startLogin}>AUTHENTICATE <ArrowUpRight size={16} /></Button><div className="auth-note"><ShieldCheck size={14} /> No session data is exposed before authorization.</div></div> : <>{stage === "idle" || stage === "error" ? <div className="pair-form"><label htmlFor="phone">PHONE NUMBER <span>COUNTRY CODE REQUIRED</span></label><div className="input-wrap"><Smartphone size={17} /><Input id="phone" placeholder="256 742 932 677" value={phone} onChange={e => setPhone(e.target.value)} /></div><p className="field-help">Use the number that will be linked to Firebox. Digits are transmitted only to the server-side worker.</p>{stage === "error" && <div className="error-box"><X size={16} />{error}</div>}<Button className="neon-button full" onClick={beginPairing} disabled={requestPairing.isPending}>REQUEST LINKING CODE <ArrowUpRight size={16} /></Button></div> : stage === "request" ? <div className="processing"><div className="radar" /><h3>OPENING SECURE CHANNEL</h3><p>Contacting the integrated Firebox pairing worker…</p><div className="progress-line"><span /></div></div> : stage === "code" ? <div className="code-stage"><div className="instruction-row"><div className="step-num">01</div><div><strong>Open WhatsApp Linked Devices</strong><p>WhatsApp → Settings → Linked devices → Link a device</p></div></div><div className="instruction-row"><div className="step-num">02</div><div><strong>Enter this linking code</strong><p>Use the code before the server-side window expires.</p></div></div><div className="pair-code">{activeCode || "WAITING"}</div><div className="expiry"><span className="status-pip amber" /> {activeStatus === "pending" ? "PAIRING WORKER ACTIVE" : statusLabel(activeStatus || "pending")}</div></div> : stage === "linked" ? <div className="success-stage"><div className="success-icon"><Check size={30} /></div><SectionLabel>LINK CONFIRMED</SectionLabel><h3>Device connected</h3><p>The server has confirmed the WhatsApp link. Reveal the session only when you are ready to store it securely.</p><Button className="neon-button full" onClick={revealSecret} disabled={reveal.isPending}>REVEAL SESSION ONCE <KeyRound size={16} /></Button></div> : <div className="success-stage"><div className="success-icon"><Check size={30} /></div><SectionLabel>SECRET RELEASED</SectionLabel><h3>Store this securely</h3><p>This value is shown once by design. Copy it to an encrypted environment variable or password manager.</p><div className="secret-box"><span>{secret}</span><Button className="icon-button" onClick={() => copy(secret)} aria-label="Copy session"><Copy size={16} /></Button></div><div className="action-row"><Button className="outline-button" onClick={() => copy(secret)}>{copied ? <Check size={15} /> : <Clipboard size={15} />} {copied ? "COPIED" : "COPY SECRET"}</Button><Button className="outline-button" onClick={download}><Download size={15} /> DOWNLOAD</Button></div><div className="secret-warning"><KeyRound size={14} /><span><strong>Secret handling:</strong> this value grants access to the linked session. Never paste it into public chats or commit it to source control.</span></div></div>}</>}</section>
      <section className="access-panel hud-panel"><div className="panel-header"><div><SectionLabel>ACCESS CONTROL</SectionLabel><h2>Private by design</h2></div><Users size={21} className="cyan-icon" /></div><div className="access-row"><div className="access-avatar"><UserRound size={18} /></div><div><strong>{user?.name || "Owner account"}</strong><p>{user ? "Authenticated operator" : "Awaiting authentication"}</p></div><Badge className="access-badge">{user ? "APPROVED" : "LOCKED"}</Badge></div><Separator /><div className="security-list"><div><ShieldCheck size={16} /><span>Owner approval required</span><b>ON</b></div><div><LockKeyhole size={16} /><span>Server-side secret reveal</span><b>ON</b></div><div><Terminal size={16} /><span>Audit trail</span><b>{historyQuery.data ? `${historyQuery.data.length} RECORDS` : "READY"}</b></div></div></section>
      <section className="history-panel hud-panel"><div className="panel-header"><div><SectionLabel>OWNER VIEW</SectionLabel><h2>Recent requests</h2></div><span className="history-count">{historyQuery.data ? `${String(historyQuery.data.length).padStart(2, "0")} RECORDS` : "LIVE LOG"}</span></div><div className="history-list">{historyQuery.data?.slice(0, 3).map(item => <div className="history-item" key={item.id}><div className={`history-icon ${item.status}`}><Radio size={14} /></div><div className="history-main"><strong>{item.phone}</strong><span>{new Date(item.createdAt).toLocaleString()}</span></div><span className={`history-status ${item.status}`}>{statusLabel(item.status)}</span></div>) || <div className="empty-history">No pairing requests recorded yet.</div>}</div><Button className="text-button">OPEN FULL AUDIT LOG <ArrowUpRight size={15} /></Button></section></main><footer className="footer"><span>FIREBOX // PRIVATE CHANNEL</span><span>SESSION VALUES NEVER LOGGED</span><span>BUILD 0.2.0</span></footer></div>;
}
