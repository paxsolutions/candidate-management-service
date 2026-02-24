import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { fetchCandidates } from "../api";

interface DataItem {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  create_time: string;
  favourite: string;
  state: string;
}

const Table = () => {
  const [data, setData] = useState<DataItem[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("create_time");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 100;

  const history = useHistory();

  useEffect(() => {
    const loadData = async () => {
      const response = await fetchCandidates(search, sort, order, page, limit);
      setData(response.data);
      setTotal(response.total);
    };
    loadData();
  }, [search, sort, order, page]);

  const handleRowClick = (id: number, e: React.MouseEvent) => {
    // Don't navigate if clicking on a link or button inside the row
    if (
      (e.target as HTMLElement).closest("a, button, input, select, textarea")
    ) {
      return;
    }
    history.push(`/candidate/${id}`);
  };

  const toggleSort = (column: string) => {
    setSort(column);
    setOrder(order === "asc" ? "desc" : "asc");
  };

  return (
    <div className="p-2 sm:p-4">
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => toggleSort("id")}
              >
                <div className="flex items-center">
                  ID
                  {sort === "id" && (
                    <span className="ml-1">{order === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => toggleSort("favourite")}
              >
                <div className="flex items-center">
                  Favourite
                  {sort === "favourite" && (
                    <span className="ml-1">{order === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => toggleSort("first_name")}
              >
                <div className="flex items-center">
                  First Name
                  {sort === "first_name" && (
                    <span className="ml-1">{order === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => toggleSort("last_name")}
              >
                <div className="flex items-center">
                  Last Name
                  {sort === "last_name" && (
                    <span className="ml-1">{order === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => toggleSort("email")}
              >
                <div className="flex items-center">
                  Email
                  {sort === "email" && (
                    <span className="ml-1">{order === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => toggleSort("state")}
              >
                <div className="flex items-center">
                  State
                  {sort === "state" && (
                    <span className="ml-1">{order === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => toggleSort("create_time")}
              >
                <div className="flex items-center">
                  Created At
                  {sort === "create_time" && (
                    <span className="ml-1">{order === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                >
                  No data found
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={item.id}
                  onClick={(e) => handleRowClick(item.id, e)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {item.favourite}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {item.first_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {item.last_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <a href={`mailto:${item.email}`}>{item.email}</a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${
                        item.state === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {item.state}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(item.create_time).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-0">
          Showing <span className="font-medium">{(page - 1) * limit + 1}</span>{" "}
          to{" "}
          <span className="font-medium">{Math.min(page * limit, total)}</span>{" "}
          of <span className="font-medium">{total}</span> results
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => (p * limit < total ? p + 1 : p))}
            disabled={page * limit >= total}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default Table;
