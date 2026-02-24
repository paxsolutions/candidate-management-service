import { ArrowLeftIcon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import React from "react";
import {
  Redirect,
  Route,
  BrowserRouter as Router,
  Switch,
  useHistory,
} from "react-router-dom";
import "./App.css";
import CandidateProfile from "./components/CandidateProfile";
import Table from "./components/Table";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";

interface LayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  showBackButton = false,
}) => {
  const [darkMode, setDarkMode] = React.useState(false);
  const history = useHistory();

  React.useEffect(() => {
    const isDark =
      localStorage.getItem("darkMode") === "true" ||
      (!localStorage.getItem("darkMode") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", String(newMode));
    document.documentElement.classList.toggle("dark", newMode);
  };

  const navigateBack = () => {
    history.goBack();
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            {showBackButton && (
              <button
                onClick={navigateBack}
                className="p-2 rounded-full text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {darkMode ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 shadow-lg rounded-lg transition-colors duration-200">
          {children}
        </div>
      </div>
    </div>
  );
};

interface PrivateRouteProps {
  children: React.ReactNode;
  path: string;
  exact?: boolean;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, ...rest }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <Route
      {...rest}
      render={({ location }) =>
        user ? (
          children
        ) : (
          <Redirect
            to={{
              pathname: "/login",
              state: { from: location },
            }}
          />
        )
      }
    />
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Switch>
            <Route path="/login" component={Login} />
            <PrivateRoute path="/" exact>
              <Layout>
                <Table />
              </Layout>
            </PrivateRoute>
            <PrivateRoute path="/candidate/:id">
              <Layout showBackButton>
                <CandidateProfile />
              </Layout>
            </PrivateRoute>
            <Route path="*">
              <Redirect to="/" />
            </Route>
          </Switch>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
