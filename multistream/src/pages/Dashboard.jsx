import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  createEvent,
  getEvents,
  deleteEvent,
  updateEvent,
  getDestinations,
  addDestination,
  updateDestination,
  deleteDestination,
} from "../services/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [eventName, setEventName] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [loading, setLoading] = useState(true);

  // Destination modal
  const [showDestModal, setShowDestModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [newDest, setNewDest] = useState({
    platform: "youtube",
    stream_key: "",
    server_url: "",
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
  setLoading(true);
  try {
    const data = await getEvents();
    console.log("Loaded events:", data);
    setEvents(data);
  } catch (err) {
    console.error("Failed to load events:", err);
    alert("Failed to load events: " + err.message);
  } finally {
    setLoading(false);
  }
};

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!eventName.trim()) return;
    try {
      const event = await createEvent(eventName, eventDesc);
      setEvents((prev) => [event, ...prev]);
      setEventName("");
      setEventDesc("");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenDestinations = async (event) => {
    setSelectedEvent(event);
    setShowDestModal(true);
    try {
      const dests = await getDestinations(event.id);
      setDestinations(dests);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDestination = async () => {
    if (!selectedEvent || !newDest.stream_key) return;
    try {
      const dest = await addDestination(selectedEvent.id, newDest);
      setDestinations((prev) => [...prev, dest]);
      setNewDest({ platform: "youtube", stream_key: "", server_url: "" });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleDestination = async (dest) => {
    try {
      await updateDestination(dest.id, { is_active: !dest.is_active });
      setDestinations((prev) =>
        prev.map((d) =>
          d.id === dest.id ? { ...d, is_active: !d.is_active } : d,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDestination = async (id) => {
    try {
      await deleteDestination(id);
      setDestinations((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const liveCount = events.filter((e) => e.status === "live").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-400 mb-8">Manage your streaming events</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Total Events</p>
          <p className="text-3xl font-bold">{events.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Live Now</p>
          <p className="text-3xl font-bold text-red-500">{liveCount}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Status</p>
          <p className="text-3xl font-bold text-green-500">Ready</p>
        </div>
      </div>

      {/* Create Event Form */}
      <div className="bg-gray-900 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Create New Event</h2>
        <form onSubmit={handleCreateEvent} className="flex gap-4">
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Event name (e.g. City FC vs Town FC)"
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3"
          />
          <input
            type="text"
            value={eventDesc}
            onChange={(e) => setEventDesc(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3"
          />
          <button
            type="submit"
            className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded-lg font-bold"
          >
            Create
          </button>
        </form>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {events.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <p className="text-4xl mb-4">🎬</p>
            <p>No events yet. Create your first event above!</p>
          </div>
        )}

        {events.map((event) => (
          <div
            key={event.id}
            className="bg-gray-900 rounded-xl p-6 flex items-center justify-between"
          >
            <div>
              <h3 className="text-lg font-bold">{event.name}</h3>
              {event.description && (
                <p className="text-gray-400 text-sm mt-1">
                  {event.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs bg-gray-800 px-3 py-1 rounded font-mono">
                  📋 {event.unique_code}
                </span>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(event.unique_code)
                  }
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Copy Code
                </button>
                <span
                  className={`text-xs px-3 py-1 rounded ${
                    event.status === "live"
                      ? "bg-red-600"
                      : event.status === "ended"
                        ? "bg-gray-700"
                        : "bg-yellow-600/20 text-yellow-400"
                  }`}
                >
                  {event.status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenDestinations(event)}
                className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                📡 Destinations
              </button>
              <button
                onClick={() => navigate(`/studio/${event.unique_code}`)}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-bold"
              >
                🎬 Open Studio
              </button>
              <button
                onClick={() => handleDeleteEvent(event.id)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Destination Modal */}
      {showDestModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">📡 Stream Destinations</h2>
              <button
                onClick={() => setShowDestModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              {selectedEvent.name} — Add YouTube, Facebook, or custom RTMP
              destinations
            </p>

            {/* Add Destination */}
            <div className="bg-gray-800 rounded-lg p-4 space-y-3 mb-4">
              <select
                value={newDest.platform}
                onChange={(e) =>
                  setNewDest({ ...newDest, platform: e.target.value })
                }
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              >
                <option value="youtube">YouTube Live</option>
                <option value="facebook">Facebook Live</option>
                <option value="custom">Custom RTMP</option>
              </select>
              <input
                type="text"
                placeholder="Stream Key"
                value={newDest.stream_key}
                onChange={(e) =>
                  setNewDest({
                    ...newDest,
                    stream_key: e.target.value,
                  })
                }
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              />
              {newDest.platform === "custom" && (
                <input
                  type="text"
                  placeholder="RTMP Server URL"
                  value={newDest.server_url}
                  onChange={(e) =>
                    setNewDest({
                      ...newDest,
                      server_url: e.target.value,
                    })
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

            {/* Destination List */}
            {destinations.map((dest) => (
              <div
                key={dest.id}
                className="bg-gray-800 rounded-lg p-3 flex items-center justify-between mb-2"
              >
                <div className="flex items-center gap-2">
                  <span>
                    {dest.platform === "youtube" && "▶️"}
                    {dest.platform === "facebook" && "📘"}
                    {dest.platform === "custom" && "🔌"}
                  </span>
                  <span className="text-sm capitalize">{dest.platform}</span>
                  <span className="text-xs text-gray-400">
                    ...{dest.stream_key?.slice(-6)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleDestination(dest)}
                    className={`px-3 py-1 rounded text-xs font-bold ${
                      dest.is_active ? "bg-green-600" : "bg-gray-700"
                    }`}
                  >
                    {dest.is_active ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => handleDeleteDestination(dest.id)}
                    className="text-red-400 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {destinations.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                No destinations configured yet
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
