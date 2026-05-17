import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide navbar on landing page
  if (location.pathname === "/") return null;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white">StreamAngle</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="text-gray-300 hover:text-white transition text-sm sm:text-base px-2 sm:px-3 py-2"
              >
                Dashboard
              </Link>
              <span className="text-gray-700 hidden sm:inline">|</span>
              <span className="text-gray-400 text-sm hidden sm:inline truncate max-w-50">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-400 transition text-sm px-2 py-2"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-gray-300 hover:text-white transition text-sm sm:text-base px-3 py-2"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
