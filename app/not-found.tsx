export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-lg text-gray-600 mb-8">Page Not Found</p>
        <a
          href="/"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Go back home
        </a>
      </div>
    </div>
  );
}
