export type AppTab = "portrait" | "gallery" | "results";

export interface NavItem {
  id: AppTab;
  label: string;
  description: string;
  step: number;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "portrait",
    label: "Your portrait",
    description: "Upload or take a selfie",
    step: 1,
  },
  {
    id: "gallery",
    label: "The gallery",
    description: "Add wedding photos to search",
    step: 2,
  },
  {
    id: "results",
    label: "Your moments",
    description: "Photos that include you",
    step: 3,
  },
];
