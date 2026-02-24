import {
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import React, { useEffect, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { fetchCandidateById, getFileDownloadUrl } from "../api";

interface NotesFieldProps {
  value: string | null;
  label: string;
}

const NotesField: React.FC<NotesFieldProps> = ({ value, label }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (textareaRef.current) {
      navigator.clipboard.writeText(textareaRef.current.value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-gray-100 dark:border-gray-700">
      <div className="flex justify-between items-start">
        <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">
          {label}
        </dt>
        <button
          onClick={handleCopy}
          className="ml-2 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          title="Copy notes"
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
          {copied && <span className="sr-only">Copied!</span>}
        </button>
      </div>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
        <textarea
          ref={textareaRef}
          readOnly
          value={value || ""}
          className="w-full h-32 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-sm"
        />
        {copied && (
          <div className="text-xs text-green-500 mt-1">
            Copied to clipboard!
          </div>
        )}
      </dd>
    </div>
  );
};

interface FileFieldProps {
  value: string | null;
  label: string;
  fileKey: string | null;
  isPhoto?: boolean;
}

const FileField: React.FC<FileFieldProps> = ({
  value,
  label,
  fileKey,
  isPhoto = false,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!fileKey) return;

    setIsDownloading(true);
    try {
      // Add 'candidates/' prefix if not already present
      let processedKey = fileKey;
      if (!processedKey.startsWith("candidates/")) {
        processedKey = `candidates/${processedKey}`;
      }

      // Add 'photos/' prefix for photos if not already present
      if (isPhoto && !processedKey.includes("/photos/")) {
        const parts = processedKey.split("/");
        const filename = parts.pop();
        processedKey = [...parts, "photos", filename].join("/");
      }

      const downloadUrl = await getFileDownloadUrl(processedKey);
      if (downloadUrl) {
        // Create a temporary anchor element to trigger the download
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute("download", fileKey.split("/").pop() || "download");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error downloading file:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!fileKey) return null;

  return (
    <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-gray-100 dark:border-gray-700">
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
        <div className="flex items-center">
          <span className="truncate">{value || "View File"}</span>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="ml-2 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
            title="Download file"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
          </button>
        </div>
        {isDownloading && (
          <div className="text-xs text-blue-500 mt-1">
            Preparing download...
          </div>
        )}
      </dd>
    </div>
  );
};

const CandidateProfile = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCandidate = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const data = await fetchCandidateById(parseInt(id));

        if (data) {
          setCandidate(data);
        } else {
          setError("Candidate not found");
        }
      } catch (err) {
        console.error("Error loading candidate:", err);
        setError("Failed to load candidate data");
      } finally {
        setLoading(false);
      }
    };

    loadCandidate();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 my-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        No candidate data found
      </div>
    );
  }

  // Helper function to format field names
  const formatFieldName = (key: string) => {
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            {candidate.first_name} {candidate.last_name}'s Profile
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Detailed information about this candidate
          </p>
        </div>
        <button
          onClick={() => history.goBack()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back to List
        </button>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700">
        <dl>
          {Object.entries(candidate).map(([key, value]) => {
            // Skip if value is null or empty object
            if (
              value === null ||
              (typeof value === "object" && Object.keys(value).length === 0)
            ) {
              return null;
            }

            // Handle notes with copy functionality
            if (key === "notes") {
              return (
                <NotesField
                  key={key}
                  value={value as string}
                  label={formatFieldName(key)}
                />
              );
            }

            // Handle file downloads
            if ((key === "upload_file" || key === "upload_photo") && value) {
              return (
                <FileField
                  key={key}
                  value={value as string}
                  fileKey={value as string}
                  isPhoto={key === "upload_photo"}
                  label={formatFieldName(key)}
                />
              );
            }

            // Format the value for display
            let displayValue: React.ReactNode = String(value);

            // Handle dates
            if (
              key.endsWith("_date") ||
              key.endsWith("_at") ||
              key === "create_time"
            ) {
              try {
                displayValue = new Date(value as string).toLocaleString();
              } catch (e) {
                console.error("Error parsing date:", e);
              }
            }

            // Handle boolean values
            if (typeof value === "boolean") {
              displayValue = value ? "Yes" : "No";
            }

            return (
              <div
                key={key}
                className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-gray-100 dark:border-gray-700"
              >
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">
                  {formatFieldName(key)}
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2 break-words">
                  {displayValue}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
};

export default CandidateProfile;
