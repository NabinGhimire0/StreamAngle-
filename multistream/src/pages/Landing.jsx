import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: "Multi-Camera Setup",
    description:
      "Connect unlimited cameras via unique session codes. Any device, any location — no complex setup required.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: "Live Production Studio",
    description:
      "Professional compositing with real-time canvas mixing. Switch angles, picture-in-picture, and more.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
      </svg>
    ),
    title: "Stream Anywhere",
    description:
      "Output to YouTube, Facebook, Twitch, or any RTMP destination. Reach your audience everywhere at once.",
  },
];

const stats = [
  { value: "∞", label: "Cameras per session" },
  { value: "<200ms", label: "Switch latency" },
  { value: "4K", label: "Max resolution" },
  { value: "0", label: "Software to install" },
];

const steps = [
  {
    num: "1",
    title: "Create an Event",
    description:
      "Set up your streaming event and get a unique session code to share with your camera operators.",
    active: true,
  },
  {
    num: "2",
    title: "Connect Cameras",
    description:
      "Operators enter the session code on any device to connect and instantly start sending their live feed.",
    active: false,
  },
  {
    num: "3",
    title: "Go Live",
    description:
      "Switch between camera angles in real-time and stream your professional multi-angle production to the world.",
    active: false,
  },
];

const cams = [
  { label: "CAM 1 — MAIN", bg: "from-[#0D1F2A] to-[#162A35]" },
  { label: "CAM 2 — WIDE", bg: "from-[#1A1220] to-[#220F2E]" },
  { label: "CAM 3 — CLOSE", bg: "from-[#0A1F10] to-[#0F2915]" },
  { label: "CAM 4 — ANGLE", bg: "from-[#201510] to-[#2A1A0A]" },
];

function CameraIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="1"
    >
      <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function LiveDot() {
  return (
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
  );
}

function LogoMark({ size = 36 }) {
  return (
    <div
      className="rounded-[10px] bg-emerald-400 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="black"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    </div>
  );
}

