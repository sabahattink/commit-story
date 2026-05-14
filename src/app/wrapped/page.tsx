import { permanentRedirect } from "next/navigation";

// permanentRedirect must be called inside the function body (not at module scope)
export default function WrappedRoot() {
  permanentRedirect("/");
}
