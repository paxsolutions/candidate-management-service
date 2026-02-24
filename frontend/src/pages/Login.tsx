import React, { useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const SunIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const MoonIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
    />
  </svg>
);

const Login: React.FC = () => {
  const { login, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const history = useHistory();
  const location = useLocation<{ from: { pathname: string } }>();

  useEffect(() => {
    if (user) {
      const { from } = location.state || { from: { pathname: '/' } };
      if (from.pathname !== '/login') {
        history.replace(from);
      }
    }
  }, [user, location, history]);

  if (user) {
    return null;
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 transition-colors duration-200 ${
      isDark ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className={`max-w-md w-full space-y-8 p-8 rounded-xl shadow-lg ${
        isDark ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="absolute top-4 right-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full focus:outline-none"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <SunIcon className="h-6 w-6 text-yellow-300" />
            ) : (
              <MoonIcon className="h-6 w-6 text-gray-600" />
            )}
          </button>
        </div>

        <div className="text-center">
          <h2 className={`text-3xl font-extrabold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Welcome
          </h2>
          <p className={`mt-2 text-sm ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Please sign in
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <button
            onClick={login}
            className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200`}
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              <svg
                className={`h-5 w-5 ${
                  isDark ? 'text-blue-400' : 'text-blue-500'
                } group-hover:text-blue-400`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A10.079 10.079 0 0012.545 2C7.319 2 3.091 6.23 3.091 11.455c0 5.225 4.228 9.455 9.454 9.455 5.225 0 9.455-4.23 9.455-9.455 0-.682-.074-1.35-.213-1.988h-9.242z" />
              </svg>
            </span>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;