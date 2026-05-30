import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useWebSocket from "../hooks/useWebSocket";
import {
  getOverlays,
  createOverlay,
  updateOverlay,
  deleteOverlay,
  getDestinations,
  addDestination,
  updateDestination,
  deleteDestination,
  startRTMPStream,
  stopRTMPStream,
  updateEvent,
} from "../services/api";

const LAYOUTS = [
  { id: "single", label: "Single", icon: "1" },
  { id: "side-by-side", label: "Side by Side", icon: "2" },
  { id: "pip", label: "Picture in Picture", icon: "PiP" },
  { id: "grid", label: "2×2 Grid", icon: "4" },
  { id: "wide-cu", label: "Wide + Close-up", icon: "W+C" },
];

const OVERLAY_TYPES = [
  { id: "text", label: "Text Overlay" },
  { id: "scorecard", label: "Scorecard" },
  { id: "ad", label: "Advertisement" },
  { id: "replay", label: "Replay" },
  { id: "image", label: "Image" },
];

const OVERLAY_POSITIONS = [
  { id: "top-left", label: "Top Left" },
  { id: "top-right", label: "Top Right" },
  { id: "bottom-left", label: "Bottom Left" },
  { id: "bottom-right", label: "Bottom Right" },
  { id: "center", label: "Center" },
  { id: "full", label: "Full Screen" },
];

const PLATFORM_OPTIONS = [
  { id: "youtube", label: "YouTube Live" },
  { id: "facebook", label: "Facebook Live" },
  { id: "twitch", label: "Twitch" },
  { id: "custom", label: "Custom RTMP" },
];

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

const getSupportedMimeType = () => {
  // Prioritize H.264 for YouTube compatibility
  const types = [
    "video/webm;codecs=h264,opus", // H.264 + Opus
    "video/mp4;codecs=h264,aac", // MP4 with H.264 + AAC
    "video/webm;codecs=vp8,opus", // Fallback to VP8
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`✅ Using MediaRecorder MIME type: ${type}`);
      return type;
    }
  }
  return "";
};

