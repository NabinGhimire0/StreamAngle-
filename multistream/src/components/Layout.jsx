import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-gray-800/50 px-6 py-4">
        <div className="max-w-7xl mx-auto text-center text-gray-600 text-xs">
          &copy; {new Date().getFullYear()} StreamAngle &mdash; Multi-angle live streaming platform
        </div>
      </footer>
    </div>
  );
}