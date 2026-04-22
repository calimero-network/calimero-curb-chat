import React, { useState, useEffect, useRef } from "react";
import { styled, keyframes, css } from "styled-components";

// ─── Brand ─────────────────────────────────────────────────────────────────────
// Primary: #A5FF11 (Calimero green)

// ─── Animations ────────────────────────────────────────────────────────────────

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const float1 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  40%       { transform: translate(28px, -38px) scale(1.06); }
  70%       { transform: translate(-18px, 18px) scale(0.96); }
`;

const float2 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  35%       { transform: translate(-36px, 28px) scale(1.07); }
  70%       { transform: translate(22px, -18px) scale(0.94); }
`;

const float3 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%       { transform: translate(18px, 32px) scale(1.05); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50%       { opacity: 1;    transform: scale(1.05); }
`;

const spin = keyframes`
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
`;

const logoGlow = keyframes`
  0%, 100% { filter: drop-shadow(0 0 8px rgba(165,255,17,0.3)); }
  50%       { filter: drop-shadow(0 0 18px rgba(165,255,17,0.6)); }
`;

// Preview-specific animations
const msgAppear = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const channelSlide = keyframes`
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const dotBounce = keyframes`
  0%, 80%, 100% { transform: translateY(0);   opacity: 0.4; }
  40%           { transform: translateY(-4px); opacity: 1; }
`;

const reactionPop = keyframes`
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1);   opacity: 1; }
`;

const frameGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.55), 0 0 40px rgba(165,255,17,0.03); }
  50%       { box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.55), 0 0 60px rgba(165,255,17,0.07); }
`;

// ─── Layout ────────────────────────────────────────────────────────────────────

const Page = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  background: #09090b;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  @media (min-width: 1100px) {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 5rem;
    padding: 2rem 5vw;
  }
`;

// ─── Background ────────────────────────────────────────────────────────────────

const Orb = styled.div<{
  size: number; top: string; left: string;
  color: string; delay: number; anim: number;
}>`
  position: absolute;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  top: ${p => p.top};
  left: ${p => p.left};
  border-radius: 50%;
  background: radial-gradient(circle at 40% 40%, ${p => p.color}, transparent 70%);
  filter: blur(${p => Math.round(p.size * 0.3)}px);
  opacity: 0.45;
  ${p => css`
    animation: ${p.anim === 1 ? float1 : p.anim === 2 ? float2 : float3} ${16 + p.delay}s ease-in-out infinite;
    animation-delay: ${-p.delay * 2.5}s;
  `}
  pointer-events: none;
`;

const GridOverlay = styled.div`
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(165,255,17,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(165,255,17,0.04) 1px, transparent 1px);
  background-size: 64px 64px;
  pointer-events: none;
`;

const VignetteOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 35%, #09090b 82%);
  pointer-events: none;
`;

const Ring = styled.div<{ size: number; duration: number; reverse?: boolean }>`
  position: absolute;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  border-radius: 50%;
  border: 1px solid rgba(165,255,17,0.08);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  ${p => css`
    animation: ${spin} ${p.duration}s linear infinite;
    animation-direction: ${p.reverse ? "reverse" : "normal"};
  `}

  &::before {
    content: "";
    position: absolute;
    width: 8px;
    height: 8px;
    background: rgba(165,255,17,0.7);
    border-radius: 50%;
    top: -4px;
    left: 50%;
    margin-left: -4px;
    filter: blur(2px);
    box-shadow: 0 0 8px rgba(165,255,17,0.5);
  }
`;

// ─── Content ───────────────────────────────────────────────────────────────────

const Content = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 540px;
  width: 90%;
  text-align: center;

  @media (min-width: 1100px) {
    align-items: flex-start;
    text-align: left;
    flex-shrink: 0;
    width: 460px;
  }
`;

const LogoBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 12px;
  background: rgba(165,255,17,0.06);
  border: 1px solid rgba(165,255,17,0.15);
  border-radius: 100px;
  padding: 8px 18px 8px 8px;
  margin-bottom: 2rem;
  animation: ${fadeUp} 0.6s ease both;
`;

const LogoImg = styled.img`
  width: 28px;
  height: 28px;
  object-fit: contain;
  animation: ${logoGlow} 3s ease-in-out infinite;
`;

const AppName = styled.span`
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(165,255,17,0.7);
`;

const Headline = styled.h1`
  font-size: clamp(2.2rem, 5vw, 3.5rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: #ffffff;
  margin: 0 0 1.25rem;
  animation: ${fadeUp} 0.6s 0.1s ease both;

  .green {
    background: linear-gradient(120deg, #a5ff11, #d4ff70, #a5ff11, #6be000);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: ${shimmer} 5s linear infinite;
  }
`;

const Sub = styled.p`
  font-size: 1rem;
  color: rgba(255,255,255,0.42);
  line-height: 1.75;
  margin: 0 0 2.25rem;
  max-width: 440px;
  animation: ${fadeUp} 0.6s 0.2s ease both;
`;

const Features = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 2.25rem;
  animation: ${fadeUp} 0.6s 0.3s ease both;

  @media (min-width: 1100px) {
    justify-content: flex-start;
  }
`;

const Chip = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  background: rgba(165,255,17,0.05);
  border: 1px solid rgba(165,255,17,0.12);
  border-radius: 100px;
  padding: 7px 14px;
  font-size: 0.79rem;
  color: rgba(255,255,255,0.5);
  white-space: nowrap;
  transition: border-color 0.2s, color 0.2s;

  svg { flex-shrink: 0; opacity: 0.6; }

  &:hover {
    border-color: rgba(165,255,17,0.25);
    color: rgba(255,255,255,0.75);
  }
`;

const TerminalBox = styled.div`
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  padding: 13px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  animation: ${fadeUp} 0.6s 0.4s ease both;
`;

const StatusDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #a5ff11;
  flex-shrink: 0;
  box-shadow: 0 0 6px rgba(165,255,17,0.6);
  animation: ${pulse} 2.5s ease-in-out infinite;
`;

const TerminalText = styled.div`
  font-family: "SF Mono", "Fira Code", "Consolas", monospace;
  font-size: 0.77rem;
  color: rgba(255,255,255,0.3);

  .cmd { color: rgba(255,255,255,0.58); }

  .cursor {
    display: inline-block;
    width: 6px;
    height: 0.85em;
    background: rgba(165,255,17,0.75);
    margin-left: 3px;
    vertical-align: text-bottom;
    border-radius: 1px;
    animation: ${blink} 1.1s step-end infinite;
  }
`;

const ConnectButtonWrapper = styled.div`
  margin-top: 1.5rem;
  animation: ${fadeUp} 0.6s 0.5s ease both;
`;

// ─── Preview Section ────────────────────────────────────────────────────────────

const PreviewSection = styled.div`
  display: none;
  position: relative;
  z-index: 1;
  flex-shrink: 0;

  @media (min-width: 1100px) {
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: ${fadeUp} 0.9s 0.15s ease both;
  }
`;

const PreviewCaption = styled.div`
  margin-top: 12px;
  font-size: 0.67rem;
  color: rgba(255,255,255,0.18);
  letter-spacing: 0.06em;
  text-align: center;
`;

// ─── Browser Frame ──────────────────────────────────────────────────────────────

const BrowserFrame = styled.div<{ fading: boolean }>`
  width: 420px;
  height: 496px;
  background: #111113;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.09);
  overflow: hidden;
  animation: ${frameGlow} 6s ease-in-out infinite;
  transition: opacity 0.5s ease;
  opacity: ${p => p.fading ? 0 : 1};
`;

const FrameBar = styled.div`
  height: 38px;
  background: #191919;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 6px;
  flex-shrink: 0;
`;

const TL = styled.div<{ color: string }>`
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: ${p => p.color};
  opacity: 0.75;
`;

const FrameURL = styled.div`
  flex: 1;
  background: rgba(255,255,255,0.04);
  border-radius: 5px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.64rem;
  color: rgba(255,255,255,0.22);
  margin: 0 8px;
  letter-spacing: 0.02em;
`;

// ─── App Layout ─────────────────────────────────────────────────────────────────

const AppLayout = styled.div`
  display: flex;
  height: calc(100% - 38px);
`;

// ─── Sidebar ────────────────────────────────────────────────────────────────────

const Sidebar = styled.div`
  width: 128px;
  background: #0d0d0f;
  border-right: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
`;

const WorkspaceName = styled.div`
  padding: 11px 12px 9px;
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SideSection = styled.div`
  padding: 8px 0 2px;
`;

const SideSectionLabel = styled.div`
  padding: 2px 12px 4px;
  font-size: 0.58rem;
  font-weight: 600;
  color: rgba(255,255,255,0.22);
  letter-spacing: 0.09em;
  text-transform: uppercase;
`;

const ChannelRow = styled.div<{ active: boolean; shown: boolean }>`
  padding: 4px 12px 4px 10px;
  font-size: 0.7rem;
  color: ${p => p.active ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.38)"};
  background: ${p => p.active ? "rgba(165,255,17,0.07)" : "transparent"};
  border-left: 2px solid ${p => p.active ? "rgba(165,255,17,0.45)" : "transparent"};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  opacity: ${p => p.shown ? 1 : 0};
  animation: ${p => p.shown ? css`${channelSlide} 0.28s ease both` : "none"};

  span.hash { opacity: 0.38; margin-right: 2px; }
`;

const UnreadBadge = styled.div`
  background: rgba(165,255,17,0.18);
  color: rgba(165,255,17,0.8);
  font-size: 0.55rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 10px;
  line-height: 1.4;
`;

// ─── Chat Area ───────────────────────────────────────────────────────────────────

const ChatArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #111113;
  min-width: 0;
`;

const ChatHeader = styled.div`
  height: 38px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 6px;
  flex-shrink: 0;

  span.hash { opacity: 0.38; font-size: 0.78rem; }
  span.name { font-size: 0.76rem; font-weight: 600; color: rgba(255,255,255,0.78); }
`;

const MessagesArea = styled.div`
  flex: 1;
  padding: 8px 10px 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
`;

const Msg = styled.div<{ shown: boolean }>`
  display: flex;
  gap: 7px;
  align-items: flex-start;
  padding: 3px 0;
  opacity: ${p => p.shown ? 1 : 0};
  animation: ${p => p.shown ? css`${msgAppear} 0.28s ease both` : "none"};
`;

const Av = styled.div<{ bg: string }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${p => p.bg};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.58rem;
  font-weight: 700;
  color: #09090b;
  flex-shrink: 0;
  margin-top: 1px;
`;

const MsgBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const MsgMeta = styled.div`
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-bottom: 1px;
`;

const MsgUser = styled.span<{ color: string }>`
  font-size: 0.68rem;
  font-weight: 600;
  color: ${p => p.color};
`;

const MsgTime = styled.span`
  font-size: 0.58rem;
  color: rgba(255,255,255,0.18);
`;

const MsgText = styled.div`
  font-size: 0.7rem;
  color: rgba(255,255,255,0.6);
  line-height: 1.45;
  word-break: break-word;
`;

const Reaction = styled.div<{ shown: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 3px;
  background: rgba(165,255,17,0.07);
  border: 1px solid rgba(165,255,17,0.16);
  border-radius: 20px;
  padding: 2px 6px;
  font-size: 0.62rem;
  color: rgba(255,255,255,0.48);
  cursor: pointer;
  opacity: ${p => p.shown ? 1 : 0};
  animation: ${p => p.shown ? css`${reactionPop} 0.28s ease both` : "none"};
`;

const TypingRow = styled.div<{ shown: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 2px;
  opacity: ${p => p.shown ? 1 : 0};
  transition: opacity 0.18s ease;
`;

const Dots = styled.div`
  display: flex;
  gap: 3px;
  align-items: center;
`;

const Dot = styled.span<{ d: number }>`
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255,255,255,0.3);
  ${p => css`
    animation: ${dotBounce} 1.1s ease-in-out ${p.d}ms infinite;
  `}
`;

const TypingLabel = styled.span`
  font-size: 0.6rem;
  color: rgba(255,255,255,0.22);
  font-style: italic;
`;

const InputRow = styled.div`
  padding: 7px 10px;
  border-top: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0;
`;

const InputMock = styled.div`
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 7px;
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 0.64rem;
  color: rgba(255,255,255,0.18);
`;

// ─── Chat Preview Data & Component ─────────────────────────────────────────────

const CHANNELS = [
  { name: "general", unread: 0 },
  { name: "dev",     unread: 3 },
  { name: "design",  unread: 0 },
];

const MSGS = [
  { user: "Alice",   init: "A", color: "#a5ff11", text: "Just deployed to production! 🚀",          time: "2:41 PM" },
  { user: "Bob",     init: "B", color: "#60a5fa", text: "Sync complete across all nodes ✓",         time: "2:42 PM" },
  { user: "Charlie", init: "C", color: "#f472b6", text: "All tests passing! 💪",                    time: "2:43 PM" },
  { user: "Alice",   init: "A", color: "#a5ff11", text: "Welcome to Mero Chat! 👋",                 time: "2:44 PM" },
] as const;

// Step-to-delay map (ms to wait before advancing from step N to N+1)
const STEP_DELAYS = [350, 300, 300, 700, 850, 800, 850, 750, 850, 750, 850, 2500];
//                   0→1  1→2  2→3  3→4  4→5  5→6  6→7  7→8  8→9  9→10 10→11 11→fade

function ChatPreview() {
  const [step, setStep] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (step < STEP_DELAYS.length) {
      const t = setTimeout(() => setStep(s => s + 1), STEP_DELAYS[step]);
      return () => clearTimeout(t);
    }
    // All steps done — fade out, then reset
    setFading(true);
    const t = setTimeout(() => {
      setStep(0);
      setFading(false);
    }, 700);
    return () => clearTimeout(t);
  }, [step]);

  // Derived visibility
  const shownChannels = Math.min(step, 3);
  const msgShown = [step >= 4, step >= 6, step >= 9, step >= 11];
  const showTyping = step === 5 || step === 8 || step === 10;
  const showReaction = step >= 7 && step < STEP_DELAYS.length;
  const typingWho = step === 5 ? "Bob" : step === 8 ? "Charlie" : "Alice";

  return (
    <BrowserFrame fading={fading}>
      <FrameBar>
        <TL color="#ff5f56" />
        <TL color="#ffbd2e" />
        <TL color="#27c93f" />
        <FrameURL>mero-chat · calimero node</FrameURL>
      </FrameBar>
      <AppLayout>
        <Sidebar>
          <WorkspaceName>My Team</WorkspaceName>
          <SideSection>
            <SideSectionLabel>Channels</SideSectionLabel>
            {CHANNELS.map((ch, i) => (
              <ChannelRow key={ch.name} active={i === 0} shown={shownChannels > i}>
                <span><span className="hash">#</span>{ch.name}</span>
                {ch.unread > 0 && <UnreadBadge>{ch.unread}</UnreadBadge>}
              </ChannelRow>
            ))}
          </SideSection>
        </Sidebar>

        <ChatArea>
          <ChatHeader>
            <span className="hash">#</span>
            <span className="name">general</span>
          </ChatHeader>

          <MessagesArea>
            {MSGS.map((m, i) => (
              <React.Fragment key={i}>
                <Msg shown={msgShown[i]}>
                  <Av bg={m.color}>{m.init}</Av>
                  <MsgBody>
                    <MsgMeta>
                      <MsgUser color={m.color}>{m.user}</MsgUser>
                      <MsgTime>{m.time}</MsgTime>
                    </MsgMeta>
                    <MsgText>{m.text}</MsgText>
                    {i === 1 && (
                      <Reaction shown={showReaction && msgShown[1]}>
                        🎉 3
                      </Reaction>
                    )}
                  </MsgBody>
                </Msg>
              </React.Fragment>
            ))}

            <TypingRow shown={showTyping}>
              <Dots>
                <Dot d={0} />
                <Dot d={180} />
                <Dot d={360} />
              </Dots>
              <TypingLabel>{typingWho} is typing…</TypingLabel>
            </TypingRow>
          </MessagesArea>

          <InputRow>
            <InputMock>Message #general</InputMock>
          </InputRow>
        </ChatArea>
      </AppLayout>
    </BrowserFrame>
  );
}

// ─── Use on Web Button ──────────────────────────────────────────────────────────

const UseOnWebButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(165,255,17,0.1);
  border: 1px solid rgba(165,255,17,0.35);
  border-radius: 100px;
  padding: 11px 24px;
  font-size: 0.88rem;
  font-weight: 600;
  color: #a5ff11;
  cursor: pointer;
  margin-top: 1.25rem;
  animation: ${fadeUp} 0.6s 0.5s ease both;
  transition: background 0.2s, border-color 0.2s, transform 0.15s;

  &:hover {
    background: rgba(165,255,17,0.18);
    border-color: rgba(165,255,17,0.6);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

// ─── Component ─────────────────────────────────────────────────────────────────

interface LandingPageProps {
  onUseOnWeb?: () => void;
  connectButton?: React.ReactNode;
}

export default function LandingPage({ connectButton }: LandingPageProps) {
  return (
    <Page>
      {/* Background layers */}
      <Orb size={460} top="-12%" left="-10%" color="rgba(100,220,10,0.55)"  delay={0} anim={1} />
      <Orb size={360} top="58%"  left="68%"  color="rgba(165,255,17,0.4)"   delay={4} anim={2} />
      <Orb size={260} top="62%"  left="2%"   color="rgba(80,180,10,0.35)"   delay={7} anim={3} />
      <Orb size={180} top="8%"   left="76%"  color="rgba(165,255,17,0.28)"  delay={2} anim={1} />
      <GridOverlay />
      <VignetteOverlay />
      <Ring size={580} duration={45} />
      <Ring size={800} duration={70} reverse />

      {/* Main content */}
      <Content>
        <LogoBadge>
          <LogoImg src="/curb.svg" alt="Calimero" />
          <AppName>Mero Chat</AppName>
        </LogoBadge>

        <Headline>
          Private messaging,<br />
          <span className="green">owned by you</span>
        </Headline>

        <Sub>
          Mero Chat is a decentralized chat app that runs on your own Calimero node.
          No servers. No surveillance. Your conversations stay yours.
        </Sub>

        <Features>
          <Chip>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            End-to-end encrypted
          </Chip>
          <Chip>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            Self-hosted node
          </Chip>
          <Chip>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Invite-only access
          </Chip>
          <Chip>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Zero data collection
          </Chip>
        </Features>

        {connectButton ? (
          <ConnectButtonWrapper>
            {connectButton}
          </ConnectButtonWrapper>
        ) : (
          <TerminalBox>
            <StatusDot />
            <TerminalText>
              Open <span className="cmd">Calimero Desktop</span> and launch Mero Chat to get started
              <span className="cursor" />
            </TerminalText>
          </TerminalBox>
        )}
      </Content>

      {/* Animated chat preview — only visible on wide screens */}
      <PreviewSection>
        <ChatPreview />
        <PreviewCaption>Live preview · Messages sync in real-time across nodes</PreviewCaption>
      </PreviewSection>
    </Page>
  );
}
