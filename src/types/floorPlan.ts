export interface Point2D {
  x: number; // meters
  y: number; // meters
}

export interface SurfaceMaterial {
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
}

export interface Wall {
  id: string;
  start: Point2D;
  end: Point2D;
  height: number; // meters
  thickness: number; // meters
  type: "exterior" | "interior" | "partition";
  material?: SurfaceMaterial;
}

export interface Opening {
  id: string;
  wallId: string;
  type: "door" | "window";
  offsetFromStart: number; // meters along the wall
  width: number;
  height: number;
  sillHeight: number; // 0 for doors
  material?: SurfaceMaterial;
}

export interface Room {
  id: string;
  name: string;
  boundary: Point2D[]; // polygon, in order
  floorHeight: number; // z-offset if multi-story, else 0
  labelPosition: Point2D;
  areaSqM?: number;
  material?: SurfaceMaterial;
}

export interface RoutePoint {
  x: number; // plan meters
  y: number; // plan meters
  height: number; // meters above this floor's elevation
}

export interface PipeRun {
  id: string;
  name: string;
  system: "supply" | "waste" | "vent" | "gas";
  points: RoutePoint[];
  diameter: number; // meters
  material?: SurfaceMaterial;
}

export interface ElectricalRun {
  id: string;
  name: string;
  circuit: "power" | "lighting" | "data";
  points: RoutePoint[];
  diameter: number; // meters
  material?: SurfaceMaterial;
}

export type SelectableKind = "wall" | "room" | "opening" | "pipe" | "electrical";

export interface Selection {
  kind: SelectableKind;
  id: string;
}

export type TransformMode = "translate" | "rotate";

export interface Dimension {
  id: string;
  from: Point2D;
  to: Point2D;
  label: string; // e.g. "4.20 m"
}

/** Named vertical level from an elevation sheet (F.F., T.O. parapet, etc.). */
export interface ElevationDatum {
  id: string;
  name: string;
  elevation: number; // meters
}

export interface Roof {
  type: "standing-seam" | "flat";
  eaveHeight: number;
  ridgeHeight: number;
  overhang: number;
  /** When false the live model keeps its roof data but does not draw it. */
  visible?: boolean;
  material?: SurfaceMaterial;
}

export interface DrawingSource {
  project: string;
  sheet: string;
  title: string;
  notes: string;
}

export interface Floor {
  id: string;
  name: string; // "Ground Floor", "First Floor"
  elevation: number; // meters, base z-height of this floor
  /** False for crown or mast levels that carry structure but no occupancy. */
  occupiable?: boolean;
  walls: Wall[];
  openings: Opening[];
  rooms: Room[];
  dimensions: Dimension[];
  pipes: PipeRun[];
  electrical: ElectricalRun[];
}

export interface FloorPlan {
  name: string;
  units: "meters";
  floors: Floor[];
  datums: ElevationDatum[];
  roof: Roof;
  source: DrawingSource;
}

export type AppMode = "plan" | "experience";

export interface ViewOptions {
  floorId: string;
  appMode: AppMode;
  showAllFloors: boolean;
  showDimensions: boolean;
  showDatums: boolean;
  showRoof: boolean;
  showPipes: boolean;
  showElectrical: boolean;
  showRoomLabels: boolean;
  wireframe: boolean;
  is2D: boolean;
}

export interface WallSegment {
  startOffset: number;
  endOffset: number;
  bottom: number;
  top: number;
}
