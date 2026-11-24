import { ButtonLink } from "../components/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-3xl font-semibold">This page does not exist</h1>
      <p className="mt-3 text-mute">Use the navigation to find a module, or return to the start.</p>
      <div className="mt-6 flex justify-center gap-3">
        <ButtonLink to="/" variant="primary">Go to Home</ButtonLink>
        <ButtonLink to="/mission-control">Mission Control</ButtonLink>
      </div>
    </div>
  );
}
