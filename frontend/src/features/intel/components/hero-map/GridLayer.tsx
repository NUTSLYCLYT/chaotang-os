import { MAP_H, MAP_W, project } from '../../lib/hero-map-view-model';

export function GridLayer() {
  const latLines: number[] = [];
  for (let lat = -60; lat <= 60; lat += 30) latLines.push(lat);

  const lngLines: number[] = [];
  for (let lng = -150; lng <= 150; lng += 30) lngLines.push(lng);

  return (
    <g>
      {latLines.map((lat) => {
        const y = project(lat, 0).y;
        return (
          <line
            key={`lat-${lat}`}
            x1="0"
            y1={y}
            x2={MAP_W}
            y2={y}
            stroke="rgba(107, 160, 255, 0.08)"
            strokeWidth="0.5"
            strokeDasharray={lat === 0 ? '0' : '2 3'}
          />
        );
      })}
      {lngLines.map((lng) => {
        const x = project(0, lng).x;
        return (
          <line
            key={`lng-${lng}`}
            x1={x}
            y1="0"
            x2={x}
            y2={MAP_H}
            stroke="rgba(107, 160, 255, 0.08)"
            strokeWidth="0.5"
            strokeDasharray={lng === 0 ? '0' : '2 3'}
          />
        );
      })}
      <rect
        x="0"
        y="0"
        width={MAP_W}
        height={MAP_H}
        fill="none"
        stroke="rgba(107, 160, 255, 0.15)"
        strokeWidth="1"
      />
    </g>
  );
}