export default function Studio() {
  const { eventCode } = useParams();
  const navigate = useNavigate();

  // Refs
  const canvasRef = useRef(null);
  const cameraVideosRef = useRef({});
  const peerConnectionsRef = useRef({});
  const viewerPeerConnectionsRef = useRef({});
  const iceCandidateQueuesRef = useRef({});
  const mediaRecorderRef = useRef(null);
  const commentaryStreamRef = useRef(null);
  const streamWSRef = useRef(null);
  const frameRequestRef = useRef(null);
  const clientIdRef = useRef(null);
  const isLiveRef = useRef(false);

  // State
  const [cameras, setCameras] = useState({});
  const [activeCameraId, setActiveCameraId] = useState(null);
  const [activeLayout, setActiveLayout] = useState("single");
  const [mutedCameras, setMutedCameras] = useState({});
  const [activeAudioSource, setActiveAudioSource] = useState(null);
  const [commentaryActive, setCommentaryActive] = useState(false);
  const [commentaryMuted, setCommentaryMuted] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [liveStartTime, setLiveStartTime] = useState(null);
  const [overlays, setOverlays] = useState([]);
  const [activeOverlays, setActiveOverlays] = useState({});
  const [newOverlay, setNewOverlay] = useState({
    type: "text",
    title: "",
    content: "",
    position: "top-right",
    duration: 0,
  });
  const [destinations, setDestinations] = useState([]);
  const [newDest, setNewDest] = useState({
    platform: "youtube",
    stream_key: "",
    server_url: "",
  });
  const [eventData, setEventData] = useState(null);
  const [activePanel, setActivePanel] = useState("cameras");
  const [elapsed, setElapsed] = useState("00:00:00");

  // WebSocket
  const { isConnected, clientID, send, on, off } = useWebSocket(
    eventCode,
    "studio",
    "",
  );

  useEffect(() => {
    if (clientID) {
      clientIdRef.current = clientID;
    }
  }, [clientID]);

  // Draw video maintaining aspect ratio
  const drawVideoFit = useCallback((ctx, video, x, y, w, h) => {
    if (!video || video.readyState < 2) {
      ctx.fillStyle = "#0D1318";
      ctx.fillRect(x, y, w, h);
      return;
    }

    const videoRatio = video.videoWidth / video.videoHeight;
    const boxRatio = w / h;
    let drawW, drawH, drawX, drawY;

    if (videoRatio > boxRatio) {
      drawW = w;
      drawH = w / videoRatio;
      drawX = x;
      drawY = y + (h - drawH) / 2;
    } else {
      drawH = h;
      drawW = h * videoRatio;
      drawX = x + (w - drawW) / 2;
      drawY = y;
    }

    ctx.drawImage(video, drawX, drawY, drawW, drawH);
  }, []);

  // Draw camera feed with premium HUD labels and fallbacks
  const drawCameraFeed = useCallback((ctx, camera, label, x, y, w, h) => {
    if (camera && camera.videoElement && camera.videoElement.readyState >= 2) {
      drawVideoFit(ctx, camera.videoElement, x, y, w, h);
      
      // Draw sleek label tag overlay
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
      ctx.font = "bold 12px 'DM Sans', sans-serif";
      const textWidth = ctx.measureText(label).width;
      
      const boxW = textWidth + 24;
      const boxH = 24;
      const boxX = x + 12;
      const boxY = y + h - boxH - 12;
      
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxW, boxH);
      }
      
      // Active status dot indicator
      ctx.fillStyle = "#22C55E";
      ctx.beginPath();
      ctx.arc(boxX + 10, boxY + boxH / 2, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      // Text label
      ctx.fillStyle = "#F8FAFC";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, boxX + 18, boxY + boxH / 2);
      ctx.restore();
    } else {
      // Premium broadcast placeholder
      ctx.save();
      ctx.fillStyle = "#090D11";
      ctx.fillRect(x, y, w, h);
      
      // Subtle grid-dashed border outline
      ctx.strokeStyle = "#1E293B";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
      
      // Label text centered
      ctx.fillStyle = "#475569";
      ctx.font = "bold 15px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label || "Offline Feed", x + w / 2, y + h / 2 - 10);
      
      ctx.font = "11px 'DM Sans', sans-serif";
      ctx.fillStyle = "#334155";
      ctx.fillText("Waiting for connection...", x + w / 2, y + h / 2 + 12);
      ctx.restore();
    }
  }, [drawVideoFit]);

  // Render overlay
  const renderOverlay = useCallback((ctx, overlay) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let x, y, w, h;

    switch (overlay.position) {
      case "top-left":
        x = 20;
        y = 20;
        w = 300;
        h = 80;
        break;
      case "top-right":
        x = canvas.width - 320;
        y = 20;
        w = 300;
        h = 80;
        break;
      case "bottom-left":
        x = 20;
        y = canvas.height - 100;
        w = 300;
        h = 80;
        break;
      case "bottom-right":
        x = canvas.width - 320;
        y = canvas.height - 100;
        w = 300;
        h = 80;
        break;
      case "center":
        x = (canvas.width - 300) / 2;
        y = (canvas.height - 80) / 2;
        w = 300;
        h = 80;
        break;
      case "full":
        x = 0;
        y = 0;
        w = canvas.width;
        h = canvas.height;
        break;
      default:
        return;
    }

    ctx.save();
    ctx.shadowBlur = 0;

    switch (overlay.type) {
      case "text":
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(overlay.content || overlay.title, x + w / 2, y + h / 2);
        break;
      default:
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "#ffffff";
        ctx.font = "18px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(overlay.title || "Overlay", x + w / 2, y + h / 2);
    }

    ctx.restore();
  }, []);

  // Start WebSocket streaming to backend
  const startWebSocketStreaming = useCallback(
    async (stream) => {
      const token = localStorage.getItem("streamangle_token");
      const activeDests = destinations.filter((d) => d.is_active);
      if (activeDests.length === 0) {
        console.log("No active destinations");
        return false;
      }

      const dest = activeDests[0];
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/stream/ws?token=${token}&dest_id=${dest.id}`;

      console.log("Connecting WebSocket for streaming...");
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("✅ WebSocket open, creating MediaRecorder");

        // Prefer a MIME type that definitely supports audio+video
        const mimeTypes = [
          "video/webm;codecs=vp8,opus",
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=h264,opus",
          "video/webm",
        ];
        let selectedMime = "";
        for (const mime of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mime)) {
            selectedMime = mime;
            break;
          }
        }
        console.log(`Using MediaRecorder mimeType: ${selectedMime}`);

        // Verify audio tracks are enabled
        const audioTracks = stream.getAudioTracks();
        console.log(`Audio tracks in stream: ${audioTracks.length}`);
        audioTracks.forEach((t) => {
          console.log(`  - ${t.label} enabled: ${t.enabled}`);
          t.enabled = true;
        });

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMime,
          videoBitsPerSecond: 2500000,
          audioBitsPerSecond: 128000,
        });

        mediaRecorder.ondataavailable = (event) => {
          if (
            event.data &&
            event.data.size > 0 &&
            ws.readyState === WebSocket.OPEN
          ) {
            ws.send(event.data);
            if (Math.random() < 0.05) {
              console.log(`📹 Chunk: ${event.data.size} bytes`);
            }
          }
        };

        mediaRecorder.onerror = (e) => console.error("MediaRecorder error:", e);
        mediaRecorder.start(100);
        mediaRecorderRef.current = mediaRecorder;
      };

      ws.onerror = (error) => console.error("WebSocket error:", error);
      ws.onclose = () => {
        console.log("WebSocket closed");
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          mediaRecorderRef.current.stop();
        }
      };

      streamWSRef.current = ws;
      return true;
    },
    [destinations],
  );

  const requestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop any existing commentary stream
      if (commentaryStreamRef.current) {
        commentaryStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      commentaryStreamRef.current = stream;
      setCommentaryActive(true);
      setCommentaryMuted(false);
      return stream;
    } catch (err) {
      console.error("Failed to get microphone:", err);
      return null;
    }
  };
  // Start canvas capture
  const startCanvasCapture = useCallback(async () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasStream = canvas.captureStream(30);
    const finalStream = new MediaStream();

    // Add video tracks
    canvasStream
      .getVideoTracks()
      .forEach((track) => finalStream.addTrack(track));

    // ---- AUDIO SOURCE SELECTION ----
    let audioStream = null;

    // 1. Use selected camera audio if available and not muted
    if (activeAudioSource && cameras[activeAudioSource]?.stream) {
      const camStream = cameras[activeAudioSource].stream;
      const audioTracks = camStream.getAudioTracks();
      if (audioTracks.length > 0 && !mutedCameras[activeAudioSource]) {
        audioStream = camStream;
        console.log(`✅ Using audio from camera ${activeAudioSource}`);
      }
    }

    // 2. Otherwise use commentary mic if active
    if (!audioStream && commentaryActive && commentaryStreamRef.current) {
      const micTracks = commentaryStreamRef.current.getAudioTracks();
      if (micTracks.length > 0 && !commentaryMuted) {
        audioStream = commentaryStreamRef.current;
        console.log("✅ Using commentary mic audio");
      }
    }

    // 3. No audio yet? Force request microphone as fallback
    if (!audioStream) {
      console.warn("⚠️ No audio source – requesting microphone...");
      const micStream = await requestMicrophone();
      if (micStream && micStream.getAudioTracks().length > 0) {
        audioStream = micStream;
        console.log("✅ Using fallback microphone audio");
      }
    }

    // Add audio tracks to final stream (if any)
    if (audioStream) {
      audioStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
        finalStream.addTrack(track);
      });
    }

    // Final check: log what we have
    console.log(
      `Final stream: video=${finalStream.getVideoTracks().length}, audio=${finalStream.getAudioTracks().length}`,
    );

    if (finalStream.getAudioTracks().length === 0) {
      console.error("❌ NO AUDIO TRACK! Stream will be silent.");
      alert(
        "No audio source available. Please connect a camera with microphone or enable commentary mic.",
      );
      return;
    }

    // Start WebSocket streaming
    await startWebSocketStreaming(finalStream);
  }, [
    activeAudioSource,
    cameras,
    mutedCameras,
    commentaryActive,
    commentaryStreamRef,
    commentaryMuted,
    startWebSocketStreaming,
    requestMicrophone,
  ]);
  // WebSocket message handlers
  const handleOffer = useCallback(
    async (msg) => {
      const cameraID = msg.from;
      const offer = msg.data.offer;

      if (peerConnectionsRef.current[cameraID]) {
        console.log(`Already processing camera ${cameraID}`);
        return;
      }

      let video = cameraVideosRef.current[cameraID];
      if (!video) {
        video = document.createElement("video");
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.id = `camera-${cameraID}`;
        document.body.appendChild(video);
        cameraVideosRef.current[cameraID] = video;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current[cameraID] = pc;
      iceCandidateQueuesRef.current[cameraID] = [];

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          console.log(
            `Received stream from ${cameraID} – video: ${stream.getVideoTracks().length}, audio: ${stream.getAudioTracks().length}`,
          );
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            setCameras((prev) => ({
              ...prev,
              [cameraID]: {
                id: cameraID,
                stream: stream,
                videoElement: video,
                type: msg.data.camera_type || "phone",
              },
            }));
            setActiveCameraId((prev) => prev || cameraID);
            // If this is the first camera and no audio source is set, select it
            if (!activeAudioSource && stream.getAudioTracks().length > 0) {
              setActiveAudioSource(cameraID);
            }
          };
          video.play().catch(console.warn);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send("candidate", { candidate: event.candidate }, cameraID);
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Process queued candidates
        const queued = iceCandidateQueuesRef.current[cameraID] || [];
        for (const candidate of queued) {
          pc.addIceCandidate(candidate).catch(console.error);
        }
        iceCandidateQueuesRef.current[cameraID] = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send("answer", { answer }, cameraID);
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    },
    [send],
  );

  const handleCandidate = useCallback((msg) => {
    const cameraID = msg.from;
    const pc = peerConnectionsRef.current[cameraID];
    if (pc && msg.data.candidate) {
      const candidate = new RTCIceCandidate(msg.data.candidate);
      if (pc.remoteDescription && pc.remoteDescription.type) {
        pc.addIceCandidate(candidate).catch(console.error);
      } else {
        if (!iceCandidateQueuesRef.current[cameraID]) {
          iceCandidateQueuesRef.current[cameraID] = [];
        }
        iceCandidateQueuesRef.current[cameraID].push(candidate);
      }
    }
  }, []);

  const handleClientJoined = useCallback((msg) => {
    if (msg.data?.role === "viewer") {
      setViewerCount((prev) => prev + 1);
    }
  }, []);

  const handleClientLeft = useCallback(
    (msg) => {
      if (msg.data?.role === "viewer") {
        setViewerCount((prev) => Math.max(0, prev - 1));
      }
      if (msg.data?.role === "camera") {
        setCameras((prev) => {
          const next = { ...prev };
          delete next[msg.from];
          return next;
        });
        if (activeCameraId === msg.from) {
          setActiveCameraId(Object.keys(cameras)[0] || null);
        }
      }
    },
    [activeCameraId, cameras],
  );

  // Register WebSocket handlers
  useEffect(() => {
    on("offer", handleOffer);
    on("candidate", handleCandidate);
    on("client_joined", handleClientJoined);
    on("client_left", handleClientLeft);

    return () => {
      off("offer", handleOffer);
      off("candidate", handleCandidate);
      off("client_joined", handleClientJoined);
      off("client_left", handleClientLeft);
    };
  }, [
    on,
    off,
    handleOffer,
    handleCandidate,
    handleClientJoined,
    handleClientLeft,
  ]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem("streamangle_token");
        const eventsRes = await fetch("/api/events", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const events = await eventsRes.json();
        const event = events.find((e) => e.unique_code === eventCode);
        if (event) {
          setEventData(event);
          const ov = await getOverlays(event.id);
          setOverlays(ov);
          const dest = await getDestinations(event.id);
          setDestinations(dest);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    };
    loadData();
  }, [eventCode]);

  // Canvas rendering loop - CONTINUOUS REDRAWING
  // Canvas rendering loop - FORCE continuous updates at 30fps
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let lastFrameTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;
    let frameCount = 0;

    const render = (timestamp) => {
      // Throttle to target FPS
      if (timestamp - lastFrameTime < frameInterval) {
        frameRequestRef.current = requestAnimationFrame(render);
        return;
      }
      lastFrameTime = timestamp;
      frameCount++;

      // Clear canvas
      ctx.fillStyle = "#080C0F";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cameraList = Object.values(cameras).sort((a, b) => a.id.localeCompare(b.id));
      const primaryCam = cameras[activeCameraId] || cameraList[0] || null;

      if (cameraList.length > 0) {
        if (activeLayout === "single") {
          if (primaryCam) {
            drawCameraFeed(
              ctx,
              primaryCam,
              `${primaryCam.id.split("_")[0]} (Main)`,
              0,
              0,
              canvas.width,
              canvas.height
            );
          }
        } else if (activeLayout === "side-by-side") {
          const cam1 = primaryCam;
          const cam2 = cameraList.find(c => c.id !== cam1.id) || null;
          const halfW = canvas.width / 2;

          drawCameraFeed(
            ctx,
            cam1,
            `${cam1.id.split("_")[0]} (Left)`,
            0,
            0,
            halfW,
            canvas.height
          );
          drawCameraFeed(
            ctx,
            cam2,
            cam2 ? `${cam2.id.split("_")[0]} (Right)` : "Camera 2 (Offline)",
            halfW,
            0,
            halfW,
            canvas.height
          );

          // Divider
          ctx.fillStyle = "#1E293B";
          ctx.fillRect(halfW - 1, 0, 2, canvas.height);
        } else if (activeLayout === "pip") {
          const mainCam = primaryCam;
          const pipCam = cameraList.find(c => c.id !== mainCam.id) || null;

          // Main video background
          drawCameraFeed(
            ctx,
            mainCam,
            `${mainCam.id.split("_")[0]} (Main)`,
            0,
            0,
            canvas.width,
            canvas.height
          );

          if (pipCam) {
            const pipW = canvas.width / 4;
            const pipH = canvas.height / 4;
            const pipX = canvas.width - pipW - 20;
            const pipY = canvas.height - pipH - 20;

            ctx.save();
            ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
            ctx.shadowBlur = 15;
            ctx.fillStyle = "#090D11";
            ctx.fillRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4);
            ctx.restore();

            drawCameraFeed(
              ctx,
              pipCam,
              `${pipCam.id.split("_")[0]} (PiP)`,
              pipX,
              pipY,
              pipW,
              pipH
            );
          }
        } else if (activeLayout === "grid") {
          const w = canvas.width / 2;
          const h = canvas.height / 2;

          const cam1 = primaryCam;
          const otherCams = cameraList.filter(c => c.id !== cam1.id);
          const cam2 = otherCams[0] || null;
          const cam3 = otherCams[1] || null;
          const cam4 = otherCams[2] || null;

          drawCameraFeed(ctx, cam1, `${cam1.id.split("_")[0]} (Cam 1)`, 0, 0, w, h);
          drawCameraFeed(ctx, cam2, cam2 ? `${cam2.id.split("_")[0]} (Cam 2)` : "Camera 2 (Offline)", w, 0, w, h);
          drawCameraFeed(ctx, cam3, cam3 ? `${cam3.id.split("_")[0]} (Cam 3)` : "Camera 3 (Offline)", 0, h, w, h);
          drawCameraFeed(ctx, cam4, cam4 ? `${cam4.id.split("_")[0]} (Cam 4)` : "Camera 4 (Offline)", w, h, w, h);

          // Grid dividers
          ctx.fillStyle = "#1E293B";
          ctx.fillRect(w - 1, 0, 2, canvas.height);
          ctx.fillRect(0, h - 1, canvas.width, 2);
        } else if (activeLayout === "wide-cu") {
          const mainW = canvas.width * 0.75;
          const sideW = canvas.width * 0.25;
          const sideH = canvas.height / 2;

          const mainCam = primaryCam;
          const otherCams = cameraList.filter(c => c.id !== mainCam.id);
          const sideCam1 = otherCams[0] || null;
          const sideCam2 = otherCams[1] || null;

          drawCameraFeed(ctx, mainCam, `${mainCam.id.split("_")[0]} (Wide)`, 0, 0, mainW, canvas.height);
          drawCameraFeed(ctx, sideCam1, sideCam1 ? `${sideCam1.id.split("_")[0]} (CU 1)` : "Camera 2 (Offline)", mainW, 0, sideW, sideH);
          drawCameraFeed(ctx, sideCam2, sideCam2 ? `${sideCam2.id.split("_")[0]} (CU 2)` : "Camera 3 (Offline)", mainW, sideH, sideW, sideH);

          // Dividers
          ctx.fillStyle = "#1E293B";
          ctx.fillRect(mainW - 1, 0, 2, canvas.height);
          ctx.fillRect(mainW, sideH - 1, sideW, 2);
        }
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "24px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "Waiting for cameras...",
          canvas.width / 2,
          canvas.height / 2,
        );
      }

      // Draw overlays
      overlays.forEach((overlay) => {
        if (activeOverlays[overlay.id]) {
          renderOverlay(ctx, overlay);
        }
      });

      // Draw LIVE indicator with changing timestamp
      if (isLive) {
        ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
        ctx.fillRect(16, 16, 70, 28);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px 'DM Sans', sans-serif";
        ctx.fillText("LIVE", 32, 35);

        // FORCE canvas update - change this every frame
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.font = "14px monospace";
        ctx.fillText(
          `Frame: ${frameCount}`,
          canvas.width - 100,
          canvas.height - 20,
        );
        ctx.fillText(
          new Date().toLocaleTimeString(),
          canvas.width - 100,
          canvas.height - 40,
        );
      }

      frameRequestRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, [
    cameras,
    activeCameraId,
    activeLayout,
    overlays,
    activeOverlays,
    isLive,
    drawVideoFit,
    drawCameraFeed,
    renderOverlay,
  ]);

  // Go Live
  const goLive = async () => {
    if (!eventData) return;
    try {
      await updateEvent(eventData.id, { status: "live" });
      isLiveRef.current = true;
      setIsLive(true);
      setLiveStartTime(Date.now());

      // Start RTMP stream on backend
      await startRTMPStream(eventData.id);

      setTimeout(() => startCanvasCapture(), 300);
    } catch (err) {
      console.error("Failed to go live:", err);
      alert("Failed to go live: " + err.message);
    }
  };

  // End Live
  const endLive = async () => {
    if (!eventData) return;
    try {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (streamWSRef.current) {
        streamWSRef.current.close();
      }
      await stopRTMPStream(eventData.id);
      await updateEvent(eventData.id, { status: "ended" });
      isLiveRef.current = false;
      setIsLive(false);
      setLiveStartTime(null);
    } catch (err) {
      console.error("Failed to end live:", err);
    }
  };

  // Live timer
  useEffect(() => {
    if (!liveStartTime) return;
    const interval = setInterval(() => {
      const diff = Date.now() - liveStartTime;
      const h = Math.floor(diff / 3600000)
        .toString()
        .padStart(2, "0");
      const m = Math.floor((diff % 3600000) / 60000)
        .toString()
        .padStart(2, "0");
      const s = Math.floor((diff % 60000) / 1000)
        .toString()
        .padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [liveStartTime]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (frameRequestRef.current)
        cancelAnimationFrame(frameRequestRef.current);
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      if (streamWSRef.current) streamWSRef.current.close();
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      Object.values(cameraVideosRef.current).forEach((video) => {
        if (video.srcObject)
          video.srcObject.getTracks().forEach((t) => t.stop());
        video.remove();
      });
      if (commentaryStreamRef.current) {
        commentaryStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Commentary functions
  const startCommentary = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      commentaryStreamRef.current = stream;
      setCommentaryActive(true);
      setCommentaryMuted(false);
    } catch (err) {
      console.error("Failed to get microphone:", err);
    }
  };

  const stopCommentary = () => {
    if (commentaryStreamRef.current) {
      commentaryStreamRef.current.getTracks().forEach((t) => t.stop());
      commentaryStreamRef.current = null;
    }
    setCommentaryActive(false);
  };

  const toggleCommentaryMute = () => {
    if (commentaryStreamRef.current) {
      const audioTracks = commentaryStreamRef.current.getAudioTracks();
      const newMuted = !commentaryMuted;
      audioTracks.forEach((t) => (t.enabled = !newMuted));
      setCommentaryMuted(newMuted);
    }
  };

  // Layout change
  const changeLayout = (layout) => {
    setActiveLayout(layout);
    send("layout_change", { layout });
  };

  // Overlay handlers
  const handleCreateOverlay = async () => {
    if (!eventData || !newOverlay.title) return;
    try {
      const ov = await createOverlay(eventData.id, newOverlay);
      setOverlays((prev) => [...prev, ov]);
      setNewOverlay({
        type: "text",
        title: "",
        content: "",
        position: "top-right",
        duration: 0,
      });
    } catch (err) {
      console.error("Failed to create overlay:", err);
    }
  };

  const toggleOverlayActive = async (overlay) => {
    try {
      const newState = !activeOverlays[overlay.id];
      await updateOverlay(overlay.id, { is_active: newState });
      setActiveOverlays((prev) => ({ ...prev, [overlay.id]: newState }));
    } catch (err) {
      console.error("Failed to toggle overlay:", err);
    }
  };

  const handleDeleteOverlay = async (id) => {
    try {
      await deleteOverlay(id);
      setOverlays((prev) => prev.filter((o) => o.id !== id));
      setActiveOverlays((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      console.error("Failed to delete overlay:", err);
    }
  };

  // Destination handlers
  const handleAddDestination = async () => {
    if (!eventData || !newDest.stream_key) return;
    try {
      const dest = await addDestination(eventData.id, newDest);
      setDestinations((prev) => [...prev, dest]);
      setNewDest({ platform: "youtube", stream_key: "", server_url: "" });
    } catch (err) {
      console.error("Failed to add destination:", err);
    }
  };

  const toggleDestinationActive = async (dest) => {
    try {
      await updateDestination(dest.id, { is_active: !dest.is_active });
      setDestinations((prev) =>
        prev.map((d) =>
          d.id === dest.id ? { ...d, is_active: !d.is_active } : d,
        ),
      );
    } catch (err) {
      console.error("Failed to toggle destination:", err);
    }
  };

  const handleDeleteDestination = async (id) => {
    try {
      await deleteDestination(id);
      setDestinations((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Failed to delete destination:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold">🎬 Studio</h1>
          <span className="text-sm text-gray-400">Session: {eventCode}</span>
          {isLive && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 font-mono text-sm">{elapsed}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            👁 {viewerCount} viewers
          </span>
          <span className="text-sm text-gray-400">
            📷 {Object.keys(cameras).length} cameras
          </span>
          <span
            className={`text-sm ${isConnected ? "text-green-500" : "text-yellow-500"}`}
          >
            {isConnected ? "● Connected" : "○ Connecting"}
          </span>
          {isLive ? (
            <button
              onClick={endLive}
              className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-bold"
            >
              END LIVE
            </button>
          ) : (
            <button
              onClick={goLive}
              disabled={Object.keys(cameras).length === 0}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-bold"
            >
              GO LIVE
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Canvas */}
        <div className="flex-1 flex items-center justify-center bg-black p-4">
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className="max-w-full max-h-full border border-gray-800 rounded-lg shadow-2xl"
            style={{ aspectRatio: "16/9" }}
          />
        </div>

        {/* Right Panel */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="flex border-b border-gray-800">
            {[
              { id: "cameras", label: "📷 Cameras" },
              { id: "overlays", label: "🖼 Overlays" },
              { id: "audio", label: "🎙 Audio" },
              { id: "destinations", label: "📡 Stream" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActivePanel(tab.id)}
                className={`flex-1 py-3 text-center text-sm font-medium transition ${activePanel === tab.id ? "bg-gray-800 text-red-500 border-b-2 border-red-500" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Cameras Panel */}
            {activePanel === "cameras" && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-400 uppercase">
                  Connected Cameras ({Object.keys(cameras).length})
                </h3>
                {Object.values(cameras).map((cam) => (
                  <div
                    key={cam.id}
                    className={`bg-gray-800 rounded-lg p-3 cursor-pointer transition border-2 ${activeCameraId === cam.id ? "border-red-500" : "border-transparent hover:border-gray-600"}`}
                    onClick={() => setActiveCameraId(cam.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium">
                          {cam.id.split("_")[0]}
                        </span>
                      </div>
                      {activeCameraId === cam.id && (
                        <span className="text-xs bg-red-600 px-2 py-0.5 rounded font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <h3 className="font-bold text-sm text-gray-400 uppercase mt-6">
                  Layout
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {LAYOUTS.map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => changeLayout(layout.id)}
                      title={layout.label}
                      className={`p-2 rounded text-xs font-bold transition ${activeLayout === layout.id ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                    >
                      {layout.icon}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Overlays Panel - Simplified */}
            {activePanel === "overlays" && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-400 uppercase">
                  Create Overlay
                </h3>
                <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                  <select
                    value={newOverlay.type}
                    onChange={(e) =>
                      setNewOverlay({ ...newOverlay, type: e.target.value })
                    }
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  >
                    {OVERLAY_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Title"
                    value={newOverlay.title}
                    onChange={(e) =>
                      setNewOverlay({ ...newOverlay, title: e.target.value })
                    }
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  />
                  <textarea
                    placeholder="Content"
                    value={newOverlay.content}
                    onChange={(e) =>
                      setNewOverlay({ ...newOverlay, content: e.target.value })
                    }
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm h-20"
                  />
                  <select
                    value={newOverlay.position}
                    onChange={(e) =>
                      setNewOverlay({ ...newOverlay, position: e.target.value })
                    }
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  >
                    {OVERLAY_POSITIONS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleCreateOverlay}
                    className="w-full bg-red-600 hover:bg-red-700 rounded py-2 text-sm font-bold"
                  >
                    + Add Overlay
                  </button>
                </div>
                <h3 className="font-bold text-sm text-gray-400 uppercase mt-4">
                  Active Overlays
                </h3>
                {overlays.map((overlay) => (
                  <div
                    key={overlay.id}
                    className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-sm font-medium">
                        {overlay.title}
                      </span>
                      <span className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded">
                        {overlay.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleOverlayActive(overlay)}
                        className={`px-3 py-1 rounded text-xs font-bold ${activeOverlays[overlay.id] ? "bg-green-600" : "bg-gray-700"}`}
                      >
                        {activeOverlays[overlay.id] ? "ON" : "OFF"}
                      </button>
                      <button
                        onClick={() => handleDeleteOverlay(overlay.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Audio Panel */}
            {/* Audio Panel - Add source selection */}
            {activePanel === "audio" && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-400 uppercase">
                  Audio Source
                </h3>
                <select
                  value={activeAudioSource || ""}
                  onChange={(e) => setActiveAudioSource(e.target.value || null)}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-3"
                >
                  <option value="">No Audio</option>
                  {Object.values(cameras).map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      Camera: {cam.id.split("_")[0]}{" "}
                      {cam.stream.getAudioTracks().length === 0
                        ? "(no mic)"
                        : ""}
                    </option>
                  ))}
                  <option value="commentary">Commentary Mic</option>
                </select>

                <h3 className="font-bold text-sm text-gray-400 uppercase mt-6">
                  Camera Audio
                </h3>
                {Object.values(cameras).map((cam) => (
                  <div
                    key={cam.id}
                    className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
                  >
                    <span className="text-sm">{cam.id.split("_")[0]}</span>
                    <button
                      onClick={() => {
                        const audioTracks = cam.stream.getAudioTracks();
                        if (audioTracks.length) {
                          const newMuted = !mutedCameras[cam.id];
                          audioTracks.forEach((t) => (t.enabled = !newMuted));
                          setMutedCameras((prev) => ({
                            ...prev,
                            [cam.id]: newMuted,
                          }));
                        }
                      }}
                      className={`px-2 py-1 rounded text-xs ${mutedCameras[cam.id] ? "bg-red-600" : "bg-gray-700"}`}
                    >
                      {mutedCameras[cam.id] ? "🔇 Muted" : "🔊 Live"}
                    </button>
                  </div>
                ))}

                <h3 className="font-bold text-sm text-gray-400 uppercase mt-6">
                  Commentary Mic
                </h3>
                {commentaryActive ? (
                  <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span>🎤 Commentary Active</span>
                      <button
                        onClick={toggleCommentaryMute}
                        className={`px-3 py-1 rounded text-xs ${commentaryMuted ? "bg-red-600" : "bg-green-600"}`}
                      >
                        {commentaryMuted ? "🔇 Muted" : "🔊 Live"}
                      </button>
                    </div>
                    <button
                      onClick={stopCommentary}
                      className="w-full bg-red-600/20 text-red-400 rounded py-1 text-xs"
                    >
                      Disconnect Mic
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startCommentary}
                    className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-sm"
                  >
                    🎤 Connect Commentary Mic
                  </button>
                )}
              </div>
            )}

            {/* Destinations Panel */}
            {activePanel === "destinations" && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-400 uppercase">
                  Add Stream Destination
                </h3>
                <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                  <select
                    value={newDest.platform}
                    onChange={(e) =>
                      setNewDest({ ...newDest, platform: e.target.value })
                    }
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  >
                    {PLATFORM_OPTIONS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Stream Key"
                    value={newDest.stream_key}
                    onChange={(e) =>
                      setNewDest({ ...newDest, stream_key: e.target.value })
                    }
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  />
                  {newDest.platform === "custom" && (
                    <input
                      type="text"
                      placeholder="RTMP Server URL"
                      value={newDest.server_url}
                      onChange={(e) =>
                        setNewDest({ ...newDest, server_url: e.target.value })
                      }
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                    />
                  )}
                  <button
                    onClick={handleAddDestination}
                    className="w-full bg-red-600 hover:bg-red-700 rounded py-2 text-sm font-bold"
                  >
                    Add Destination
                  </button>
                </div>
                <h3 className="font-bold text-sm text-gray-400 uppercase mt-4">
                  Active Destinations
                </h3>
                {destinations.map((dest) => (
                  <div
                    key={dest.id}
                    className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span>
                        {dest.platform === "youtube" && "▶️"}
                        {dest.platform === "facebook" && "📘"}
                        {dest.platform === "twitch" && "🎮"}
                        {dest.platform === "custom" && "🔌"}
                      </span>
                      <span className="text-sm font-medium capitalize">
                        {dest.platform}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleDestinationActive(dest)}
                        className={`px-3 py-1 rounded text-xs font-bold ${dest.is_active ? "bg-green-600" : "bg-gray-700"}`}
                      >
                        {dest.is_active ? "ON" : "OFF"}
                      </button>
                      <button
                        onClick={() => handleDeleteDestination(dest.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Share Links */}
          <div className="border-t border-gray-800 p-4 space-y-2">
            <p className="text-xs text-gray-400">Share Watch Link:</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/watch/${eventCode}`}
                className="flex-1 bg-gray-800 text-white text-xs rounded px-2 py-1"
              />
              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${window.location.origin}/watch/${eventCode}`,
                  )
                }
                className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-sm"
              >
                📋
              </button>
            </div>
            <p className="text-xs text-gray-400">Camera Link:</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/camera?session=${eventCode}`}
                className="flex-1 bg-gray-800 text-white text-xs rounded px-2 py-1"
              />
              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${window.location.origin}/camera?session=${eventCode}`,
                  )
                }
                className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-sm"
              >
                📋
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
