import { createBrowserRouter, createMemoryRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout";
import { isPreview } from "./lib/paths";
import { StationProvider } from "./lib/station";
import { Home } from "./pages/Home";
import { Live } from "./pages/Live";
import { Maidens } from "./pages/Maidens";
import { NotFound } from "./pages/NotFound";
import { Shop } from "./pages/Shop";
import { Station } from "./pages/Station";
import { Studio } from "./pages/Studio";
import { StudioStats } from "./pages/StudioStats";

// The preview build is hosted at a single URL, so it routes in memory.
const createRouter = isPreview ? createMemoryRouter : createBrowserRouter;

const router = createRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/maidens", element: <Maidens /> },
      { path: "/shop", element: <Shop /> },
      { path: "/live", element: <Live /> },
      { path: "/studio", element: <Studio /> },
      { path: "/studio/stats", element: <StudioStats /> },
      // /briar, /vega, … per-Maiden station pages (the link slugs in video descriptions)
      { path: "/:slug", element: <Station /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export function App() {
  return (
    <StationProvider>
      <RouterProvider router={router} />
    </StationProvider>
  );
}
