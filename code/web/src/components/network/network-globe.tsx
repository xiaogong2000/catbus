"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import GlobeGL from "react-globe.gl";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import type { GlobeNode, GlobeArc } from "@/lib/globe-data";

const GLOBE_IMAGE = "//unpkg.com/three-globe/example/img/earth-night.jpg";
const NIGHT_SKY = "//unpkg.com/three-globe/example/img/night-sky.png";

// Major world capitals — subtle reference points on globe
const CAPITALS: { lat: number; lng: number; name: string; pop: number }[] = [
  // Asia
  { lat: 35.68, lng: 139.69, name: "Tokyo", pop: 37 },
  { lat: 39.90, lng: 116.40, name: "Beijing", pop: 21 },
  { lat: 31.23, lng: 121.47, name: "Shanghai", pop: 28 },
  { lat: 28.61, lng: 77.21, name: "New Delhi", pop: 32 },
  { lat: 37.57, lng: 126.98, name: "Seoul", pop: 10 },
  { lat: 1.35, lng: 103.82, name: "Singapore", pop: 6 },
  { lat: 13.76, lng: 100.50, name: "Bangkok", pop: 11 },
  { lat: 14.60, lng: 120.98, name: "Manila", pop: 14 },
  { lat: -6.21, lng: 106.85, name: "Jakarta", pop: 11 },
  { lat: 22.32, lng: 114.17, name: "Hong Kong", pop: 8 },
  { lat: 25.03, lng: 121.57, name: "Taipei", pop: 7 },
  { lat: 33.69, lng: 73.04, name: "Islamabad", pop: 4 },
  // Europe
  { lat: 51.51, lng: -0.13, name: "London", pop: 9 },
  { lat: 48.86, lng: 2.35, name: "Paris", pop: 11 },
  { lat: 52.52, lng: 13.41, name: "Berlin", pop: 4 },
  { lat: 55.76, lng: 37.62, name: "Moscow", pop: 13 },
  { lat: 41.90, lng: 12.50, name: "Rome", pop: 4 },
  { lat: 40.42, lng: -3.70, name: "Madrid", pop: 7 },
  { lat: 59.33, lng: 18.07, name: "Stockholm", pop: 2 },
  { lat: 52.37, lng: 4.90, name: "Amsterdam", pop: 2 },
  // Americas
  { lat: 38.91, lng: -77.04, name: "Washington", pop: 5 },
  { lat: 40.71, lng: -74.01, name: "New York", pop: 18 },
  { lat: 34.05, lng: -118.24, name: "Los Angeles", pop: 12 },
  { lat: 37.77, lng: -122.42, name: "San Francisco", pop: 4 },
  { lat: 45.50, lng: -73.57, name: "Montreal", pop: 4 },
  { lat: 19.43, lng: -99.13, name: "Mexico City", pop: 22 },
  { lat: -23.55, lng: -46.63, name: "São Paulo", pop: 22 },
  { lat: -34.60, lng: -58.38, name: "Buenos Aires", pop: 15 },
  // Middle East & Africa
  { lat: 25.20, lng: 55.27, name: "Dubai", pop: 4 },
  { lat: 41.01, lng: 28.98, name: "Istanbul", pop: 16 },
  { lat: 30.04, lng: 31.24, name: "Cairo", pop: 21 },
  { lat: -1.29, lng: 36.82, name: "Nairobi", pop: 5 },
  { lat: -33.92, lng: 18.42, name: "Cape Town", pop: 5 },
  // Oceania
  { lat: -33.87, lng: 151.21, name: "Sydney", pop: 5 },
  { lat: -36.85, lng: 174.76, name: "Auckland", pop: 2 },
];

interface Props {
  nodes: GlobeNode[];
  arcs: GlobeArc[];
  onlineNodeIds: Set<string>;
  width: number;
  height: number;
}

