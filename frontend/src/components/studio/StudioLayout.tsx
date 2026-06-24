import { Outlet } from "react-router-dom";
import "../../styles/StudioLayout.scss";

/** Studio page shell — sidebar lives in AppLayout. */
export function StudioLayout() {
  return (
    <div className="studio-layout studio-layout--embedded">
      <Outlet />
    </div>
  );
}
