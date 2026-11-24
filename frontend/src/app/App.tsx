import { Route, Routes } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import About from "../pages/About";
import Assistant from "../pages/Assistant";
import Communication from "../pages/Communication";
import DigitalTwin from "../pages/DigitalTwin";
import EarthObservation from "../pages/EarthObservation";
import Home from "../pages/Home";
import MissionControl from "../pages/MissionControl";
import Multimodal from "../pages/Multimodal";
import Navigation from "../pages/Navigation";
import NotFound from "../pages/NotFound";
import Reports from "../pages/Reports";
import Settings from "../pages/Settings";
import SpaceObjects from "../pages/SpaceObjects";
import SpaceScience from "../pages/SpaceScience";
import Weather from "../pages/Weather";
import Wildfire from "../pages/Wildfire";

/** The 15 application routes. Paths must match app/navigation.ts and features/modules/modules.ts. */
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="mission-control" element={<MissionControl />} />
        <Route path="earth-observation" element={<EarthObservation />} />
        <Route path="wildfire" element={<Wildfire />} />
        <Route path="weather" element={<Weather />} />
        <Route path="communication" element={<Communication />} />
        <Route path="navigation" element={<Navigation />} />
        <Route path="space-science" element={<SpaceScience />} />
        <Route path="digital-twin" element={<DigitalTwin />} />
        <Route path="space-objects" element={<SpaceObjects />} />
        <Route path="multimodal" element={<Multimodal />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
