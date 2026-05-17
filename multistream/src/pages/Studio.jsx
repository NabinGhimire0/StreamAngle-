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

      // For now, just use the first active destination
      const dest = activeDests[0];

      // Use wss for HTTPS, ws for HTTP
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//localhost:8080/api/stream/ws?token=${token}&dest_id=${dest.id}`;

      console.log("Connecting to WebSocket:", wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("✅ WebSocket streaming connected");

        // Get the best supported MIME type
        const mimeType = getSupportedMimeType();

        // Start MediaRecorder on the stream
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: mimeType, // Use the detected MIME type
          videoBitsPerSecond: 2500000,
          audioBitsPerSecond: 128000,
        });

        console.log("MediaRecorder mimeType:", mediaRecorder.mimeType);

        mediaRecorder.ondataavailable = (event) => {
          if (
            event.data &&
            event.data.size > 0 &&
            ws.readyState === WebSocket.OPEN
          ) {
            console.log(`📹 Sending chunk: ${event.data.size} bytes`);
            ws.send(event.data);
          }
        };

        mediaRecorder.onerror = (e) => {
          console.error("MediaRecorder error:", e);
        };

        mediaRecorder.start(100); // Send small chunks frequently
        mediaRecorderRef.current = mediaRecorder;
      };

      ws.onerror = (error) => {
        console.error("WebSocket streaming error:", error);
      };

      ws.onclose = (event) => {
        console.log(
          "WebSocket streaming disconnected:",
          event.code,
          event.reason,
        );
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
  // Start canvas capture
  const startCanvasCapture = useCallback(async () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const stream = canvas.captureStream(30);

    // Add audio if available
    if (commentaryActive && commentaryStreamRef.current) {
      const audioTracks = commentaryStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => stream.addTrack(track));
    }

    if (activeAudioSource && cameras[activeAudioSource]?.stream) {
      const audioTracks = cameras[activeAudioSource].stream.getAudioTracks();
      if (audioTracks.length > 0 && !mutedCameras[activeAudioSource]) {
        audioTracks.forEach((track) => stream.addTrack(track));
      }
    }

    // Start WebSocket streaming
    await startWebSocketStreaming(stream);

    console.log("Canvas capture started");
  }, [
    commentaryActive,
    activeAudioSource,
    cameras,
    mutedCameras,
    startWebSocketStreaming,
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

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          video.srcObject = event.streams[0];
          video.onloadedmetadata = () => {
            setCameras((prev) => ({
              ...prev,
              [cameraID]: {
                id: cameraID,
                stream: event.streams[0],
                videoElement: video,
                type: msg.data.camera_type || "phone",
              },
            }));
            setActiveCameraId((prev) => prev || cameraID);
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
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send("answer", { answer }, cameraID);
        peerConnectionsRef.current[cameraID] = pc;
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    },
    [send],
  );

  const handleCandidate = useCallback((msg) => {
    const pc = peerConnectionsRef.current[msg.from];
    if (pc && msg.data.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(msg.data.candidate)).catch(
        console.error,
      );
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
        const eventsRes = await fetch("http://localhost:8080/api/events", {
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

    const cameraList = Object.values(cameras);
    const activeCamera = cameras[activeCameraId];

    if (cameraList.length > 0) {
      if (activeCamera?.videoElement) {
        drawVideoFit(ctx, activeCamera.videoElement, 0, 0, canvas.width, canvas.height);
      } else if (cameraList[0]?.videoElement) {
        drawVideoFit(ctx, cameraList[0].videoElement, 0, 0, canvas.width, canvas.height);
      }
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "24px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for cameras...", canvas.width / 2, canvas.height / 2);
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
      ctx.fillText(`Frame: ${frameCount}`, canvas.width - 100, canvas.height - 20);
      ctx.fillText(new Date().toLocaleTimeString(), canvas.width - 100, canvas.height - 40);
    }

    frameRequestRef.current = requestAnimationFrame(render);
  };

  render();
  
  return () => {
    if (frameRequestRef.current) {
      cancelAnimationFrame(frameRequestRef.current);
    }
  };
}, [cameras, activeCameraId, overlays, activeOverlays, isLive, drawVideoFit, renderOverlay]);

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
            {activePanel === "audio" && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-gray-400 uppercase">
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
                      {mutedCameras[cam.id] ? "🔇" : "🔊"}
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