function StudioPreview() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const camInterval = setInterval(() => {
      setActiveIdx((i) => (i + 1) % cams.length);
    }, 2200);
    const timeInterval = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    return () => {
      clearInterval(camInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const fmt = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  return (
    <div className="rounded-[20px] overflow-hidden border border-white/10 bg-[#0E1418]">
      {/* topbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/7 bg-white/2">
        <span className="w-2 h-2 rounded-full bg-[#FF5F56]" />
        <span className="w-2 h-2 rounded-full bg-[#FFBD2E]" />
        <span className="w-2 h-2 rounded-full bg-[#27C93F]" />
        <span className="ml-2 text-[11px] text-white/25 font-medium tracking-widest uppercase">
          Production Studio
        </span>
        <div className="ml-auto flex items-center gap-1.5 bg-red-500/10 border border-red-500/25 rounded-md px-2.5 py-1 text-[11px] text-red-400 font-semibold tracking-widest">
          <LiveDot />
          LIVE
        </div>
      </div>

      {/* grid */}
      <div className="grid grid-cols-2 gap-0.75 p-0.75 bg-[#080C0F]">
        {cams.map((cam, i) => (
          <div
            key={i}
            className={`relative aspect-video rounded-md bg-linear-to-br ${cam.bg} flex items-end justify-start overflow-hidden transition-all duration-300`}
            style={
              activeIdx === i
                ? { boxShadow: "inset 0 0 0 2px #00E87A" }
                : {}
            }
          >
            <CameraIcon className="absolute opacity-15 w-9 h-9 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <span className="absolute bottom-1.5 left-2 text-[10px] text-white/50 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5">
              {cam.label}
            </span>
          </div>
        ))}
      </div>

      {/* controls */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-white/7">
        {[
          <path key="play" d="M5 3l14 9-14 9V3z" />,
          <path key="grid" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
          <path key="expand" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />,
        ].map((icon, i) => (
          <button
            key={i}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
              i === 0
                ? "bg-emerald-400 border-emerald-400"
                : "bg-[#141A1F] border-white/13 hover:bg-white/8"
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke={i === 0 ? "#000" : "currentColor"}
              strokeWidth="2"
              className={i !== 0 ? "text-white/50" : ""}
            >
              {icon}
            </svg>
          </button>
        ))}
        <span className="text-[11px] text-white/25 ml-1">
          4 cameras · 1 live
        </span>
        <div className="ml-auto flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 text-[12px] text-red-400 font-medium">
          <LiveDot />
          Streaming · {fmt(elapsed)}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div
      className="min-h-screen flex flex-col text-white"
      style={{
        background: "#080C0F",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        .font-display { font-family: 'Syne', sans-serif; }
        .animate-fade-up { animation: fadeUp 0.6s ease both; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        .hero-child-1 { animation-delay: 0.05s; }
        .hero-child-2 { animation-delay: 0.15s; }
        .hero-child-3 { animation-delay: 0.25s; }
        .hero-child-4 { animation-delay: 0.35s; }
        .hero-visual-in { animation: fadeUp 0.7s ease 0.2s both; }
        .feature-card:hover .feature-glow { opacity: 1; }
      `}</style>

      {/* NAV */}
      <nav
        className="sticky top-0 z-50 border-b border-white/7 px-8"
        style={{ backdropFilter: "blur(20px)", background: "rgba(8,12,15,0.85)" }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <LogoMark size={36} />
            <span className="font-display text-[18px] font-bold text-white tracking-tight">
              StreamAngle
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link
              to="/login"
              className="text-white/50 hover:text-white text-sm px-3.5 py-2 rounded-lg hover:bg-white/5 transition-all no-underline"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="flex items-center gap-1.5 bg-emerald-400 hover:bg-emerald-300 text-black text-sm font-medium px-4 py-2 rounded-[9px] transition-all no-underline"
            >
              Get Started
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-5xl mx-auto w-full px-8 pt-24 pb-20 grid grid-cols-2 gap-16 items-center">
        {/* left */}
        <div>
          <div className="animate-fade-up hero-child-1 inline-flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-3.5 py-1.5 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-[11px] font-medium tracking-widest uppercase">
              Now in Beta
            </span>
          </div>
          <h1 className="animate-fade-up hero-child-2 font-display text-[58px] leading-[1.04] font-extrabold tracking-[-1.5px] text-white mb-5">
            Broadcast from{" "}
            <em className="not-italic text-emerald-400">every angle.</em>
          </h1>
          <p className="animate-fade-up hero-child-3 text-[16px] text-white/50 font-light leading-[1.7] mb-9 max-w-100">
            Connect unlimited cameras, switch angles in real-time, and deliver
            professional multi-camera productions — all from your browser.
          </p>
          <div className="animate-fade-up hero-child-4 flex gap-3 flex-wrap">
            <Link
              to="/register"
              className="flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-black text-[15px] font-medium px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5 no-underline"
              style={{ boxShadow: "0 0 30px rgba(0,232,122,0.25)" }}
            >
              Start Streaming Free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              to="/camera"
              className="flex items-center gap-2 bg-[#141A1F] border border-white/13 text-white/80 hover:text-white text-[15px] px-7 py-3.5 rounded-xl transition-all hover:bg-[#1a2228] no-underline"
            >
              <CameraIcon className="w-4 h-4" />
              Join as Camera
            </Link>
          </div>
        </div>

        {/* right */}
        <div className="hero-visual-in">
          <StudioPreview />
        </div>
      </section>

      {/* STATS */}
      <div className="max-w-5xl mx-auto w-full px-8 pb-20 grid grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className="bg-[#0E1418] border border-white/7 rounded-2xl px-6 py-5"
          >
            <div className="font-display text-3xl font-extrabold tracking-tight text-white leading-none mb-1.5">
              <span className="text-emerald-400">{s.value.replace(/[0-9]/g, "")}</span>
              {s.value.replace(/[^0-9KmMs<]/g, "") || s.value}
            </div>
            <div className="text-[13px] text-white/30">{s.label}</div>
          </div>
        ))}
      </div>

      {/* DIVIDER */}
      <div className="max-w-5xl mx-auto w-full px-8 pb-14 flex items-center gap-4">
        <div className="flex-1 h-px bg-white/7" />
        <span className="text-[11px] text-white/20 tracking-[2px] uppercase font-medium">
          Core Features
        </span>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(0,232,122,0.2), transparent)" }} />
      </div>

      {/* FEATURES */}
      <section className="max-w-5xl mx-auto w-full px-8 pb-24" id="features">
        <div className="grid grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="feature-card relative bg-[#0E1418] border border-white/7 rounded-[20px] p-7 overflow-hidden hover:border-emerald-400/20 transition-all hover:-translate-y-1 duration-200"
            >
              <div
                className="feature-glow absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at 30% 30%, rgba(0,232,122,0.08) 0%, transparent 60%)" }}
              />
              <div className="relative w-11 h-11 rounded-xl bg-emerald-400/10 flex items-center justify-center mb-5 text-emerald-400">
                {f.icon}
              </div>
              <div className="font-display text-[15px] font-bold text-white mb-2.5 relative">
                {f.title}
              </div>
              <p className="text-[13.5px] text-white/45 leading-[1.65] font-light relative">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-5xl mx-auto w-full px-8 pb-24" id="how">
        <div className="text-center mb-14">
          <h2 className="font-display text-[42px] font-extrabold tracking-[-1px] text-white mb-3">
            Three steps to go live
          </h2>
          <p className="text-[16px] text-white/40 font-light max-w-90 mx-auto leading-relaxed">
            From zero to professional multi-angle broadcast in minutes.
          </p>
        </div>
        <div className="relative">
          {/* timeline line */}
          <div
            className="absolute top-7 left-7 h-px"
            style={{
              width: "calc(100% - 56px)",
              background: "linear-gradient(90deg, #00E87A 0%, rgba(0,232,122,0.1) 100%)",
            }}
          />
          <div className="grid grid-cols-3 gap-10 relative z-10">
            {steps.map((s, i) => (
              <div key={i}>
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-display text-xl font-extrabold mb-5 ${
                    s.active
                      ? "bg-emerald-400 text-black"
                      : "bg-[#141A1F] border border-white/13 text-emerald-400"
                  }`}
                  style={s.active ? { boxShadow: "0 0 30px rgba(0,232,122,0.25)" } : {}}
                >
                  {s.num}
                </div>
                <div className="font-display text-[17px] font-bold text-white mb-2.5">
                  {s.title}
                </div>
                <p className="text-[13.5px] text-white/45 leading-[1.65] font-light">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto w-full px-8 pb-24">
        <div
          className="relative rounded-[28px] border border-emerald-400/15 px-16 py-20 text-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(0,232,122,0.06) 0%, rgba(0,232,122,0.02) 50%, rgba(0,196,104,0.04) 100%)" }}
        >
          <div
            className="absolute pointer-events-none"
            style={{
              width: 600, height: 600, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(0,232,122,0.1) 0%, transparent 70%)",
              top: -200, left: "50%", transform: "translateX(-50%)",
            }}
          />
          <h2 className="relative font-display text-[46px] font-extrabold tracking-[-1px] text-white mb-4">
            Ready to stream like a pro?
          </h2>
          <p className="relative text-[16px] text-white/45 font-light max-w-90 mx-auto mb-9 leading-relaxed">
            Create your free account and start broadcasting with multiple camera
            angles today.
          </p>
          <div className="relative flex justify-center">
            <Link
              to="/register"
              className="flex items-center gap-2.5 bg-emerald-400 hover:bg-emerald-300 text-black text-[15px] font-medium px-8 py-3.5 rounded-xl transition-all hover:-translate-y-0.5 no-underline"
              style={{ boxShadow: "0 0 40px rgba(0,232,122,0.3)" }}
            >
              Get Started — It's Free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/7 px-8 py-7">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark size={28} />
            <span className="font-display text-[14px] font-bold text-white/40">
              StreamAngle
            </span>
          </div>
          <span className="text-[13px] text-white/20">
            © {new Date().getFullYear()} StreamAngle. Multi-angle live streaming platform.
          </span>
          <div className="flex gap-5">
            {["Privacy", "Terms", "Contact"].map((l) => (
              <a key={l} href="#" className="text-[13px] text-white/25 hover:text-white/50 transition-colors no-underline">
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}