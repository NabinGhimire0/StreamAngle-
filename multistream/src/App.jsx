import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Studio from "./pages/Studio";
import Camera from "./pages/Camera";
import Watch from "./pages/Watch";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/watch/:eventCode" element={<Watch />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/studio/:eventCode"
        element={
          <ProtectedRoute>
            <Layout>
              <Studio />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="/camera" element={<Camera />} />
    </Routes>
  );
}

export default App;
