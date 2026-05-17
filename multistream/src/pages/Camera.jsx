import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import useWebSocket from "../hooks/useWebSocket";

const CAMERA_TYPES = [
  { id: "phone", label: "📱 Phone Camera" },
  { id: "dslr", label: "📷 DSLR / Mirrorless" },
  { id: "usb", label: "🔌 USB / Capture Card" },
];

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export default function Camera() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [sessionCode, setSessionCode] = useState(
    searchParams.get("session") || "",
  );
  const [joined, setJoined] = useState(false);
  const [cameraType, setCameraType] = useState("phone");
  const [facingMode, setFacingMode] = useState("user");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const { isConnected, clientID, send, on, off } = useWebSocket(
    joined ? sessionCode : null,
    "camera",
    cameraType,
  );

  // Get camera media with better error handling
  const startCamera = async () => {
    setCameraError("");
    setIsRequestingCamera(true);

    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Edge.",
        );
      }

      const constraints = {
        video: {
          facingMode: { exact: facingMode === "user" ? "user" : "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      };

      console.log("Requesting camera with constraints:", constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      streamRef.current = stream;
      setCameraError("");
      setIsRequestingCamera(false);
      return stream;
    } catch (err) {
      console.error("Camera access failed:", err);

      // Try fallback without exact facingMode
      if (err.name === "OverconstrainedError" || err.name === "NotFoundError") {
        try {
          console.log("Retrying with default camera settings...");
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });

          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }

          streamRef.current = fallbackStream;
          setCameraError("");
          setIsRequestingCamera(false);
          return fallbackStream;
        } catch (fallbackErr) {
          console.error("Fallback camera access also failed:", fallbackErr);
          setCameraError(
            "Could not access camera. Please check your camera permissions and make sure no other app is using the camera.",
          );
        }
      } else if (err.name === "NotAllowedError") {
        setCameraError(
          "Camera access denied. Please allow camera permissions in your browser and try again.",
        );
      } else if (err.name === "NotFoundError") {
        setCameraError(
          "No camera found on your device. Please connect a camera and try again.",
        );
      } else {
        setCameraError(`Camera error: ${err.message}`);
      }

      setIsRequestingCamera(false);
      return null;
    }
  };

  // Create WebRTC offer and send to studio
  const createOffer = async (stream) => {
    if (!stream) {
      console.error("No stream available to create offer");
      return;
    }

    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add all tracks from the stream
      stream.getTracks().forEach((track) => {
        console.log(`Adding track: ${track.kind}`);
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate");
          send("candidate", { candidate: event.candidate });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (pc.connectionState === "connected") {
          console.log("WebRTC connection established successfully!");
        } else if (pc.connectionState === "failed") {
          console.error("WebRTC connection failed");
          setCameraError("Connection to studio failed. Please try again.");
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);
      console.log("Sending offer to studio");

      send("offer", {
        offer: offer,
        camera_type: cameraType,
      });

      peerConnectionRef.current = pc;
    } catch (err) {
      console.error("Error creating WebRTC offer:", err);
      setCameraError("Failed to establish connection with studio.");
    }
  };

  // Handle answer from studio
  useEffect(() => {
    const handleAnswer = async (msg) => {
      if (msg.data.answer && peerConnectionRef.current) {
        try {
          console.log("Received answer from studio");
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(msg.data.answer),
          );
          console.log("Remote description set successfully");
        } catch (err) {
          console.error("Failed to set remote description:", err);
        }
      }
    };

    const handleCandidate = (msg) => {
      if (msg.data.candidate && peerConnectionRef.current) {
        console.log("Received ICE candidate from studio");
        peerConnectionRef.current
          .addIceCandidate(new RTCIceCandidate(msg.data.candidate))
          .catch((err) => console.error("Failed to add ICE candidate:", err));
      }
    };

    const handleAudioControl = (msg) => {
      if (msg.data.muted !== undefined && streamRef.current) {
        const audioTracks = streamRef.current.getAudioTracks();
        audioTracks.forEach((t) => (t.enabled = !msg.data.muted));
        setIsMuted(msg.data.muted);
      }
    };

    on("answer", handleAnswer);
    on("candidate", handleCandidate);
    on("audio_control", handleAudioControl);

    return () => {
      off("answer", handleAnswer);
      off("candidate", handleCandidate);
      off("audio_control", handleAudioControl);
    };
  }, [on, off]);

  // When WebSocket is connected and we have stream, send offer
  useEffect(() => {
    if (isConnected && streamRef.current && !peerConnectionRef.current) {
      console.log("WebSocket connected, creating offer...");
      createOffer(streamRef.current);
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Join session
  const handleJoin = async () => {
    if (!sessionCode.trim()) {
      setCameraError("Please enter a session code");
      return;
    }

    setCameraError("");
    setIsRequestingCamera(true);

    const stream = await startCamera();
    if (stream) {
      setJoined(true);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      const newMuted = !isMuted;
      audioTracks.forEach((t) => (t.enabled = !newMuted));
      setIsMuted(newMuted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      const newOff = !isVideoOff;
      videoTracks.forEach((t) => (t.enabled = !newOff));
      setIsVideoOff(newOff);
    }
  };

  // Switch camera (front/back)
  const switchCamera = async () => {
    const newFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacing);

    // Stop current stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: newFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      streamRef.current = stream;

      // Update peer connection tracks
      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === "video");
        if (videoSender && stream.getVideoTracks()[0]) {
          videoSender.replaceTrack(stream.getVideoTracks()[0]);
        }
      }
    } catch (err) {
      console.error("Camera switch failed:", err);
      setCameraError("Failed to switch camera");
    }
  };

  // Disconnect
  const handleDisconnect = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setJoined(false);
    setCameraError("");
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full space-y-6">
          <h1 className="text-2xl font-bold text-center">📷 Camera Operator</h1>

          {cameraError && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {cameraError}
              {cameraError.includes("permission") && (
                <button
                  onClick={() => {
                    setCameraError("");
                    handleJoin();
                  }}
                  className="block mt-2 text-white underline"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Session Code
            </label>
            <input
              type="text"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              placeholder="e.g. X9-KL2P"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-center text-xl tracking-widest"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Camera Type
            </label>
            <div className="space-y-2">
              {CAMERA_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setCameraType(ct.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition ${
                    cameraType === ct.id
                      ? "bg-red-600"
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleJoin}
            disabled={!sessionCode.trim() || isRequestingCamera}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed py-3 rounded-lg font-bold text-lg transition"
          >
            {isRequestingCamera ? "Requesting Camera..." : "Connect to Studio"}
          </button>

          <button
            onClick={() => navigate("/")}
            className="w-full text-gray-400 hover:text-white py-2 transition"
          >
            ← Back to Home
          </button>

          {/* Instructions for users */}
          <div className="text-xs text-gray-500 text-center space-y-1 border-t border-gray-800 pt-4 mt-2">
            <p>
              💡 Tip: If camera doesn't work, check your browser permissions
            </p>
            <p>🔒 Make sure to click "Allow" when prompted for camera access</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Status Bar */}
      <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"
            }`}
          />
          <span className="text-sm">
            {isConnected ? "Connected to Studio" : "Connecting..."}
          </span>
          <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
            {cameraType}
          </span>
        </div>
        <span className="text-sm text-gray-400">Session: {sessionCode}</span>
      </div>

      {/* Video Preview */}
      <div className="flex-1 flex items-center justify-center bg-black p-4">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="max-w-full max-h-full rounded-lg"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 px-4 py-6 flex items-center justify-center gap-6">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition ${
            isMuted ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {isMuted ? "🔇" : "🎤"}
        </button>

        <button
          onClick={toggleVideo}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition ${
            isVideoOff ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {isVideoOff ? "🚫" : "📹"}
        </button>

        <button
          onClick={switchCamera}
          className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-2xl transition"
        >
          🔄
        </button>

        <button
          onClick={handleDisconnect}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-2xl transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