export default function NetworkGlobe({ nodes, arcs, onlineNodeIds, width, height }: Props) {
  const globeRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const router = useRouter();
  const { t } = useLocale();

  // Auto-rotate
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableZoom = true;
    }
  }, []);

  // Initial POV
  useEffect(() => {
    globeRef.current?.pointOfView({ lat: 20, lng: 10, altitude: 2.5 }, 0);
  }, []);

  // Rings: online nodes get pulse ripples
  const ringsData = useMemo(
    () => nodes.filter((n) => onlineNodeIds.has(n.nodeId)).map((n) => ({ lat: n.lat, lng: n.lng })),
    [nodes, onlineNodeIds],
  );

  // Tooltip HTML
  const tooltipHTML = useCallback(
    (d: GlobeNode) => `
      <div style="background:rgba(0,0,0,0.8);backdrop-filter:blur(12px);border:1px solid rgba(255,149,0,0.25);border-radius:8px;padding:10px 14px;font-family:system-ui;min-width:140px;">
        <div style="font-size:12px;font-weight:700;color:#ff9500;margin-bottom:4px;">${d.name}</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.55);margin-bottom:2px;">
          Status: <span style="color:${d.status === "online" ? "#4ade80" : "#ef4444"};">${d.status}</span>
          · ${d.skills.length} ${t("network.globe.skills")}
        </div>
        <div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:6px;">${t("network.globe.clickToView")}</div>
      </div>
    `,
    [t],
  );

  const handlePointClick = useCallback(
    (point: object) => {
      const d = point as GlobeNode;
      router.push(`/network/nodes/${d.nodeId}`);
    },
    [router],
  );

  return (
    <GlobeGL
      ref={globeRef}
      width={width}
      height={height}
      globeImageUrl={GLOBE_IMAGE}
      backgroundImageUrl={NIGHT_SKY}
      backgroundColor="#050510"
      atmosphereColor="rgba(60, 140, 255, 0.15)"
      atmosphereAltitude={0.2}
      // Points layer
      pointsData={nodes}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={(d: object) => ((d as GlobeNode).status === "online" ? 0.01 : 0.005)}
      pointRadius={(d: object) => Math.max(0.15, Math.sqrt((d as GlobeNode).skills.length) * 0.2)}
      pointColor={(d: object) =>
        (d as GlobeNode).status === "online"
          ? "rgba(255, 165, 0, 0.85)"
          : "rgba(100, 100, 100, 0.4)"
      }
      pointLabel={(d: object) => tooltipHTML(d as GlobeNode)}
      onPointClick={handlePointClick}
      // Arcs layer
      arcsData={arcs}
      arcStartLat="srcLat"
      arcStartLng="srcLng"
      arcEndLat="dstLat"
      arcEndLng="dstLng"
      arcColor={() => ["rgba(255, 165, 0, 0.9)", "rgba(74, 222, 128, 0.5)"]}
      arcDashLength={0.15}
      arcDashGap={0.85}
      arcDashAnimateTime={800}
      arcStroke={0.7}
      arcsTransitionDuration={300}
      // Rings layer
      ringsData={ringsData}
      ringLat="lat"
      ringLng="lng"
      ringColor={() => (t: number) => `rgba(255, 165, 0, ${1 - t})`}
      ringMaxRadius={3}
      ringPropagationSpeed={2}
      ringRepeatPeriod={2000}
      // Labels layer — world capitals
      labelsData={CAPITALS}
      labelLat="lat"
      labelLng="lng"
      labelText="name"
      labelSize={(d: object) => 0.3 + ((d as typeof CAPITALS[0]).pop / 37) * 0.4}
      labelDotRadius={(d: object) => 0.15 + ((d as typeof CAPITALS[0]).pop / 37) * 0.15}
      labelColor={() => "rgba(255, 255, 255, 0.55)"}
      labelResolution={2}
      labelAltitude={0.005}
      labelDotOrientation={() => "right" as const}
    />
  );
}
