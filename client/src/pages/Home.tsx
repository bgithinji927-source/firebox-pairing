import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Check, Clipboard, Copy, Download, KeyRound, Radio, Smartphone, Terminal, X } from "lucide-react";

const statusLabel = (status: string) => status === "linked" ? "LINKED" : status === "expired" ? "EXPIRED" : status === "failed" ? "FAILED" : "PENDING";
function SectionLabel({ children }: { children: React.ReactNode }) { return <div className="eyebrow"><span className="eyebrow-dot" />{children}</div>; }

export default function Home() {
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"code" | "qr">("code");
  const [pairId, setPairId] = useState<string>();
  const [stage, setStage] = useState<"idle" | "request" | "code" | "linked" | "secret" | "error">("idle");
  const [error, setError] = useState("");
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const normalizedPhone = useMemo(() => phone.replace(/[^0-9]/g, ""), [phone]);
  const requestPairing = trpc.pairing.request.useMutation();
  const reveal = trpc.pairing.revealSecret.useMutation();
  const statusQuery = trpc.pairing.status.useQuery({ id: pairId ?? "pending" }, { enabled: Boolean(pairId), refetchInterval: stage === "code" ? 2000 : false });
  const historyQuery = trpc.pairing.recent.useQuery(undefined);

  useEffect(() => {
    if (!statusQuery.data || stage !== "code") return;
    if (statusQuery.data.status === "linked") setStage("linked");
    if (statusQuery.data.status === "expired" || statusQuery.data.status === "failed") { setError(statusQuery.data.error || "The pairing worker could not complete this request."); setStage("error"); }
  }, [statusQuery.data, stage]);

  const beginPairing = async () => {
    if (mode === "code" && (normalizedPhone.length < 10 || normalizedPhone.length > 15)) { setError("Enter a complete phone number with country code."); setStage("error"); return; }
    setError(""); setStage("request");
    try { const result = await requestPairing.mutateAsync({ phone: mode === "code" ? normalizedPhone : undefined, mode }); setPairId(result.id); setStage("code"); }
    catch (err) { setError(err instanceof Error ? err.message : "Pairing worker unavailable. Check the server configuration."); setStage("error"); }
  };
  const revealSecret = async () => { if (!pairId) return; try { const result = await reveal.mutateAsync({ id: pairId }); setSecret(result.secret); setStage("secret"); } catch (err) { setError(err instanceof Error ? err.message : "The session is not ready to reveal."); setStage("error"); } };
  const copy = async (value: string) => { await navigator.clipboard?.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  const download = () => { const url = URL.createObjectURL(new Blob([secret], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = "firebox-session.txt"; a.click(); URL.revokeObjectURL(url); };
  const activeCode = statusQuery.data?.code;
  const activeStatus = statusQuery.data?.status;

  return <div className="site-shell"><div className="scanlines" />
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark">F</div><div><div className="brand-name">FIREBOX</div><div className="brand-sub">PAIRING NETWORK // PUBLIC MODE</div></div></div><div className="top-status"><span className="status-pip" />SYSTEM NOMINAL <span className="divider">/</span> NODE 01</div><span className="public-mode-chip">AUTH DISABLED</span></header>
    <main className="main-grid">
      <section className="hero-panel hud-panel"><div className="corner corner-tl" /><div className="corner corner-tr" /><div className="corner corner-bl" /><div className="corner corner-br" /><div className="hero-copy"><SectionLabel>SECURE WHATSAPP LINKING</SectionLabel><h1>Your number.<br /><span>Under your control.</span></h1><p className="hero-text">Firebox is a temporary public pairing console. Generate a one-time linking code, connect a device, and move the session credential into your private bot deployment immediately.</p></div><div className="hero-metrics"><div><strong>01</strong><span>PAIRING NODE</span></div><div><strong>60S</strong><span>LINK WINDOW</span></div><div><strong>VAULT</strong><span>SESSION DELIVERY</span></div></div></section>
      <section className="pair-card hud-panel"><div className="panel-header"><div><SectionLabel>PAIRING CONSOLE</SectionLabel><h2>Connect a device</h2></div><div className="live-chip"><Radio size={13} /> LIVE</div></div>
        {stage === "idle" || stage === "error" ? <div className="pair-form"><div className="mode-toggle" role="group" aria-label="Pairing mode"><button type="button" className={mode === "code" ? "mode-button active" : "mode-button"} onClick={() => setMode("code")}>PHONE CODE</button><button type="button" className={mode === "qr" ? "mode-button active" : "mode-button"} onClick={() => setMode("qr")}>QR SCAN</button></div>{mode === "code" ? <><label htmlFor="phone">PHONE NUMBER <span>COUNTRY CODE REQUIRED</span></label><div className="input-wrap"><Smartphone size={17} /><Input id="phone" placeholder="256 742 932 677" value={phone} onChange={e => setPhone(e.target.value)} /></div><p className="field-help">Use the number that will be linked to Firebox. Digits are transmitted only to the server-side worker.</p></> : <div className="qr-mode-note"><Radio size={16} /><span>QR mode does not require a phone number. Scan the QR from WhatsApp → Linked devices.</span></div>}{stage === "error" && <div className="error-box"><X size={16} />{error}</div>}<Button className="neon-button full" onClick={beginPairing} disabled={requestPairing.isPending}>{mode === "qr" ? "GENERATE QR CODE" : "REQUEST LINKING CODE"} <ArrowUpRight size={16} /></Button></div>
          : stage === "request" ? <div className="processing"><div className="radar" /><h3>OPENING SECURE CHANNEL</h3><p>Contacting the integrated Firebox pairing worker…</p><div className="progress-line"><span /></div></div>
          : stage === "code" ? <div className="code-stage">{mode === "qr" ? <><div className="instruction-row"><div className="step-num">01</div><div><strong>Open WhatsApp Linked Devices</strong><p>WhatsApp → Settings → Linked devices → Link a device, then scan this QR.</p></div></div><div className="qr-frame">{statusQuery.data?.qr ? <img src={statusQuery.data.qr} alt="WhatsApp pairing QR code" /> : <div className="qr-wait">WAITING FOR QR SIGNAL<span className="blink">_</span></div>}</div></> : <><div className="instruction-row"><div className="step-num">01</div><div><strong>Open WhatsApp Linked Devices</strong><p>WhatsApp → Settings → Linked devices → Link a device → <b>Link with phone number instead</b></p></div></div><div className="instruction-row"><div className="step-num">02</div><div><strong>Enter this linking code</strong><p>Do not use the QR scanner. Choose “Link with phone number instead,” then enter this exact code before it expires.</p></div></div><div className="pair-code">{activeCode || "WAITING"}</div><Button className="outline-button code-copy" onClick={() => activeCode && copy(activeCode)} disabled={!activeCode}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "CODE COPIED" : "COPY EXACT CODE"}</Button></>}<div className="expiry"><span className="status-pip amber" /> {activeStatus === "pending" ? "PAIRING WORKER ACTIVE" : statusLabel(activeStatus || "pending")}</div></div>
          : stage === "linked" ? <div className="success-stage"><div className="success-icon"><Check size={30} /></div><SectionLabel>LINK CONFIRMED</SectionLabel><h3>Device connected</h3><p>The device is linked. Firebox saved the full session in the server vault and generated a short token for the bot runtime.</p>{statusQuery.data?.token ? <><div className="secret-box"><span>{statusQuery.data.token}</span><Button className="icon-button" onClick={() => copy(statusQuery.data?.token || "")} aria-label="Copy session token"><Copy size={16} /></Button></div><Button className="outline-button full" onClick={() => copy(statusQuery.data?.token || "")}>{copied ? <Check size={15} /> : <Clipboard size={15} />} {copied ? "TOKEN COPIED" : "COPY BOT TOKEN"}</Button></> : <Button className="neon-button full" onClick={revealSecret} disabled={reveal.isPending}>REVEAL SESSION ONCE <KeyRound size={16} /></Button>}</div>
          : <div className="success-stage"><div className="success-icon"><Check size={30} /></div><SectionLabel>SECRET RELEASED</SectionLabel><h3>Store this securely</h3><p>This value is shown once by design. Copy it to the private bot service and never commit it to source control.</p><div className="secret-box"><span>{secret}</span><Button className="icon-button" onClick={() => copy(secret)} aria-label="Copy session"><Copy size={16} /></Button></div><div className="action-row"><Button className="outline-button" onClick={() => copy(secret)}>{copied ? <Check size={15} /> : <Clipboard size={15} />} {copied ? "COPIED" : "COPY SECRET"}</Button><Button className="outline-button" onClick={download}><Download size={15} /> DOWNLOAD</Button></div><div className="secret-warning"><KeyRound size={14} /><span><strong>Temporary public mode:</strong> anyone with this URL can request a pairing. Treat this session as a live credential.</span></div></div>}
      </section>
      <section className="access-panel hud-panel"><div className="panel-header"><div><SectionLabel>RUNTIME STATUS</SectionLabel><h2>Temporary public mode</h2></div><Terminal size={21} className="cyan-icon" /></div><div className="access-row"><div className="access-avatar"><Radio size={18} /></div><div><strong>Public pairing console</strong><p>OAuth disabled for this deployment</p></div><span className="access-badge">PUBLIC</span></div><div className="security-list"><div><Radio size={16} /><span>OAuth access gate</span><b>OFF</b></div><div><KeyRound size={16} /><span>Session redaction</span><b>ON</b></div><div><Terminal size={16} /><span>Audit trail</span><b>{historyQuery.data ? `${historyQuery.data.length} RECORDS` : "READY"}</b></div></div></section>
      <section className="history-panel hud-panel"><div className="panel-header"><div><SectionLabel>REQUEST LOG</SectionLabel><h2>Recent requests</h2></div><span className="history-count">{historyQuery.data ? `${String(historyQuery.data.length).padStart(2, "0")} RECORDS` : "LIVE LOG"}</span></div><div className="history-list">{historyQuery.data?.slice(0, 3).map(item => <div className="history-item" key={item.id}><div className={`history-icon ${item.status}`}><Radio size={14} /></div><div className="history-main"><strong>{item.phone}</strong><span>{new Date(item.createdAt).toLocaleString()}</span></div><span className={`history-status ${item.status}`}>{statusLabel(item.status)}</span></div>) || <div className="empty-history">No pairing requests recorded yet.</div>}</div></section>
    </main><footer className="footer"><span>FIREBOX // TEMPORARY PUBLIC CHANNEL</span><span>SESSION VALUES NEVER LOGGED</span><span>BUILD 0.2.0</span></footer></div>;
}
